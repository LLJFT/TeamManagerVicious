import { db } from "./db";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  events, offDays, chatChannels, chatMessages, users,
  supportedGames, rosters,
} from "@shared/schema";
import { getTeamId } from "./storage";

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

export async function fixupTestData() {
  const teamId = getTeamId();
  console.log("[fixup] Starting test data fixup...");

  await db.update(events)
    .set({ eventType: "Meetings" })
    .where(and(eq(events.teamId, teamId), eq(events.eventType, "Meeting")));
  console.log("[fixup] Renamed 'Meeting' -> 'Meetings' event type");

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
  console.log("[fixup] Fixup complete!");
}
