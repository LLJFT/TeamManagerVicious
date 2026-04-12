import { db } from "./db";
import { eq, and, sql, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  events, offDays, chatChannels, chatMessages, users, roles,
  supportedGames, rosters, players, staff as staffTable,
  GAME_ABBREVIATIONS,
} from "@shared/schema";
import { getTeamId } from "./storage";

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

export async function fixupTestData() {
  const teamId = getTeamId();
  console.log("[fixup] Starting test data fixup...");

  const allGamesAll = await db.select().from(supportedGames);
  const allRostersAll = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
  const PLAYER_NAMES = ["Phantom", "Blaze", "Viper", "Ghost", "Shadow", "Reaper", "Frost", "Storm"];
  const STAFF_ROLES = ["Coach", "Analyst", "Manager"];

  let playersSeeded = 0, staffSeeded = 0;
  for (const roster of allRostersAll) {
    const game = allGamesAll.find(g => g.id === roster.gameId);
    if (!game) continue;
    const abbr = GAME_ABBREVIATIONS[game.slug as keyof typeof GAME_ABBREVIATIONS] || game.slug.toUpperCase().slice(0, 3);
    const sortIdx = roster.sortOrder ?? 0;
    const rosterTag = `T${sortIdx + 1}`;

    const existingPlayers = await db.select({ count: sql<number>`count(*)` }).from(players)
      .where(and(eq(players.teamId, teamId), eq(players.rosterId, roster.id)));
    if (Number(existingPlayers[0]?.count || 0) === 0) {
      for (let pi = 0; pi < 5; pi++) {
        await db.insert(players).values({
          teamId, gameId: game.id, rosterId: roster.id,
          name: `${abbr}_${PLAYER_NAMES[pi]}_${rosterTag}`,
          role: "player",
          fullName: `${PLAYER_NAMES[pi]} ${rosterTag}`,
        });
        playersSeeded++;
      }
    }

    const existingStaff = await db.select({ count: sql<number>`count(*)` }).from(staffTable)
      .where(and(eq(staffTable.teamId, teamId), eq(staffTable.rosterId, roster.id)));
    if (Number(existingStaff[0]?.count || 0) === 0) {
      for (const role of STAFF_ROLES) {
        await db.insert(staffTable).values({
          teamId, gameId: game.id, rosterId: roster.id,
          name: `${role}_${abbr}_${rosterTag}`,
          role: role.toLowerCase(),
        });
        staffSeeded++;
      }
    }
  }
  if (playersSeeded > 0 || staffSeeded > 0) {
    console.log(`[fixup] Seeded ${playersSeeded} players and ${staffSeeded} staff for empty rosters`);
  }

  await db.update(events)
    .set({ eventType: "Meetings" })
    .where(and(eq(events.teamId, teamId), eq(events.eventType, "Meeting")));
  console.log("[fixup] Renamed 'Meeting' -> 'Meetings' event type");

  const { games: gamesTable, attendance: attendanceTable } = await import("@shared/schema");
  await db.execute(sql`UPDATE events SET result = lower(result) WHERE team_id = ${teamId} AND result IS NOT NULL AND result != lower(result)`);
  await db.execute(sql`UPDATE games SET result = lower(result) WHERE team_id = ${teamId} AND result IS NOT NULL AND result != lower(result)`);
  await db.execute(sql`UPDATE attendance SET status = CASE
    WHEN lower(status) = 'present' THEN 'attended'
    WHEN lower(status) = 'late' THEN 'late'
    WHEN lower(status) = 'absent' THEN 'absent'
    ELSE lower(status)
  END WHERE team_id = ${teamId} AND (status != lower(status) OR lower(status) = 'present')`);
  console.log("[fixup] Normalized result/status values to lowercase");

  const scrimSubs = ["Practice", "Warm-up"];
  const tourneySubs = ["Stage 1", "Saudi League", "Elite 3000$ Cup"];
  const meetingSubs = ["Vod Review", "Roster Meeting", "Organization Meeting"];

  const nullSubEvents = await db.select().from(events)
    .where(and(eq(events.teamId, teamId), isNull(events.eventSubType)));

  let updated = 0;
  for (const ev of nullSubEvents) {
    let sub: string | null = null;
    if (ev.eventType === "Scrim") sub = randomFrom(scrimSubs);
    else if (ev.eventType === "Tournament") sub = randomFrom(tourneySubs);
    else if (ev.eventType === "Meetings") sub = randomFrom(meetingSubs);
    if (sub) {
      await db.update(events).set({ eventSubType: sub }).where(eq(events.id, ev.id));
      updated++;
    }
  }
  console.log(`[fixup] Added sub-types to ${updated} events`);

  const noOppEvents = await db.select().from(events)
    .where(and(eq(events.teamId, teamId), isNull(events.opponentName)));
  const OPPONENTS = ["Falcons", "Liquid", "Vitality", "FaZe", "Twisted Minds", "Virtus Pro", "GenG", "Karmine Corp", "T1", "100 Thieves", "G2"];
  let oppUpdated = 0;
  for (const ev of noOppEvents) {
    if (ev.eventType === "Scrim" || ev.eventType === "Tournament") {
      await db.update(events).set({ opponentName: randomFrom(OPPONENTS) }).where(eq(events.id, ev.id));
      oppUpdated++;
    }
  }
  console.log(`[fixup] Added opponents to ${oppUpdated} events`);

  const allGames = await db.select().from(supportedGames);
  const allRosters = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
  const adminUsers = await db.select().from(users).where(eq(users.teamId, teamId)).limit(1);
  const adminUserId = adminUsers[0]?.id;

  let channelsCreated = 0, msgsCreated = 0, offDaysCreated = 0;

  for (const roster of allRosters) {
    const game = allGames.find(g => g.id === roster.gameId);
    if (!game) continue;

    const existCh = await db.select().from(chatChannels)
      .where(and(eq(chatChannels.teamId, teamId), eq(chatChannels.gameId, game.id), eq(chatChannels.rosterId, roster.id)))
      .limit(1);

    let chId: string;
    if (existCh.length === 0) {
      for (const chName of ["General", "Strategy", "Announcements"]) {
        const [ch] = await db.insert(chatChannels).values({
          teamId, gameId: game.id, rosterId: roster.id, name: chName,
        }).returning();
        if (chName === "General") chId = ch.id;
        channelsCreated++;
      }
    } else {
      chId = existCh[0].id;
    }

    const existMsgs = await db.select({ count: sql<number>`count(*)` }).from(chatMessages)
      .where(eq(chatMessages.channelId, chId!));
    if (Number(existMsgs[0]?.count || 0) < 5 && adminUserId) {
      const texts = [
        "Good practice today, let's keep the momentum going!",
        "We need to work on our rotations for next match.",
        "Everyone review the VOD before tomorrow's scrim.",
        "New strat ideas posted in the strategy channel.",
        "Great win tonight! Solid teamwork all around.",
      ];
      for (const msg of texts) {
        await db.insert(chatMessages).values({
          teamId, gameId: game.id, channelId: chId!,
          userId: adminUserId, message: msg,
          createdAt: new Date(Date.now() - randomInt(0, 7 * 86400000)).toISOString(),
        });
        msgsCreated++;
      }
      for (let i = 0; i < 2; i++) {
        await db.insert(chatMessages).values({
          teamId, gameId: game.id, channelId: chId!,
          userId: adminUserId, message: `Scoreboard from match ${i + 1}`,
          attachmentUrl: "/uploads/general/IMG_4357.png",
          attachmentType: "image", attachmentName: "IMG_4357.png", attachmentSize: 45000,
          createdAt: new Date(Date.now() - randomInt(0, 3 * 86400000)).toISOString(),
        });
        msgsCreated++;
      }
      await db.insert(chatMessages).values({
        teamId, gameId: game.id, channelId: chId!,
        userId: adminUserId, message: "Voice note from coach",
        attachmentUrl: "/uploads/general/IMG_4357.png",
        attachmentType: "audio", attachmentName: "voice_note.ogg", attachmentSize: 128000,
        createdAt: new Date(Date.now() - randomInt(0, 2 * 86400000)).toISOString(),
      });
      msgsCreated++;
      await db.insert(chatMessages).values({
        teamId, gameId: game.id, channelId: chId!,
        userId: adminUserId, message: "Updated tournament bracket",
        attachmentUrl: "/uploads/general/IMG_4357.png",
        attachmentType: "file", attachmentName: "bracket.pdf", attachmentSize: 256000,
        createdAt: new Date(Date.now() - randomInt(0, 86400000)).toISOString(),
      });
      msgsCreated++;
    }

    const existOD = await db.select().from(offDays)
      .where(and(eq(offDays.teamId, teamId), eq(offDays.gameId, game.id), eq(offDays.rosterId, roster.id)))
      .limit(1);
    if (existOD.length === 0) {
      for (const d of ["2026-03-08", "2026-03-22", "2026-04-05"]) {
        await db.insert(offDays).values({ teamId, gameId: game.id, rosterId: roster.id, date: d });
        offDaysCreated++;
      }
    }
  }

  console.log(`[fixup] Chat channels created: ${channelsCreated}`);
  console.log(`[fixup] Chat messages created: ${msgsCreated}`);
  console.log(`[fixup] Off days created: ${offDaysCreated}`);

  let usersCreated = 0;
  const existingUserCount = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.teamId, teamId));
  if (Number(existingUserCount[0]?.count || 0) < 20) {
    const passwordHash = bcrypt.hashSync("player123", 10);
    const playerRole = await db.select().from(roles)
      .where(and(eq(roles.teamId, teamId), eq(roles.name, "Player")))
      .limit(1);
    const playerRoleId = playerRole[0]?.id;

    for (const roster of allRostersAll) {
      const game = allGamesAll.find(g => g.id === roster.gameId);
      if (!game) continue;
      const rosterPlayers = await db.select().from(players)
        .where(and(eq(players.teamId, teamId), eq(players.rosterId, roster.id)))
        .limit(1);
      if (rosterPlayers.length === 0) continue;
      const player = rosterPlayers[0];

      const existingUser = await db.select().from(users)
        .where(and(eq(users.teamId, teamId), eq(users.playerId, player.id)))
        .limit(1);
      if (existingUser.length > 0) continue;

      const username = player.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
      const existingUsername = await db.select().from(users)
        .where(and(eq(users.teamId, teamId), eq(users.username, username)))
        .limit(1);
      if (existingUsername.length > 0) continue;

      await db.insert(users).values({
        teamId,
        username,
        passwordHash,
        playerId: player.id,
        roleId: playerRoleId || null,
        orgRole: "member",
        displayName: player.fullName || player.name,
        status: "active",
      });
      usersCreated++;
    }
  }
  console.log(`[fixup] User accounts created: ${usersCreated}`);

  console.log("[fixup] Fixup complete!");
}
