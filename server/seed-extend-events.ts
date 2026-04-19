import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  players, staff as staffTable, events, games, playerGameStats, attendance,
  offDays, seasons, gameModes, maps, statFields as statFieldsTable,
  rosters, supportedGames,
} from "@shared/schema";
import { getTeamId } from "./storage";

const OPPONENTS = ["Falcons", "Liquid", "Vitality", "FaZe", "Twisted Minds", "Virtus Pro", "GenG", "Karmine Corp", "T1", "100 Thieves", "G2"];
const SCRIM_SUBS = ["Practice", "Warm-up"];
const TOURNEY_SUBS = ["Stage 1", "Saudi League", "Elite 3000$ Cup"];
const MEETING_SUBS = ["Vod Review", "Roster Meeting", "Organization Meeting"];

const TOURNEY_NAMES = [
  "Spring Split Round 1", "Spring Split Round 2", "Spring Split Quarter Final",
  "Spring Split Semi Final", "Spring Split Grand Final",
  "May Invitational Group A", "May Invitational Group B", "May Invitational Playoffs",
  "May Invitational Final", "Continental Cup Round 1", "Continental Cup Round 2",
  "Continental Cup Quarter Final", "Continental Cup Semi Final", "Continental Cup Grand Final",
  "Mid-Season Showdown Opener", "Mid-Season Showdown Decider", "Mid-Season Showdown Final",
  "Pro Series Day 1", "Pro Series Day 2", "Pro Series Final",
];

const MEETING_TITLES = [
  "Vod Review — April Scrims", "Roster Meeting — Spring Split Prep",
  "Organization Meeting — Q2 Goals", "Vod Review — Continental Cup Day 1",
  "Roster Meeting — Strategy Update", "Organization Meeting — Mid-Season Review",
  "Vod Review — May Invitational", "Roster Meeting — Map Pool Discussion",
  "Organization Meeting — Sponsorship Renewal", "Vod Review — Finals Prep",
];

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function genTime(): string {
  const h = randomFrom([15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1]);
  return `${String(h).padStart(2, '0')}:${String(randomFrom([0, 15, 30, 45])).padStart(2, '0')}`;
}

// Date helpers for Apr 11 – May 31, 2026
function dateAtOffset(dayOffset: number): string {
  // dayOffset 0 = 2026-04-11
  const start = new Date(Date.UTC(2026, 3, 11));
  start.setUTCDate(start.getUTCDate() + dayOffset);
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, '0');
  const d = String(start.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function batchInsert(table: any, rows: any[], batchSize = 200) {
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(table).values(rows.slice(i, i + batchSize));
  }
}

async function batchInsertReturning(table: any, rows: any[], batchSize = 200) {
  const results: any[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const inserted = await db.insert(table).values(rows.slice(i, i + batchSize)).returning();
    results.push(...inserted);
  }
  return results;
}

async function extendOneRoster(teamId: string, roster: any, gameId: string) {
  const rosterPlayers = await db.select().from(players)
    .where(and(eq(players.teamId, teamId), eq(players.rosterId, roster.id)));
  const rosterStaff = await db.select().from(staffTable)
    .where(and(eq(staffTable.teamId, teamId), eq(staffTable.rosterId, roster.id)));
  if (rosterPlayers.length === 0) return { events: 0, games: 0, stats: 0, attendance: 0 };

  const existModes = await db.select().from(gameModes)
    .where(and(eq(gameModes.teamId, teamId), eq(gameModes.gameId, gameId), eq(gameModes.rosterId, roster.id)));
  const modeEntries: { id: string; maps: { id: string }[]; statFields: { id: string; name: string }[] }[] = [];
  for (const mode of existModes) {
    const modeMaps = await db.select().from(maps).where(and(eq(maps.teamId, teamId), eq(maps.gameModeId, mode.id)));
    const modeFields = await db.select().from(statFieldsTable).where(and(eq(statFieldsTable.teamId, teamId), eq(statFieldsTable.gameModeId, mode.id)));
    modeEntries.push({ id: mode.id, maps: modeMaps.map(m => ({ id: m.id })), statFields: modeFields.map(f => ({ id: f.id, name: f.name })) });
  }

  const existSeasons = await db.select().from(seasons)
    .where(and(eq(seasons.teamId, teamId), eq(seasons.gameId, gameId), eq(seasons.rosterId, roster.id)));
  const seasonIds = existSeasons.map(s => s.id);
  if (seasonIds.length === 0) seasonIds.push(null as any);

  // Build 50 event definitions across Apr 11 – May 31 (51 days)
  type EvDef = { title: string; type: string; sub: string; date: string; time: string; withGames: boolean; opponent: string | null; season: string | null };
  const evDefs: EvDef[] = [];

  // 20 scrims, dayOffset 0..38 step 2 -> Apr 11..May 19
  for (let i = 0; i < 20; i++) {
    const sub = SCRIM_SUBS[i % 2];
    const opp = OPPONENTS[i % OPPONENTS.length];
    evDefs.push({
      title: `${sub} vs ${opp}`, type: "Scrim", sub,
      date: dateAtOffset(i * 2),
      time: sub === "Warm-up" ? `${randomFrom([14, 15])}:00` : genTime(),
      withGames: true, opponent: opp,
      season: i < 10 ? seasonIds[0] : seasonIds[Math.min(1, seasonIds.length - 1)] ?? seasonIds[0],
    });
  }
  // 20 tournaments, dayOffset 1..50 (mostly mid/late)
  for (let i = 0; i < 20; i++) {
    const opp = OPPONENTS[(i + 3) % OPPONENTS.length];
    evDefs.push({
      title: `${TOURNEY_NAMES[i]} VS ${opp}`,
      type: "Tournament", sub: TOURNEY_SUBS[i % 3],
      date: dateAtOffset(1 + i * 2 + (i > 14 ? 5 : 0) <= 50 ? 1 + i * 2 : 50 - i),
      time: genTime(),
      withGames: true, opponent: opp,
      season: i < 10 ? seasonIds[0] : seasonIds[Math.min(1, seasonIds.length - 1)] ?? seasonIds[0],
    });
  }
  // Re-seat tournament dates safely within 0..50
  for (let i = 0; i < 20; i++) {
    evDefs[20 + i].date = dateAtOffset(Math.min(50, 1 + i * 2 + (i % 3)));
  }
  // 10 meetings, dayOffset 4..49 step 5
  for (let i = 0; i < 10; i++) {
    evDefs.push({
      title: MEETING_TITLES[i], type: "Meetings", sub: MEETING_SUBS[i % 3],
      date: dateAtOffset(4 + i * 5),
      time: genTime(),
      withGames: false, opponent: null,
      season: seasonIds[0] ?? null,
    });
  }

  // Insert events
  const eventRows = evDefs.map(ev => ({
    teamId, gameId, rosterId: roster.id,
    title: ev.title, eventType: ev.type, eventSubType: ev.sub,
    date: ev.date, time: ev.time,
    description: `${ev.type} event for ${roster.name}`,
    opponentName: ev.opponent, seasonId: ev.season,
    result: ev.withGames ? randomFrom(["win", "loss", "win", "loss", "draw"]) : null,
  }));
  const insertedEvents = await batchInsertReturning(events, eventRows);

  // Attendance: every player + staff for every event
  const attendanceRows: any[] = [];
  for (const ev of insertedEvents) {
    for (const p of rosterPlayers) {
      attendanceRows.push({
        teamId, gameId, rosterId: roster.id,
        playerId: p.id, staffId: null,
        eventId: ev.id, date: ev.date,
        status: randomFrom(["attended", "attended", "attended", "attended", "attended", "late", "absent"]),
      });
    }
    for (const s of rosterStaff) {
      attendanceRows.push({
        teamId, gameId, rosterId: roster.id,
        playerId: null, staffId: s.id,
        eventId: ev.id, date: ev.date,
        status: randomFrom(["attended", "attended", "attended", "attended", "late", "absent"]),
      });
    }
  }
  if (attendanceRows.length > 0) await batchInsert(attendance, attendanceRows, 500);

  // Games + stats for events that have games
  let gameCount = 0;
  let statCount = 0;
  if (modeEntries.length > 0) {
    const gameEvents = insertedEvents.filter((_, i) => evDefs[i].withGames);
    const gameRows: any[] = [];
    const gameMeta: { eventIdx: number; modeIdx: number }[] = [];
    for (let ei = 0; ei < gameEvents.length; ei++) {
      const ev = gameEvents[ei];
      for (let g = 0; g < 5; g++) {
        const modeIdx = g % modeEntries.length;
        const mode = modeEntries[modeIdx];
        const mapIdx = g % Math.max(1, mode.maps.length);
        const w = randomInt(0, 13);
        const l = randomInt(0, 13);
        gameRows.push({
          teamId, gameId, rosterId: roster.id,
          eventId: ev.id, gameCode: `Game ${g + 1}`,
          score: `${Math.max(w, l)}-${Math.min(w, l)}`,
          gameModeId: mode.id, mapId: mode.maps[mapIdx]?.id || null,
          result: w > l ? "win" : w < l ? "loss" : "draw",
          link: null,
        });
        gameMeta.push({ eventIdx: ei, modeIdx });
      }
    }
    const insertedGames = await batchInsertReturning(games, gameRows, 200);
    gameCount = insertedGames.length;

    const statRows: any[] = [];
    for (let gi = 0; gi < insertedGames.length; gi++) {
      const match = insertedGames[gi];
      const meta = gameMeta[gi];
      const mode = modeEntries[meta.modeIdx];
      for (const p of rosterPlayers) {
        for (const sf of mode.statFields) {
          const isKill = sf.name === "Kill";
          const isDeath = sf.name === "Death";
          statRows.push({
            teamId, gameId,
            matchId: match.id, playerId: p.id,
            statFieldId: sf.id,
            value: String(isKill ? randomInt(5, 35) : isDeath ? randomInt(3, 25) : randomInt(0, 20)),
          });
        }
      }
    }
    if (statRows.length > 0) await batchInsert(playerGameStats, statRows, 800);
    statCount = statRows.length;
  }

  // Add 5 new off-days in the new range
  const newOffDays = ["2026-04-17", "2026-04-24", "2026-05-01", "2026-05-15", "2026-05-29"]
    .map(d => ({ teamId, gameId, rosterId: roster.id, date: d }));
  await batchInsert(offDays, newOffDays);

  return { events: insertedEvents.length, games: gameCount, stats: statCount, attendance: attendanceRows.length };
}

export async function extendEventsRange(startIdx = 0, endIdx?: number) {
  const teamId = getTeamId();
  const allRosters = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
  const allGames = await db.select().from(supportedGames);
  const stop = endIdx ?? allRosters.length;

  const totals = { events: 0, games: 0, stats: 0, attendance: 0, rosters: 0 };
  for (let i = startIdx; i < stop && i < allRosters.length; i++) {
    const roster = allRosters[i];
    const game = allGames.find(g => g.id === roster.gameId);
    if (!game) continue;
    const r = await extendOneRoster(teamId, roster, game.id);
    totals.events += r.events;
    totals.games += r.games;
    totals.stats += r.stats;
    totals.attendance += r.attendance;
    totals.rosters++;
    if ((i + 1) % 5 === 0 || i === stop - 1) {
      console.log(`[extend-events] ${i + 1}/${stop} rosters | +${totals.events} events, +${totals.games} games, +${totals.stats} stats, +${totals.attendance} attendance`);
    }
  }
  console.log(`[extend-events] DONE batch ${startIdx}..${stop}: ${JSON.stringify(totals)}`);
  return totals;
}
