import { pool } from "../db";

/**
 * Cleans up legacy "ghost" rows in `game_modes`, `maps`, and `stat_fields`
 * that were created by two pre-fix bugs:
 *
 *   1. `addGameMode` / `addMap` in storage.ts forced `roster_id = NULL` on
 *      every insert, so manually-added modes/maps became game-wide rows
 *      that leaked across all rosters of the same team+game.
 *   2. The older `dedupeGameScopedEntities` migration (run on every boot)
 *      preferred a `roster_id IS NULL` canonical row and re-pointed all
 *      cross-roster FKs at it via a `shareCanonicals(... SET roster_id =
 *      NULL)` step. This is the opposite of the roster-scoped model that
 *      `applyGameTemplate` uses (it inserts rows with `roster_id = R`),
 *      and the two together produced duplicates like the user-reported
 *      twin "Convergence" rows on Marvel Rivals plus phantom "Game Mode
 *      1/2/3" placeholders that survived from `seed-comprehensive` and
 *      `roster-reset`.
 *
 * Strategy — three phases, run in order. All work is idempotent: if no
 * orphans remain, the migration is a no-op.
 *
 *   Phase 1: For each null-rostered row in {game_modes, maps, stat_fields},
 *     find the distinct set of rosters whose data references it via
 *     FK-pointing tables. 0 referencing rosters => DELETE. 1 => UPDATE
 *     `roster_id`. N => CLONE per roster (new UUID), repoint that roster's
 *     FKs at the clone, then DELETE the original null row.
 *
 *   Phase 2: Within each (team_id, game_id, roster_id, lower(name)),
 *     keep the oldest row (lowest sort_order, then lowest id) and repoint
 *     all FKs from duplicates to the keeper, then DELETE the duplicates.
 *
 *   Phase 3: Install unique partial indexes (CREATE UNIQUE INDEX IF NOT
 *     EXISTS … WHERE roster_id IS NOT NULL) on all three tables to stop
 *     duplicates being inserted by future bugs.
 *
 * Logging: per-table counters are printed at the end of each phase so
 * "how many orphans deleted per table" is answerable from the boot log.
 */

type Counters = { deleted: number; claimed: number; cloned: number; deduped: number };

function newCounters(): Counters {
  return { deleted: 0, claimed: 0, cloned: 0, deduped: 0 };
}

/**
 * For a single null-rostered row in `table`, return the distinct set of
 * roster_ids in the team+game that reference it via the supplied FK paths.
 * Empty set => true orphan, no data depends on it. Single-element set =>
 * the row "belongs" to exactly one roster and can be reassigned in place.
 */
async function findReferencingRosters(
  rowId: string,
  fkPaths: Array<{ sql: string; params: any[] }>,
): Promise<string[]> {
  const seen = new Set<string>();
  for (const fk of fkPaths) {
    const r = await pool.query(fk.sql, [rowId, ...fk.params]);
    for (const row of r.rows as Array<{ roster_id: string | null }>) {
      if (row.roster_id) seen.add(row.roster_id);
    }
  }
  return Array.from(seen);
}

/**
 * Phase 1 — reassign / clone / delete null-rostered rows. The per-table
 * `referencingRostersFor` returns the SQL queries that, for a given row id,
 * yield the roster_ids whose data references it. The `repointForClone`
 * callback runs whenever we clone a null row into a per-roster copy and
 * needs to redirect that roster's FKs to point at the clone instead.
 */
async function reassignOrphans(
  table: string,
  referencingRostersFor: (rowId: string) => Promise<string[]>,
  repointForClone: (originalId: string, cloneId: string, rosterId: string) => Promise<void>,
  // FK columns that may reference this row in OTHER tables. Before we
  // delete an orphan we explicitly NULL these out — the live DB
  // constraints were not always created with `ON DELETE SET NULL` even
  // though shared/schema.ts declares them that way, which would otherwise
  // raise a foreign_key_violation.
  inboundFks: Array<{ table: string; col: string }>,
  counters: Counters,
): Promise<void> {
  const orphans = await pool.query(
    `SELECT id, team_id, game_id FROM ${table} WHERE roster_id IS NULL`,
  );
  for (const row of orphans.rows as Array<{ id: string; team_id: string | null; game_id: string | null }>) {
    const rosters = await referencingRostersFor(row.id);
    if (rosters.length === 0) {
      // True orphan — no roster's data depends on this row. Null out any
      // remaining FK pointers (typically other null-rostered config rows
      // or stray uncategorized data) and delete.
      for (const fk of inboundFks) {
        await pool.query(`UPDATE ${fk.table} SET ${fk.col} = NULL WHERE ${fk.col} = $1`, [row.id]);
      }
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
      counters.deleted++;
      continue;
    }
    if (rosters.length === 1) {
      // Single owner — claim in place.
      await pool.query(`UPDATE ${table} SET roster_id = $1 WHERE id = $2`, [rosters[0], row.id]);
      counters.claimed++;
      continue;
    }
    // Multiple owners — clone the row per roster with a fresh UUID and
    // the proper roster_id, repoint that roster's FKs at the clone, then
    // drop the original null row at the end.
    for (const rosterId of rosters) {
      const newId = (await pool.query(`SELECT gen_random_uuid()::text AS id`)).rows[0].id as string;
      await pool.query(
        `INSERT INTO ${table} (id, team_id, game_id, roster_id, ${columnNamesExceptIdTeamGameRoster(table).join(", ")})
         SELECT $1::text, t.team_id, t.game_id, $2::text, ${columnsExceptIdTeamGameRoster(table).join(", ")}
         FROM ${table} t WHERE t.id = $3`,
        [newId, rosterId, row.id],
      );
      await repointForClone(row.id, newId, rosterId);
      counters.cloned++;
    }
    // Same FK cleanup before deleting the original null row — any
    // remaining references would be from null-rostered descendants which
    // are themselves about to be processed.
    for (const fk of inboundFks) {
      await pool.query(`UPDATE ${fk.table} SET ${fk.col} = NULL WHERE ${fk.col} = $1`, [row.id]);
    }
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
  }
}

// Hard-coded column projection per table so cloning doesn't require an
// `information_schema` round-trip. Keep in sync with shared/schema.ts.
// `columnNamesExceptIdTeamGameRoster` returns the bare column names for
// the INSERT target column list; `columnsExceptIdTeamGameRoster` returns
// the same columns prefixed with the SELECT alias `t.`.
function columnNamesExceptIdTeamGameRoster(table: string): string[] {
  switch (table) {
    case "game_modes":
      return [
        "name", "sort_order", "score_type", "max_score",
        "max_round_wins", "max_rounds_per_game", "max_score_per_round_per_side",
      ];
    case "maps":
      return ["name", "game_mode_id", "image_url", "sort_order"];
    case "stat_fields":
      return ["name", "game_mode_id", "created_at"];
    default:
      throw new Error(`columnNamesExceptIdTeamGameRoster: unknown table ${table}`);
  }
}
function columnsExceptIdTeamGameRoster(table: string): string[] {
  return columnNamesExceptIdTeamGameRoster(table).map(c => `t.${c}`);
}

/**
 * Phase 2 — within each (team_id, game_id, roster_id, lower(name)) bucket,
 * pick one keeper (oldest sort_order, then lowest id) and re-point all
 * referencing FKs at it before deleting the duplicates. `keyExpr` allows
 * stat_fields to also key on game_mode_id (the same field name across two
 * different modes is legitimate).
 */
async function dedupeWithinRoster(
  table: string,
  keyExpr: string,
  fkUpdates: Array<{ table: string; col: string }>,
  counters: Counters,
): Promise<void> {
  const r = await pool.query(`
    WITH ranked AS (
      SELECT id, ${keyExpr} AS k,
             COALESCE(NULLIF(sort_order::text, '')::int, 999999) AS s_ord
      FROM ${table}
      WHERE roster_id IS NOT NULL
    ),
    chosen AS (
      SELECT DISTINCT ON (k) id AS keeper_id, k
      FROM ranked
      ORDER BY k, s_ord ASC, id ASC
    )
    SELECT r.id AS dup_id, c.keeper_id
    FROM ranked r
    JOIN chosen c ON c.k = r.k
    WHERE r.id <> c.keeper_id
  `);
  if (r.rowCount === 0) return;
  const dupIds = r.rows.map((row: any) => row.dup_id as string);
  const keeperIds = r.rows.map((row: any) => row.keeper_id as string);
  for (const fk of fkUpdates) {
    await pool.query(
      `UPDATE ${fk.table} t
         SET ${fk.col} = m.keeper_id
       FROM (SELECT unnest($1::text[]) AS dup_id, unnest($2::text[]) AS keeper_id) m
       WHERE t.${fk.col} = m.dup_id`,
      [dupIds, keeperIds],
    );
  }
  const del = await pool.query(`DELETE FROM ${table} WHERE id = ANY($1::text[])`, [dupIds]);
  counters.deduped += del.rowCount || 0;
}

// Stat fields don't have a sort_order column — its key needs to fall back
// to created_at (text) for tie-breaking. Use a parallel implementation so
// the main `dedupeWithinRoster` query stays simple.
async function dedupeStatFields(counters: Counters): Promise<void> {
  const r = await pool.query(`
    WITH ranked AS (
      SELECT id,
             team_id || '|' || game_id || '|' || roster_id ||
               '|' || lower(name) || '|' || COALESCE(game_mode_id, '') AS k
      FROM stat_fields
      WHERE roster_id IS NOT NULL AND team_id IS NOT NULL AND game_id IS NOT NULL
    ),
    chosen AS (
      SELECT DISTINCT ON (k) id AS keeper_id, k
      FROM ranked
      ORDER BY k, id ASC
    )
    SELECT r.id AS dup_id, c.keeper_id
    FROM ranked r
    JOIN chosen c ON c.k = r.k
    WHERE r.id <> c.keeper_id
  `);
  if (r.rowCount === 0) return;
  const dupIds = r.rows.map((row: any) => row.dup_id as string);
  const keeperIds = r.rows.map((row: any) => row.keeper_id as string);
  // Repoint BOTH stat-bearing tables before deleting the duplicates so
  // we don't orphan opposing-team rows.
  await pool.query(
    `UPDATE player_game_stats t
       SET stat_field_id = m.keeper_id
     FROM (SELECT unnest($1::text[]) AS dup_id, unnest($2::text[]) AS keeper_id) m
     WHERE t.stat_field_id = m.dup_id`,
    [dupIds, keeperIds],
  );
  await pool.query(
    `UPDATE opponent_player_game_stats t
       SET stat_field_id = m.keeper_id
     FROM (SELECT unnest($1::text[]) AS dup_id, unnest($2::text[]) AS keeper_id) m
     WHERE t.stat_field_id = m.dup_id`,
    [dupIds, keeperIds],
  );
  const del = await pool.query(`DELETE FROM stat_fields WHERE id = ANY($1::text[])`, [dupIds]);
  counters.deduped += del.rowCount || 0;
}

/**
 * Phase 3 — partial unique indexes that prevent the duplicates we just
 * cleaned up from coming back. `WHERE roster_id IS NOT NULL` is required
 * because we only enforce uniqueness inside a roster; legacy null-rostered
 * rows shouldn't exist post-cleanup, but the predicate keeps Postgres
 * happy if anything sneaks through.
 */
async function ensureUniqueIndexes(): Promise<void> {
  const stmts = [
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_game_modes_team_game_roster_name
       ON game_modes (team_id, game_id, roster_id, lower(name))
       WHERE roster_id IS NOT NULL AND team_id IS NOT NULL AND game_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_maps_team_game_roster_name
       ON maps (team_id, game_id, roster_id, lower(name))
       WHERE roster_id IS NOT NULL AND team_id IS NOT NULL AND game_id IS NOT NULL`,
    // stat_fields can legitimately share a name across game_modes (e.g.
    // "Kill" exists for every mode), so include game_mode_id in the key.
    // COALESCE handles single-mode games where game_mode_id is null.
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_stat_fields_team_game_roster_mode_name
       ON stat_fields (team_id, game_id, roster_id, COALESCE(game_mode_id, ''), lower(name))
       WHERE roster_id IS NOT NULL AND team_id IS NOT NULL AND game_id IS NOT NULL`,
  ];
  // Failures here are NOT swallowed — these are the long-term guardrails
  // that keep ghosts from coming back. If one cannot be created (typically
  // because dedupe missed a duplicate), surface it loudly so the boot log
  // and architect review catches it.
  for (const s of stmts) {
    await pool.query(s);
  }
}

/**
 * Best-effort indexes that make Phase 2 dedupe fast even when the FK
 * source tables are huge (1M+ rows for player_game_stats etc). Created
 * idempotently before any DML.
 */
async function ensureFkIndexes(): Promise<void> {
  const stmts = [
    `CREATE INDEX IF NOT EXISTS idx_player_game_stats_stat_field_id ON player_game_stats(stat_field_id)`,
    `CREATE INDEX IF NOT EXISTS idx_games_game_mode_id ON games(game_mode_id)`,
    `CREATE INDEX IF NOT EXISTS idx_games_map_id ON games(map_id)`,
    `CREATE INDEX IF NOT EXISTS idx_maps_game_mode_id ON maps(game_mode_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stat_fields_game_mode_id ON stat_fields(game_mode_id)`,
    `CREATE INDEX IF NOT EXISTS idx_game_map_veto_rows_map_id ON game_map_veto_rows(map_id)`,
  ];
  for (const s of stmts) {
    try { await pool.query(s); } catch (e: any) {
      console.warn(`[cleanup-ghost-config-rows] fk-index skipped: ${e?.message || e}`);
    }
  }
}

// Stable advisory-lock key for this migration. Any 64-bit signed integer
// works; chosen at random to avoid colliding with other lock users.
// Stored as a string so the literal is safe under sub-ES2020 TS targets;
// pg accepts numeric strings for bigint params.
const ADVISORY_LOCK_KEY = "8412379056123047";

export async function cleanupGhostConfigRows(): Promise<void> {
  const t0 = Date.now();
  // Concurrency fence: only one process at a time runs the cleanup. Other
  // boot/admin runs return immediately rather than racing on dedupe and
  // index creation. Lock is released on connection close even if we crash.
  const lockClient = await pool.connect();
  let acquired = false;
  try {
    const got = await lockClient.query(
      `SELECT pg_try_advisory_lock($1::bigint) AS got`,
      [ADVISORY_LOCK_KEY],
    );
    acquired = got.rows[0]?.got === true;
    if (!acquired) {
      console.log(`[cleanup-ghost-config-rows] another instance holds the advisory lock; skipping`);
      return;
    }
    console.log(`[cleanup-ghost-config-rows] starting…`);
    await ensureFkIndexes();
    console.log(`[cleanup-ghost-config-rows] fk indexes ready (+${Date.now() - t0}ms)`);
    const modeCounts = newCounters();
    const mapCounts = newCounters();
    const fieldCounts = newCounters();

    // ── Phase 1: reassign null-rostered orphans by FK reference. ──────
    // Process gameModes FIRST so cloned modes get their dependent rows
    // (maps / stat_fields / games) repointed correctly. Then maps and
    // stat_fields whose own owners have been resolved.

    await reassignOrphans(
      "game_modes",
      async (id) => findReferencingRosters(id, [
        { sql: `SELECT DISTINCT roster_id FROM games WHERE game_mode_id = $1 AND roster_id IS NOT NULL`, params: [] },
        { sql: `SELECT DISTINCT roster_id FROM maps WHERE game_mode_id = $1 AND roster_id IS NOT NULL`, params: [] },
        { sql: `SELECT DISTINCT roster_id FROM stat_fields WHERE game_mode_id = $1 AND roster_id IS NOT NULL`, params: [] },
      ]),
      async (originalId, cloneId, rosterId) => {
        // Repoint this roster's FKs at the cloned per-roster mode.
        await pool.query(`UPDATE games SET game_mode_id = $1 WHERE game_mode_id = $2 AND roster_id = $3`, [cloneId, originalId, rosterId]);
        await pool.query(`UPDATE maps SET game_mode_id = $1 WHERE game_mode_id = $2 AND roster_id = $3`, [cloneId, originalId, rosterId]);
        await pool.query(`UPDATE stat_fields SET game_mode_id = $1 WHERE game_mode_id = $2 AND roster_id = $3`, [cloneId, originalId, rosterId]);
      },
      [
        { table: "games", col: "game_mode_id" },
        { table: "maps", col: "game_mode_id" },
        { table: "stat_fields", col: "game_mode_id" },
      ],
      modeCounts,
    );

    await reassignOrphans(
      "maps",
      async (id) => findReferencingRosters(id, [
        { sql: `SELECT DISTINCT roster_id FROM games WHERE map_id = $1 AND roster_id IS NOT NULL`, params: [] },
        // game_map_veto_rows can legitimately reference a map without games
        // doing so yet (mid-veto state). Include them in ownership.
        { sql: `SELECT DISTINCT roster_id FROM game_map_veto_rows WHERE map_id = $1 AND roster_id IS NOT NULL`, params: [] },
      ]),
      async (originalId, cloneId, rosterId) => {
        await pool.query(`UPDATE games SET map_id = $1 WHERE map_id = $2 AND roster_id = $3`, [cloneId, originalId, rosterId]);
        await pool.query(`UPDATE game_map_veto_rows SET map_id = $1 WHERE map_id = $2 AND roster_id = $3`, [cloneId, originalId, rosterId]);
      },
      [
        { table: "games", col: "map_id" },
        { table: "game_map_veto_rows", col: "map_id" },
      ],
      mapCounts,
    );

    await reassignOrphans(
      "stat_fields",
      async (id) => findReferencingRosters(id, [
        // player_game_stats has no roster_id column — derive via the
        // games table (matchId → games.id → games.rosterId).
        { sql: `SELECT DISTINCT g.roster_id
                  FROM player_game_stats pgs
                  JOIN games g ON g.id = pgs.match_id
                 WHERE pgs.stat_field_id = $1 AND g.roster_id IS NOT NULL`, params: [] },
        // opponent_player_game_stats has the same shape as player_game_stats
        // and the same FK to stat_fields. Include it so opposing-team stat
        // entries also count toward stat_field ownership.
        { sql: `SELECT DISTINCT g.roster_id
                  FROM opponent_player_game_stats opgs
                  JOIN games g ON g.id = opgs.match_id
                 WHERE opgs.stat_field_id = $1 AND g.roster_id IS NOT NULL`, params: [] },
      ]),
      async (originalId, cloneId, rosterId) => {
        await pool.query(
          `UPDATE player_game_stats pgs
              SET stat_field_id = $1
            FROM games g
           WHERE g.id = pgs.match_id
             AND pgs.stat_field_id = $2
             AND g.roster_id = $3`,
          [cloneId, originalId, rosterId],
        );
        await pool.query(
          `UPDATE opponent_player_game_stats opgs
              SET stat_field_id = $1
            FROM games g
           WHERE g.id = opgs.match_id
             AND opgs.stat_field_id = $2
             AND g.roster_id = $3`,
          [cloneId, originalId, rosterId],
        );
      },
      [
        { table: "player_game_stats", col: "stat_field_id" },
        { table: "opponent_player_game_stats", col: "stat_field_id" },
      ],
      fieldCounts,
    );

    // Re-run modes pass: descendants (maps / stat_fields) just got claimed
    // above, so any mode previously referenced only through null-rostered
    // descendants now has discoverable owners. Iterating once more catches
    // those without changing the cloning semantics for the first pass.
    await reassignOrphans(
      "game_modes",
      async (id) => findReferencingRosters(id, [
        { sql: `SELECT DISTINCT roster_id FROM games WHERE game_mode_id = $1 AND roster_id IS NOT NULL`, params: [] },
        { sql: `SELECT DISTINCT roster_id FROM maps WHERE game_mode_id = $1 AND roster_id IS NOT NULL`, params: [] },
        { sql: `SELECT DISTINCT roster_id FROM stat_fields WHERE game_mode_id = $1 AND roster_id IS NOT NULL`, params: [] },
      ]),
      async (originalId, cloneId, rosterId) => {
        await pool.query(`UPDATE games SET game_mode_id = $1 WHERE game_mode_id = $2 AND roster_id = $3`, [cloneId, originalId, rosterId]);
        await pool.query(`UPDATE maps SET game_mode_id = $1 WHERE game_mode_id = $2 AND roster_id = $3`, [cloneId, originalId, rosterId]);
        await pool.query(`UPDATE stat_fields SET game_mode_id = $1 WHERE game_mode_id = $2 AND roster_id = $3`, [cloneId, originalId, rosterId]);
      },
      [
        { table: "games", col: "game_mode_id" },
        { table: "maps", col: "game_mode_id" },
        { table: "stat_fields", col: "game_mode_id" },
      ],
      modeCounts,
    );

    console.log(`[cleanup-ghost-config-rows] phase1 done (+${Date.now() - t0}ms): game_modes ${JSON.stringify(modeCounts)} maps ${JSON.stringify(mapCounts)} stat_fields ${JSON.stringify(fieldCounts)}`);

    // ── Phase 2: dedupe within (team, game, roster, lower(name)). ──────

    await dedupeWithinRoster(
      "game_modes",
      "team_id || '|' || game_id || '|' || roster_id || '|' || lower(name)",
      [
        { table: "games", col: "game_mode_id" },
        { table: "maps", col: "game_mode_id" },
        { table: "stat_fields", col: "game_mode_id" },
      ],
      modeCounts,
    );
    console.log(`[cleanup-ghost-config-rows] phase2.modes done (+${Date.now() - t0}ms): deduped=${modeCounts.deduped}`);
    await dedupeWithinRoster(
      "maps",
      "team_id || '|' || game_id || '|' || roster_id || '|' || lower(name)",
      [
        { table: "games", col: "map_id" },
        { table: "game_map_veto_rows", col: "map_id" },
      ],
      mapCounts,
    );
    console.log(`[cleanup-ghost-config-rows] phase2.maps done (+${Date.now() - t0}ms): deduped=${mapCounts.deduped}`);
    await dedupeStatFields(fieldCounts);
    console.log(`[cleanup-ghost-config-rows] phase2.stat_fields done (+${Date.now() - t0}ms): deduped=${fieldCounts.deduped}`);

    // ── Phase 3: lock the door behind us. ────────────────────────────
    await ensureUniqueIndexes();

    const ms = Date.now() - t0;
    console.log(`[cleanup-ghost-config-rows] complete in ${ms}ms`);
  } catch (e: any) {
    console.error("[cleanup-ghost-config-rows] Failed:", e?.message || e);
  } finally {
    if (acquired) {
      try {
        await lockClient.query(`SELECT pg_advisory_unlock($1::bigint)`, [ADVISORY_LOCK_KEY]);
      } catch {
        // ignore — the lock will release on connection close anyway
      }
    }
    lockClient.release();
  }
}
