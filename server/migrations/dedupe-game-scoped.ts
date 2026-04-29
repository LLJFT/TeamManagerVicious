import { pool } from "../db";

type Scope = { team_id: string; game_id: string };

async function getScopesWithRosterId(table: string): Promise<Scope[]> {
  const r = await pool.query(
    `SELECT DISTINCT team_id, game_id FROM ${table} WHERE roster_id IS NOT NULL AND team_id IS NOT NULL AND game_id IS NOT NULL`
  );
  return r.rows as Scope[];
}

async function ensureFkIndexes(): Promise<void> {
  const stmts = [
    `CREATE INDEX IF NOT EXISTS idx_game_heroes_hero_id ON game_heroes(hero_id)`,
    `CREATE INDEX IF NOT EXISTS idx_game_hero_ban_actions_hero_id ON game_hero_ban_actions(hero_id)`,
    `CREATE INDEX IF NOT EXISTS idx_games_map_id ON games(map_id)`,
    `CREATE INDEX IF NOT EXISTS idx_game_map_veto_rows_map_id ON game_map_veto_rows(map_id)`,
    `CREATE INDEX IF NOT EXISTS idx_games_game_mode_id ON games(game_mode_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stat_fields_game_mode_id ON stat_fields(game_mode_id)`,
    `CREATE INDEX IF NOT EXISTS idx_maps_game_mode_id ON maps(game_mode_id)`,
  ];
  for (const s of stmts) {
    try {
      await pool.query(s);
    } catch (e: any) {
      console.warn(`[dedupe-game-scoped] index create skipped: ${e?.message || e}`);
    }
  }
}

/**
 * Build a mapping table (old_id -> canonical_id) for a given (table, team, game).
 * Canonical key is name (lowercased) for maps/game_modes; (name+role) for heroes
 * because Marvel Rivals intentionally has the same name across multiple roles
 * (e.g. Deadpool×3) under a unique constraint of (team, game, roster, name, role).
 */
async function buildMappingFor(
  table: string,
  teamId: string,
  gameId: string,
  keyExpr: string,
): Promise<{ canonicalIds: string[]; remap: Array<{ old: string; canon: string }>; toShare: string[] }> {
  // canonical row per key: prefer roster_id IS NULL (already shared), then lowest sort_order, then lowest id.
  const r = await pool.query(
    `
    WITH ranked AS (
      SELECT id, roster_id, ${keyExpr} AS k,
             CASE WHEN roster_id IS NULL THEN 0 ELSE 1 END AS null_pri,
             COALESCE(NULLIF(sort_order::text, '')::int, 999999) AS s_ord
      FROM ${table}
      WHERE team_id = $1 AND game_id = $2
    ),
    chosen AS (
      SELECT DISTINCT ON (k) id AS canonical_id, k
      FROM ranked
      ORDER BY k, null_pri ASC, s_ord ASC, id ASC
    )
    SELECT r.id AS old_id, r.roster_id, c.canonical_id, r.k AS k
    FROM ranked r
    JOIN chosen c ON c.k = r.k
    `,
    [teamId, gameId],
  );

  const canonicalIds: string[] = [];
  const remap: Array<{ old: string; canon: string }> = [];
  const toShare: string[] = [];
  const seenCanon = new Set<string>();

  for (const row of r.rows as any[]) {
    if (!seenCanon.has(row.canonical_id)) {
      canonicalIds.push(row.canonical_id);
      seenCanon.add(row.canonical_id);
    }
    if (row.old_id === row.canonical_id) {
      // canonical row itself — schedule for sharing if currently roster-scoped
      if (row.roster_id !== null) toShare.push(row.old_id);
    } else {
      remap.push({ old: row.old_id, canon: row.canonical_id });
    }
  }
  return { canonicalIds, remap, toShare };
}

async function repointAndDelete(
  table: string,
  remap: Array<{ old: string; canon: string }>,
  fkUpdates: Array<{ table: string; col: string }>,
): Promise<{ deleted: number }> {
  if (remap.length === 0) return { deleted: 0 };
  const oldIds = remap.map(m => m.old);
  const canonIds = remap.map(m => m.canon);

  // Bulk UPDATE FK tables using unnest of two arrays.
  for (const fk of fkUpdates) {
    await pool.query(
      `
      UPDATE ${fk.table} t
      SET ${fk.col} = m.canon_id
      FROM (SELECT unnest($1::text[]) AS old_id, unnest($2::text[]) AS canon_id) m
      WHERE t.${fk.col} = m.old_id
      `,
      [oldIds, canonIds],
    );
  }
  const del = await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [oldIds]);
  return { deleted: del.rowCount || 0 };
}

async function shareCanonicals(table: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await pool.query(`UPDATE ${table} SET roster_id = NULL WHERE id = ANY($1::text[])`, [ids]);
  return r.rowCount || 0;
}

async function dedupeOne(
  table: string,
  keyExpr: string,
  fkUpdates: Array<{ table: string; col: string }>,
): Promise<{ deleted: number; shared: number; scopes: number }> {
  let deleted = 0;
  let shared = 0;
  const scopes = await getScopesWithRosterId(table);
  for (const { team_id, game_id } of scopes) {
    const { remap, toShare } = await buildMappingFor(table, team_id, game_id, keyExpr);
    const { deleted: d } = await repointAndDelete(table, remap, fkUpdates);
    const s = await shareCanonicals(table, toShare);
    deleted += d;
    shared += s;
  }
  return { deleted, shared, scopes: scopes.length };
}

export async function dedupeGameScopedEntities(): Promise<void> {
  const t0 = Date.now();
  try {
    await ensureFkIndexes();

    console.log(`[dedupe-game-scoped] heroes: starting...`);
    const heroes = await dedupeOne("heroes", "lower(name) || '|' || COALESCE(lower(role), '')", [
      { table: "game_heroes", col: "hero_id" },
      { table: "game_hero_ban_actions", col: "hero_id" },
    ]);
    console.log(`[dedupe-game-scoped] heroes: scopes=${heroes.scopes} deleted=${heroes.deleted} shared=${heroes.shared}`);

    console.log(`[dedupe-game-scoped] maps: starting...`);
    const maps = await dedupeOne("maps", "lower(name)", [
      { table: "games", col: "map_id" },
      { table: "game_map_veto_rows", col: "map_id" },
    ]);
    console.log(`[dedupe-game-scoped] maps: scopes=${maps.scopes} deleted=${maps.deleted} shared=${maps.shared}`);

    console.log(`[dedupe-game-scoped] game_modes: starting...`);
    const gameModes = await dedupeOne("game_modes", "lower(name)", [
      { table: "games", col: "game_mode_id" },
      { table: "stat_fields", col: "game_mode_id" },
      { table: "maps", col: "game_mode_id" },
    ]);
    console.log(`[dedupe-game-scoped] game_modes: scopes=${gameModes.scopes} deleted=${gameModes.deleted} shared=${gameModes.shared}`);

    const ms = Date.now() - t0;
    console.log(`[dedupe-game-scoped] complete in ${ms}ms`);
  } catch (e: any) {
    console.error("[dedupe-game-scoped] Failed:", e?.message || e);
  }
}
