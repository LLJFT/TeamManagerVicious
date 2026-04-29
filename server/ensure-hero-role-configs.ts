import { db, pool } from "./db";
import { heroes, heroRoleConfigs, supportedGames, MARVEL_RIVALS_DEFAULT_ROLES } from "@shared/schema";
import { sql, eq, and } from "drizzle-orm";
import { OVERWATCH_DEFAULT_ROLES, OVERWATCH_GAME_SLUG } from "./defaults/overwatchHeroes";
import { defaultColorForSortOrder } from "@shared/role-colors";

const DEFAULT_ROLES_BY_SLUG: Record<string, string[]> = {
  "marvel-rivals": [...MARVEL_RIVALS_DEFAULT_ROLES],
  [OVERWATCH_GAME_SLUG]: [...OVERWATCH_DEFAULT_ROLES],
};

export async function ensureHeroRoleConfigsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hero_role_configs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id varchar NOT NULL,
      game_id varchar NOT NULL,
      name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0
    );
  `);
  await pool.query(`ALTER TABLE hero_role_configs ADD COLUMN IF NOT EXISTS color text;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS hero_role_configs_team_id_idx ON hero_role_configs(team_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS hero_role_configs_game_id_idx ON hero_role_configs(game_id);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS hero_role_configs_team_game_name_uniq ON hero_role_configs(team_id, game_id, name);`);
}

export async function backfillHeroRoleConfigColors(): Promise<void> {
  const rows = await db.select().from(heroRoleConfigs);
  let updated = 0;
  for (const r of rows) {
    if ((r as any).color && (r as any).color.length > 0) continue;
    const color = defaultColorForSortOrder(r.sortOrder ?? 0);
    await pool.query(`UPDATE hero_role_configs SET color = $1 WHERE id = $2`, [color, r.id]);
    updated++;
  }
  if (updated > 0) console.log(`[hero-role-configs] Backfilled color on ${updated} role(s)`);
}

export async function backfillHeroRoleConfigs(): Promise<void> {
  // Build gameId -> slug map so we can look up preset roles by slug.
  const allGames = await db.select().from(supportedGames);
  const slugByGameId = new Map<string, string>(allGames.map(g => [g.id, g.slug]));

  // Find every distinct (team_id, game_id) that has at least one hero.
  const heroScopes = await db.execute<{ team_id: string; game_id: string }>(sql`
    SELECT DISTINCT team_id, game_id FROM heroes WHERE team_id IS NOT NULL AND game_id IS NOT NULL
  `);

  for (const row of heroScopes.rows as any[]) {
    const teamId = row.team_id as string;
    const gameId = row.game_id as string;
    if (!teamId || !gameId) continue;

    // Check what configs already exist for this (team, game)
    const existing = await db.select().from(heroRoleConfigs).where(and(
      eq(heroRoleConfigs.teamId, teamId),
      eq(heroRoleConfigs.gameId, gameId),
    ));
    const existingNames = new Set(existing.map(r => r.name.toLowerCase()));

    // Determine the role set for this game: preset by slug, else distinct hero roles.
    const slug = slugByGameId.get(gameId);
    const presetRoles = slug ? DEFAULT_ROLES_BY_SLUG[slug] : undefined;
    let rolesToSeed: string[];
    if (presetRoles && presetRoles.length > 0) {
      rolesToSeed = presetRoles;
    } else {
      const distinctRoles = await db.execute<{ role: string }>(sql`
        SELECT DISTINCT role FROM heroes WHERE team_id = ${teamId} AND game_id = ${gameId} AND role IS NOT NULL AND role <> ''
      `);
      rolesToSeed = (distinctRoles.rows as any[])
        .map(r => r.role as string)
        .filter(Boolean);
    }

    const newRoles = rolesToSeed.filter(name => !existingNames.has(name.toLowerCase()));
    if (newRoles.length === 0) continue;

    await db.insert(heroRoleConfigs).values(newRoles.map((name, idx) => ({
      teamId,
      gameId,
      name,
      isActive: true,
      sortOrder: existing.length + idx,
    }))).onConflictDoNothing();

    console.log(`[hero-role-configs] Seeded ${newRoles.length} role(s) for team ${teamId.slice(0, 8)} game "${slug || gameId}"`);
  }
}

export async function ensureHeroRoleConfigs(): Promise<void> {
  try {
    await ensureHeroRoleConfigsTable();
    await backfillHeroRoleConfigs();
    await backfillHeroRoleConfigColors();
  } catch (e: any) {
    console.error("[hero-role-configs] Failed:", e?.message || e);
  }
}
