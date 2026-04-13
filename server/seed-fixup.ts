import { db } from "./db";
import { eq, and, sql, isNull } from "drizzle-orm";
import {
  events, eventCategories,
  supportedGames, rosters,
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

  const scrimSubs = ["Practice", "Warm-up"];
  const tourneySubs = ["Stage 1", "Saudi League", "Elite 3000$ Cup"];
  const meetingSubs = ["Vod Review", "Roster Meeting", "Organization Meeting"];

  const nullSubEvents = await db.select().from(events)
    .where(and(eq(events.teamId, teamId), isNull(events.eventSubType)));
  let updated = 0;
  for (const ev of nullSubEvents) {
    let sub: string | null = null;
    if (ev.eventType === "Scrim") sub = scrimSubs[Math.floor(Math.random() * scrimSubs.length)];
    else if (ev.eventType === "Tournament") sub = tourneySubs[Math.floor(Math.random() * tourneySubs.length)];
    else if (ev.eventType === "Meetings") sub = meetingSubs[Math.floor(Math.random() * meetingSubs.length)];
    if (sub) {
      await db.update(events).set({ eventSubType: sub }).where(eq(events.id, ev.id));
      updated++;
    }
  }
  console.log(`[fixup] Added sub-types to ${updated} events`);

  const OPPONENTS = ["Falcons", "Liquid", "Vitality", "FaZe", "Twisted Minds", "Virtus Pro", "GenG", "Karmine Corp", "T1", "100 Thieves", "G2"];
  const noOppEvents = await db.select().from(events)
    .where(and(eq(events.teamId, teamId), isNull(events.opponentName)));
  let oppUpdated = 0;
  for (const ev of noOppEvents) {
    if (ev.eventType === "Scrim" || ev.eventType === "Tournament") {
      await db.update(events).set({ opponentName: OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)] }).where(eq(events.id, ev.id));
      oppUpdated++;
    }
  }
  console.log(`[fixup] Added opponents to ${oppUpdated} events`);

  console.log("[fixup] Fixup complete!");
}
