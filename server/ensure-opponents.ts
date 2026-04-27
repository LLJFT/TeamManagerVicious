import { db, pool } from "./db";
import { opponents, rosters, supportedGames } from "@shared/schema";
import { sql, eq } from "drizzle-orm";
import { OPPONENT_SEEDS_BY_GAME_SLUG } from "./defaults/realOpponents";

// Per-roster idempotent opponent seeder.
// For every roster that currently has ZERO opponents, insert the canonical
// real-team list for that game (logos left empty so the UI fallback shows initials).
// Safe to call repeatedly on every boot.

const OPP_SEED_LOCK_KEY = 0x4f50_5053; // "OPPS"

export async function ensureOpponents(): Promise<void> {
  try {
    // Defensive: ensure the region column exists even if `npm run db:push` was not run.
    await pool.query(`ALTER TABLE opponents ADD COLUMN IF NOT EXISTS region text`);
    // Defensive: make sure name+roster uniqueness is enforced at DB level too.
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS opponents_team_game_roster_name_uniq
         ON opponents(team_id, game_id, roster_id, name)
         WHERE team_id IS NOT NULL AND game_id IS NOT NULL AND roster_id IS NOT NULL`
    );

    const games = await db.select().from(supportedGames);
    const slugs = Object.keys(OPPONENT_SEEDS_BY_GAME_SLUG);

    let totalSeeded = 0;
    let rostersTouched = 0;

    for (const game of games) {
      const seedList = OPPONENT_SEEDS_BY_GAME_SLUG[game.slug];
      if (!seedList || seedList.length === 0) continue;

      const gameRosters = await db.select().from(rosters).where(eq(rosters.gameId, game.id));
      if (gameRosters.length === 0) continue;

      for (const roster of gameRosters) {
        const teamId = roster.teamId;
        if (!teamId) continue;

        await db.transaction(async (tx) => {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(${OPP_SEED_LOCK_KEY}::int, hashtext(${roster.id})::int)`
          );

          const cntRows = await tx.execute<{ cnt: number }>(
            sql`SELECT COUNT(*)::int AS cnt FROM opponents
                WHERE team_id = ${teamId} AND game_id = ${game.id} AND roster_id = ${roster.id}`
          );
          const cnt = Number((cntRows.rows as any[])[0]?.cnt || 0);
          if (cnt > 0) return;

          const rows = seedList.map((opp, idx) => ({
            teamId,
            gameId: game.id,
            rosterId: roster.id,
            name: opp.name,
            shortName: opp.shortName ?? null,
            logoUrl: null as string | null,
            region: opp.region,
            notes: null as string | null,
            isActive: true,
            sortOrder: idx,
          }));

          await tx.insert(opponents).values(rows).onConflictDoNothing();
          rostersTouched += 1;
          totalSeeded += rows.length;
        });
      }

      console.log(`[opponents] Game "${game.slug}": seeded across ${gameRosters.length} roster(s).`);
    }

    if (totalSeeded === 0) {
      console.log(`[opponents] All rosters across ${slugs.length} supported games already populated — nothing to do.`);
    } else {
      console.log(`[opponents] Done. Inserted ${totalSeeded} opponent rows across ${rostersTouched} roster(s).`);
    }
  } catch (err) {
    console.error("[opponents] FAILED — opponent seed did not complete:", err);
    // Do not crash boot.
  }
}
