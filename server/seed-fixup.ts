import { db } from "./db";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import {
  events, eventCategories, players, staff as staffTable,
  supportedGames, rosters, users, roles, userGameAssignments,
  attendance, games, playerGameStats, playerAvailability, staffAvailability,
  offDays, chatChannels, chatMessages, availabilitySlots, rosterRoles,
  eventSubTypes, gameModes, maps, statFields, seasons,
  GAME_ABBREVIATIONS,
} from "@shared/schema";
import { getTeamId } from "./storage";

export async function fixupTestData() {
  const teamId = getTeamId();
  console.log("[fixup] Starting test data fixup...");

  await db.update(events)
    .set({ eventType: "Meetings" })
    .where(and(eq(events.teamId, teamId), eq(events.eventType, "Meeting")));
  console.log("[fixup] Renamed 'Meeting' -> 'Meetings' event type");

  await db.execute(sql`UPDATE events SET result = lower(result) WHERE team_id = ${teamId} AND result IS NOT NULL AND result != lower(result)`);
  await db.execute(sql`UPDATE games SET result = lower(result) WHERE team_id = ${teamId} AND result IS NOT NULL AND result != lower(result)`);
  await db.execute(sql`UPDATE attendance SET status = CASE
    WHEN lower(status) = 'present' THEN 'attended'
    WHEN lower(status) = 'late' THEN 'late'
    WHEN lower(status) = 'absent' THEN 'absent'
    ELSE lower(status)
  END WHERE team_id = ${teamId} AND (status != lower(status) OR lower(status) = 'present')`);
  console.log("[fixup] Normalized result/status values to lowercase");

  await db.update(eventCategories)
    .set({ color: null })
    .where(eq(eventCategories.teamId, teamId));
  console.log("[fixup] Nulled out all event category colors (sub-type colors only)");

  await cleanupDuplicateRosters(teamId);

  await fixUserRoles(teamId);

  await createGameAssignments(teamId);

  console.log("[fixup] Fixup complete!");
}

async function cleanupDuplicateRosters(teamId: string) {
  const allGames = await db.select().from(supportedGames);
  let totalDeleted = 0;

  for (const game of allGames) {
    const gameRosters = await db.select().from(rosters)
      .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, game.id)))
      .orderBy(rosters.sortOrder, rosters.id);

    if (gameRosters.length <= 4) continue;

    const keep = gameRosters.slice(0, 4);
    const keepIds = new Set(keep.map(r => r.id));
    const duplicates = gameRosters.filter(r => !keepIds.has(r.id));
    const dupIds = duplicates.map(r => r.id);

    for (const dupId of dupIds) {
      await db.execute(sql`DELETE FROM player_game_stats WHERE team_id = ${teamId} AND match_id IN (SELECT id FROM games WHERE roster_id = ${dupId})`);
      await db.delete(playerGameStats).where(and(eq(playerGameStats.teamId, teamId), sql`player_id IN (SELECT id FROM players WHERE roster_id = ${dupId})`));
      await db.delete(games).where(and(eq(games.teamId, teamId), eq(games.rosterId, dupId)));
      await db.delete(attendance).where(and(eq(attendance.teamId, teamId), eq(attendance.rosterId, dupId)));
      await db.delete(events).where(and(eq(events.teamId, teamId), eq(events.rosterId, dupId)));
      await db.delete(playerAvailability).where(and(eq(playerAvailability.teamId, teamId), eq(playerAvailability.rosterId, dupId)));
      await db.delete(staffAvailability).where(and(eq(staffAvailability.teamId, teamId), eq(staffAvailability.rosterId, dupId)));
      await db.delete(offDays).where(and(eq(offDays.teamId, teamId), eq(offDays.rosterId, dupId)));
      await db.delete(chatMessages).where(sql`channel_id IN (SELECT id FROM chat_channels WHERE roster_id = ${dupId})`);
      await db.delete(chatChannels).where(and(eq(chatChannels.teamId, teamId), eq(chatChannels.rosterId, dupId)));
      await db.delete(availabilitySlots).where(and(eq(availabilitySlots.teamId, teamId), eq(availabilitySlots.rosterId, dupId)));
      await db.delete(rosterRoles).where(and(eq(rosterRoles.teamId, teamId), eq(rosterRoles.rosterId, dupId)));
      await db.delete(maps).where(and(eq(maps.teamId, teamId), eq(maps.rosterId, dupId)));
      await db.delete(statFields).where(and(eq(statFields.teamId, teamId), eq(statFields.rosterId, dupId)));
      await db.delete(gameModes).where(and(eq(gameModes.teamId, teamId), eq(gameModes.rosterId, dupId)));
      await db.delete(seasons).where(and(eq(seasons.teamId, teamId), eq(seasons.rosterId, dupId)));
      await db.delete(eventCategories).where(and(eq(eventCategories.teamId, teamId), eq(eventCategories.rosterId, dupId)));
      await db.delete(eventSubTypes).where(and(eq(eventSubTypes.teamId, teamId), sql`category_id IN (SELECT id FROM event_categories WHERE roster_id = ${dupId})`));

      await db.update(users).set({ playerId: null }).where(and(eq(users.teamId, teamId), sql`player_id IN (SELECT id FROM players WHERE roster_id = ${dupId})`));
      await db.delete(players).where(and(eq(players.teamId, teamId), eq(players.rosterId, dupId)));
      await db.delete(staffTable).where(and(eq(staffTable.teamId, teamId), eq(staffTable.rosterId, dupId)));

      await db.delete(userGameAssignments).where(and(eq(userGameAssignments.teamId, teamId), eq(userGameAssignments.rosterId, dupId)));

      await db.delete(rosters).where(eq(rosters.id, dupId));
      totalDeleted++;
    }

    for (let i = 0; i < keep.length; i++) {
      await db.update(rosters).set({
        name: `Team ${i + 1}`,
        slug: `team-${i + 1}`,
        sortOrder: i,
      }).where(eq(rosters.id, keep[i].id));
    }
  }

  if (totalDeleted > 0) {
    console.log(`[fixup] Deleted ${totalDeleted} duplicate rosters`);
  } else {
    console.log("[fixup] No duplicate rosters found");
  }
}

async function fixUserRoles(teamId: string) {
  const staffRoleId = await ensureRole(teamId, "Staff");
  const managementRoleId = await ensureRole(teamId, "Management");
  const memberRoleId = await ensureRole(teamId, "Member");

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
               un.endsWith("_assistant") || un.endsWith("_analyst")) {
      newOrgRole = "staff";
      newRoleId = staffRoleId;
    } else if (un.endsWith("_manager")) {
      newOrgRole = "staff";
      newRoleId = staffRoleId;
    }

    if (newOrgRole && (user.orgRole !== newOrgRole || user.roleId !== newRoleId)) {
      await db.update(users).set({ orgRole: newOrgRole, roleId: newRoleId }).where(eq(users.id, user.id));
      updated++;
    }
  }

  console.log(`[fixup] Fixed orgRole for ${updated} users`);
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
  console.log(`[fixup] Created "${name}" platform role`);
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

  let created = 0;
  const batchRows: any[] = [];

  for (const user of allUsersArr) {
    if (!user.username) continue;
    if (user.orgRole === "super_admin" || user.orgRole === "org_admin") continue;

    const un = user.username.toLowerCase();
    const parts = un.split("_");
    if (parts.length < 3) continue;

    const abbrPart = parts[0];
    const teamNumStr = parts[1];
    const teamNum = parseInt(teamNumStr, 10);
    if (isNaN(teamNum) || teamNum < 1 || teamNum > 4) continue;

    const gameSlug = abbrToSlug[abbrPart];
    if (!gameSlug) continue;

    const gameId = gamesBySlug[gameSlug];
    if (!gameId) continue;

    const sortOrder = teamNum - 1;
    const rosterId = rostersByGameSort[gameId]?.[sortOrder];
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
    created++;
  }

  if (batchRows.length > 0) {
    for (let i = 0; i < batchRows.length; i += 100) {
      const batch = batchRows.slice(i, i + 100);
      await db.insert(userGameAssignments).values(batch);
    }
  }

  console.log(`[fixup] Created ${created} approved game assignments for seeded users`);
}
