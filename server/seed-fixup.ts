import { db } from "./db";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  events, supportedGames, rosters, users, roles, userGameAssignments,
  GAME_ABBREVIATIONS,
} from "@shared/schema";
import { getTeamId } from "./storage";

/**
 * Republish-safe data hygiene.
 *
 * GUARANTEES:
 *   - NEVER DROPs, TRUNCATEs, or DELETEs any rows.
 *   - Only normalizes a small set of legacy/inconsistent values via UPDATE.
 *   - Only INSERTs rows that do not already exist.
 *   - Safe to run on every boot.
 */
export async function fixupTestData() {
  const teamId = getTeamId();
  console.log("[fixup] Starting non-destructive data fixup...");

  // 1. Rename legacy "Meeting" event type to canonical "Meetings".
  //    UPDATE only — no rows removed.
  await db.update(events)
    .set({ eventType: "Meetings" })
    .where(and(eq(events.teamId, teamId), eq(events.eventType, "Meeting")));

  // 2. Normalize result/status casing so filters work consistently.
  //    UPDATE only — no rows removed, no values lost.
  await db.execute(sql`UPDATE events SET result = lower(result) WHERE team_id = ${teamId} AND result IS NOT NULL AND result != lower(result)`);
  await db.execute(sql`UPDATE games SET result = lower(result) WHERE team_id = ${teamId} AND result IS NOT NULL AND result != lower(result)`);
  await db.execute(sql`UPDATE attendance SET status = CASE
    WHEN lower(status) = 'present' THEN 'attended'
    WHEN lower(status) = 'late' THEN 'late'
    WHEN lower(status) = 'absent' THEN 'absent'
    ELSE lower(status)
  END WHERE team_id = ${teamId} AND (status != lower(status) OR lower(status) = 'present')`);
  console.log("[fixup] Normalized event types and result/status casing");

  // 3. Ensure the platform-level Staff / Management / Member roles exist
  //    and back-fill orgRole + roleId for seed-account users only.
  //    INSERT-if-missing only; UPDATE only when current values are wrong.
  await fixUserRoles(teamId);

  // 4. Create user_game_assignments for seed users that don't have one yet.
  //    INSERT-if-missing only.
  await createGameAssignments(teamId);

  console.log("[fixup] Fixup complete (no destructive operations performed).");
}

async function fixUserRoles(teamId: string) {
  const staffRoleId = await ensureRole(teamId, "Staff");
  const memberRoleId = await ensureRole(teamId, "Member");
  await ensureRole(teamId, "Management");

  const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
  let updated = 0;

  for (const user of allUsers) {
    if (!user.username || user.orgRole === "super_admin" || user.orgRole === "org_admin") continue;
    const un = user.username.toLowerCase();

    let newOrgRole: string | null = null;
    let newRoleId: string | null = null;

    if (un.endsWith("_tank1") || un.endsWith("_tank2") ||
        un.endsWith("_dps1") || un.endsWith("_dps2") ||
        un.endsWith("_sup1") || un.endsWith("_sup2") ||
        un.endsWith("_flex1") || un.endsWith("_flex2")) {
      newOrgRole = "member";
      newRoleId = memberRoleId;
    } else if (un.endsWith("_coach") || un.endsWith("_headcoach") ||
               un.endsWith("_assistant") || un.endsWith("_analyst") ||
               un.endsWith("_manager")) {
      newOrgRole = "staff";
      newRoleId = staffRoleId;
    }

    if (newOrgRole && (user.orgRole !== newOrgRole || user.roleId !== newRoleId)) {
      await db.update(users).set({ orgRole: newOrgRole, roleId: newRoleId }).where(eq(users.id, user.id));
      updated++;
    }
  }

  console.log(`[fixup] Verified orgRole/roleId for ${updated} seed user(s)`);
}

async function ensureRole(teamId: string, name: string): Promise<string> {
  const existing = await db.select().from(roles)
    .where(and(eq(roles.teamId, teamId), eq(roles.name, name), isNull(roles.gameId)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const memberRole = await db.select().from(roles)
    .where(and(eq(roles.teamId, teamId), eq(roles.name, "Member"), isNull(roles.gameId)))
    .limit(1);
  const basePerms = memberRole[0]?.permissions || [];

  const [created] = await db.insert(roles).values({
    teamId,
    name,
    permissions: basePerms,
    rank: name === "Management" ? 4 : 3,
  }).returning();
  console.log(`[fixup] Created missing platform role "${name}"`);
  return created.id;
}

async function createGameAssignments(teamId: string) {
  const allGames = await db.select().from(supportedGames);
  const allRostersArr = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
  const allUsersArr = await db.select().from(users).where(eq(users.teamId, teamId));
  const existingAssignments = await db.select().from(userGameAssignments).where(eq(userGameAssignments.teamId, teamId));
  const assignmentSet = new Set(existingAssignments.map(a => `${a.userId}|${a.gameId}`));

  const abbrToSlug: Record<string, string> = {};
  for (const [slug, abbr] of Object.entries(GAME_ABBREVIATIONS)) {
    abbrToSlug[abbr.toLowerCase()] = slug;
  }

  const gamesBySlug: Record<string, string> = {};
  for (const game of allGames) {
    gamesBySlug[game.slug] = game.id;
  }

  const rostersByGameSort: Record<string, Record<number, string>> = {};
  for (const roster of allRostersArr) {
    if (!roster.gameId) continue;
    if (!rostersByGameSort[roster.gameId]) rostersByGameSort[roster.gameId] = {};
    rostersByGameSort[roster.gameId][roster.sortOrder ?? 0] = roster.id;
  }

  const batchRows: any[] = [];

  for (const user of allUsersArr) {
    if (!user.username) continue;
    if (user.orgRole === "super_admin" || user.orgRole === "org_admin") continue;

    const un = user.username.toLowerCase();
    const parts = un.split("_");
    if (parts.length < 3) continue;

    const abbrPart = parts[0];
    const teamNum = parseInt(parts[1], 10);
    if (isNaN(teamNum) || teamNum < 1 || teamNum > 4) continue;

    const gameSlug = abbrToSlug[abbrPart];
    if (!gameSlug) continue;

    const gameId = gamesBySlug[gameSlug];
    if (!gameId) continue;

    const rosterId = rostersByGameSort[gameId]?.[teamNum - 1];
    if (!rosterId) continue;

    const key = `${user.id}|${gameId}`;
    if (assignmentSet.has(key)) continue;

    batchRows.push({
      teamId,
      userId: user.id,
      gameId,
      rosterId,
      assignedRole: user.orgRole === "staff" ? "staff" : user.orgRole === "management" ? "management" : "player",
      status: "approved",
      approvalGameStatus: "approved",
      approvalOrgStatus: "approved",
    });
    assignmentSet.add(key);
  }

  if (batchRows.length > 0) {
    for (let i = 0; i < batchRows.length; i += 100) {
      await db.insert(userGameAssignments).values(batchRows.slice(i, i + 100));
    }
  }

  console.log(`[fixup] Inserted ${batchRows.length} new game assignment(s) (existing rows untouched)`);
}
