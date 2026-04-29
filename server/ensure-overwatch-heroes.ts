import { db, pool } from "./db";
import { heroes, rosters, supportedGames, settings } from "@shared/schema";
import { sql, and, eq } from "drizzle-orm";
import { OVERWATCH_DEFAULT_HEROES, OVERWATCH_GAME_SLUG } from "./defaults/overwatchHeroes";
import { HEROES_SEEDED_SETTING_KEY } from "./defaults/marvelRivalsHeroes";

// Stable 32-bit lock key — derived from a fixed string so concurrent seeders
// (boot vs lazy GET /api/heroes) serialize against each other.
export const HEROES_SEED_LOCK_KEY = 0x4f57_5345; // "OWSE"

// Defense-in-depth: ensure no two heroes share the same (team, game, roster, name, role).
// Marvel's intentional Deadpool×3 (one per role) is preserved because role is part of the key.
async function ensureHeroesUniqueIndex(): Promise<void> {
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS heroes_team_game_roster_name_role_uniq
       ON heroes(team_id, game_id, roster_id, name, role)`
  );
}

export async function ensureOverwatchHeroes(): Promise<void> {
  try {
    await ensureHeroesUniqueIndex();

    const [game] = await db.select().from(supportedGames).where(eq(supportedGames.slug, OVERWATCH_GAME_SLUG)).limit(1);
    if (!game) {
      console.log(`[overwatch-heroes] No supported game with slug "${OVERWATCH_GAME_SLUG}" — skipping.`);
      return;
    }
    const gameId = game.id;

    const owRosters = await db.select().from(rosters).where(eq(rosters.gameId, gameId));
    if (owRosters.length === 0) {
      console.log(`[overwatch-heroes] No rosters for Overwatch — nothing to seed.`);
      return;
    }

    let seededRosters = 0;
    let totalInserted = 0;

    for (const roster of owRosters) {
      const teamId = roster.teamId;
      if (!teamId) continue;

      // Serialize against any concurrent seeder (boot or lazy) for this exact (game, roster).
      // pg_advisory_xact_lock(int4, int4) takes 2 ints; we use a constant + hashtext of the rosterId.
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${HEROES_SEED_LOCK_KEY}::int, hashtext(${roster.id})::int)`);

        const cntRows = await tx.execute<{ cnt: number }>(
          sql`SELECT COUNT(*)::int AS cnt FROM heroes WHERE team_id = ${teamId} AND game_id = ${gameId} AND (roster_id IS NULL OR roster_id = ${roster.id})`
        );
        const cnt = Number((cntRows.rows as any[])[0]?.cnt || 0);
        if (cnt > 0) return; // already seeded by something else; nothing to do

        const rows = OVERWATCH_DEFAULT_HEROES.map(h => ({
          teamId,
          gameId,
          rosterId: roster.id,
          name: h.name,
          role: h.role,
          imageUrl: null,
          isActive: true,
          sortOrder: h.sortOrder,
        }));

        await tx.insert(heroes).values(rows).onConflictDoNothing();

        // Set the seeded flag AFTER the insert succeeds — same transaction guarantees atomicity.
        const existingFlag = await tx.select().from(settings).where(and(
          eq(settings.teamId, teamId),
          eq(settings.gameId, gameId),
          eq(settings.rosterId, roster.id),
          eq(settings.key, HEROES_SEEDED_SETTING_KEY),
        )).limit(1);
        if (existingFlag.length === 0) {
          await tx.insert(settings).values({
            teamId,
            gameId,
            rosterId: roster.id,
            key: HEROES_SEEDED_SETTING_KEY,
            value: "true",
          });
        }

        seededRosters += 1;
        totalInserted += rows.length;
        console.log(`[overwatch-heroes] Seeded ${rows.length} heroes for team ${teamId.slice(0, 8)} roster "${roster.name}"`);
      });
    }

    if (seededRosters === 0) {
      console.log(`[overwatch-heroes] All ${owRosters.length} Overwatch roster(s) already populated — nothing to do.`);
    } else {
      console.log(`[overwatch-heroes] Done. Seeded ${totalInserted} hero rows across ${seededRosters} roster(s).`);
    }
  } catch (err) {
    // Log loudly; don't crash boot, but make the failure obvious in logs.
    console.error("[overwatch-heroes] FAILED — Overwatch hero seed did not complete:", err);
    throw err;
  }
}
