import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq, and, isNull } from "drizzle-orm";
import { users, roles, userGameAssignments, supportedGames } from "@shared/schema";
import { getTeamId } from "./storage";

const BOSS_USERNAME = "Boss";

async function findOrCreateManagementRole(teamId: string): Promise<string> {
  const existing = await db.select().from(roles)
    .where(and(eq(roles.teamId, teamId), eq(roles.name, "Management"), isNull(roles.gameId)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const [created] = await db.insert(roles).values({
    teamId,
    name: "Management",
    isSystem: true,
    permissions: [],
  }).returning();
  return created.id;
}

/**
 * One-time bootstrap: creates the Boss super admin account only if it does not
 * already exist. Subsequent boots are a no-op — credentials and roles set via
 * the UI or database are never overwritten at runtime.
 *
 * Requires BOSS_SUPER_ADMIN_PASSWORD environment variable to be set.
 * Does NOT demote any other super_admin accounts.
 */
export async function ensureBossSuperAdmin(): Promise<void> {
  const bossPassword = process.env.BOSS_SUPER_ADMIN_PASSWORD;

  if (!bossPassword) {
    console.log("[ensure-boss] BOSS_SUPER_ADMIN_PASSWORD not set — skipping Boss super admin bootstrap.");
    return;
  }

  const teamId = getTeamId();

  const existingBoss = await db.select({ id: users.id }).from(users)
    .where(and(
      eq(users.teamId, teamId),
      eq(users.username, BOSS_USERNAME),
    ))
    .limit(1);

  if (existingBoss.length > 0) {
    console.log(`[ensure-boss] Boss account already exists — skipping bootstrap (no credentials or roles overwritten).`);
    return;
  }

  console.log(`[ensure-boss] Boss account not found — running one-time bootstrap (team=${teamId})...`);

  const managementRoleId = await findOrCreateManagementRole(teamId);
  const passwordHash = await bcrypt.hash(bossPassword, 10);

  const [created] = await db.insert(users).values({
    teamId,
    username: BOSS_USERNAME,
    displayName: BOSS_USERNAME,
    passwordHash,
    orgRole: "super_admin",
    status: "active",
    roleId: managementRoleId,
  }).returning();

  console.log(`[ensure-boss] Created Boss super admin (id=${created.id}). Change the password immediately after first login.`);

  const allGames = await db.select().from(supportedGames);
  if (allGames.length > 0) {
    await db.insert(userGameAssignments).values(
      allGames.map(g => ({
        teamId,
        userId: created.id,
        gameId: g.id,
        assignedRole: "super_admin",
        status: "approved",
      }))
    );
    console.log(`[ensure-boss] Assigned Boss to all ${allGames.length} supported games.`);
  }

  console.log(`[ensure-boss] One-time bootstrap complete.`);
}
