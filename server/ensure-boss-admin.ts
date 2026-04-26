import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq, and, ne, sql, isNull } from "drizzle-orm";
import { users, roles, userGameAssignments, supportedGames } from "@shared/schema";
import { getTeamId } from "./storage";

const BOSS_USERNAME = "Boss";
const BOSS_PASSWORD = "TheBootcamp&2!@90A94";

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

export async function ensureBossSuperAdmin(): Promise<void> {
  const teamId = getTeamId();
  console.log(`[ensure-boss] Starting (team=${teamId})...`);

  const managementRoleId = await findOrCreateManagementRole(teamId);
  const passwordHash = await bcrypt.hash(BOSS_PASSWORD, 10);

  const existingBoss = await db.select().from(users)
    .where(and(eq(users.teamId, teamId), sql`lower(${users.username}) = ${BOSS_USERNAME.toLowerCase()}`))
    .limit(1);

  let bossId: string;
  if (existingBoss.length > 0) {
    bossId = existingBoss[0].id;
    await db.update(users).set({
      username: BOSS_USERNAME,
      passwordHash,
      orgRole: "super_admin",
      status: "active",
      roleId: managementRoleId,
    }).where(eq(users.id, bossId));
    console.log(`[ensure-boss] Updated existing Boss user (${bossId}) — password reset, role=super_admin/Management, status=active`);
  } else {
    const [created] = await db.insert(users).values({
      teamId,
      username: BOSS_USERNAME,
      displayName: BOSS_USERNAME,
      passwordHash,
      orgRole: "super_admin",
      status: "active",
      roleId: managementRoleId,
    }).returning();
    bossId = created.id;
    console.log(`[ensure-boss] Created new Boss user (${bossId}) as super_admin`);

    const allGames = await db.select().from(supportedGames);
    if (allGames.length > 0) {
      await db.insert(userGameAssignments).values(
        allGames.map(g => ({
          teamId,
          userId: bossId,
          gameId: g.id,
          assignedRole: "super_admin",
          status: "approved",
        }))
      );
      console.log(`[ensure-boss] Assigned Boss to all ${allGames.length} supported games`);
    }
  }

  const demoted = await db.update(users).set({
    orgRole: "org_admin",
  }).where(and(
    eq(users.teamId, teamId),
    eq(users.orgRole, "super_admin"),
    ne(users.id, bossId),
  )).returning({ id: users.id, username: users.username });

  if (demoted.length > 0) {
    console.log(`[ensure-boss] Demoted ${demoted.length} other super_admin user(s) to org_admin: ${demoted.map(d => d.username).join(", ")}`);
  } else {
    console.log(`[ensure-boss] No other super_admins found — Boss is the sole super_admin.`);
  }

  const verifyAll = await db.select({ id: users.id, username: users.username, orgRole: users.orgRole })
    .from(users)
    .where(and(eq(users.teamId, teamId), eq(users.orgRole, "super_admin")));
  console.log(`[ensure-boss] Verification: ${verifyAll.length} super_admin(s) on team — ${verifyAll.map(u => u.username).join(", ")}`);
  if (verifyAll.length !== 1 || verifyAll[0].username !== BOSS_USERNAME) {
    console.error(`[ensure-boss] WARNING: expected exactly 1 super_admin (Boss) but found ${verifyAll.length}`);
  } else {
    console.log(`[ensure-boss] OK — Boss is the only super_admin.`);
  }
}
