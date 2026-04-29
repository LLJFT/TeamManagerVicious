import { pool } from "../db";

type Scope = { team_id: string; game_id: string };
type Row = { id: string; name: string; roster_id: string | null; sort_order: number };

async function getScopesWithRosterId(table: string): Promise<Scope[]> {
  const r = await pool.query(
    `SELECT DISTINCT team_id, game_id FROM ${table} WHERE roster_id IS NOT NULL AND team_id IS NOT NULL AND game_id IS NOT NULL`
  );
  return r.rows as Scope[];
}

async function pickCanonicalRoster(
  table: string,
  teamId: string,
  gameId: string,
): Promise<string | null> {
  const r = await pool.query(
    `
    SELECT t.roster_id, COUNT(*)::int AS cnt, COALESCE(rs.sort_order, 999999)::int AS s_ord
    FROM ${table} t
    LEFT JOIN rosters rs ON rs.id = t.roster_id
    WHERE t.team_id = $1 AND t.game_id = $2 AND t.roster_id IS NOT NULL
    GROUP BY t.roster_id, rs.sort_order
    ORDER BY cnt DESC, s_ord ASC, t.roster_id ASC
    LIMIT 1
    `,
    [teamId, gameId],
  );
  return (r.rows[0]?.roster_id as string) ?? null;
}

async function rowsForScope(table: string, teamId: string, gameId: string): Promise<Row[]> {
  const r = await pool.query(
    `SELECT id, name, roster_id, sort_order::text AS sort_order FROM ${table} WHERE team_id = $1 AND game_id = $2`,
    [teamId, gameId],
  );
  return r.rows.map((row: any) => ({ ...row, sort_order: Number(row.sort_order) || 0 })) as Row[];
}

async function rowsForGame(table: string, teamId: string, gameId: string, rosterIdOrNull: string | null): Promise<Row[]> {
  const where = rosterIdOrNull === null
    ? `team_id = $1 AND game_id = $2 AND roster_id IS NULL`
    : `team_id = $1 AND game_id = $2 AND roster_id = $3`;
  const params = rosterIdOrNull === null ? [teamId, gameId] : [teamId, gameId, rosterIdOrNull];
  const r = await pool.query(
    `SELECT id, name, roster_id, sort_order::text AS sort_order FROM ${table} WHERE ${where}`,
    params,
  );
  return r.rows.map((row: any) => ({ ...row, sort_order: Number(row.sort_order) || 0 })) as Row[];
}

async function repointHeroFKs(oldId: string, newId: string): Promise<void> {
  await pool.query(`UPDATE game_heroes SET hero_id = $1 WHERE hero_id = $2`, [newId, oldId]);
  await pool.query(`UPDATE game_hero_ban_actions SET hero_id = $1 WHERE hero_id = $2`, [newId, oldId]);
}

async function repointMapFKs(oldId: string, newId: string): Promise<void> {
  await pool.query(`UPDATE games SET map_id = $1 WHERE map_id = $2`, [newId, oldId]);
  await pool.query(`UPDATE game_map_veto_rows SET map_id = $1 WHERE map_id = $2`, [newId, oldId]);
}

async function repointGameModeFKs(oldId: string, newId: string): Promise<void> {
  await pool.query(`UPDATE games SET game_mode_id = $1 WHERE game_mode_id = $2`, [newId, oldId]);
  await pool.query(`UPDATE stat_fields SET game_mode_id = $1 WHERE game_mode_id = $2`, [newId, oldId]);
  await pool.query(`UPDATE maps SET game_mode_id = $1 WHERE game_mode_id = $2`, [newId, oldId]);
}

type Repointer = (oldId: string, newId: string) => Promise<void>;

async function dedupeOne(table: string, repoint: Repointer): Promise<{ deleted: number; nulled: number }> {
  let totalDeleted = 0;
  let totalNulled = 0;
  const scopes = await getScopesWithRosterId(table);
  for (const { team_id, game_id } of scopes) {
    const canonicalRoster = await pickCanonicalRoster(table, team_id, game_id);
    if (!canonicalRoster) continue;
    const rows = await rowsForScope(table, team_id, game_id);

    // Build canonical map: prefer existing NULL (already-shared) rows, then canonical-roster rows.
    const canonicalByName = new Map<string, Row>();
    for (const row of rows) {
      if (row.roster_id === null) {
        canonicalByName.set(row.name.toLowerCase(), row);
      }
    }
    for (const row of rows) {
      if (row.roster_id === canonicalRoster && !canonicalByName.has(row.name.toLowerCase())) {
        canonicalByName.set(row.name.toLowerCase(), row);
      }
    }

    // Process all roster-scoped rows (including canonical roster) — merge into canonical NULL row if one exists.
    for (const row of rows) {
      if (row.roster_id === null) continue;
      const canon = canonicalByName.get(row.name.toLowerCase());
      if (canon && canon.id !== row.id) {
        await repoint(row.id, canon.id);
        await pool.query(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
        totalDeleted++;
      } else {
        await pool.query(`UPDATE ${table} SET roster_id = NULL WHERE id = $1`, [row.id]);
        canonicalByName.set(row.name.toLowerCase(), { ...row, roster_id: null });
        totalNulled++;
      }
    }
  }
  return { deleted: totalDeleted, nulled: totalNulled };
}

export async function dedupeGameScopedEntities(): Promise<void> {
  try {
    await pool.query("BEGIN");
    const heroes = await dedupeOne("heroes", repointHeroFKs);
    const maps = await dedupeOne("maps", repointMapFKs);
    const gameModes = await dedupeOne("game_modes", repointGameModeFKs);
    await pool.query("COMMIT");
    if (heroes.deleted || heroes.nulled || maps.deleted || maps.nulled || gameModes.deleted || gameModes.nulled) {
      console.log(
        `[dedupe-game-scoped] heroes: deleted=${heroes.deleted} shared=${heroes.nulled} | maps: deleted=${maps.deleted} shared=${maps.nulled} | game_modes: deleted=${gameModes.deleted} shared=${gameModes.nulled}`
      );
    }
  } catch (e: any) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("[dedupe-game-scoped] Failed:", e?.message || e);
  }
}
