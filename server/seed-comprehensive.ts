import { db } from "./db";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  players, staff as staffTable, events, games, playerGameStats, attendance,
  offDays, seasons, gameModes, maps, statFields as statFieldsTable,
  chatChannels, chatMessages, playerAvailability, staffAvailability,
  supportedGames, rosters, users, roles, rosterRoles, eventCategories, eventSubTypes,
  GAME_ABBREVIATIONS,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { getTeamId } from "./storage";

const OPPONENTS = ["Falcons", "Liquid", "Vitality", "FaZe", "Twisted Minds", "Virtus Pro", "GenG", "Karmine Corp", "T1", "100 Thieves", "G2"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const AVAIL_SLOTS = ["18:00-20:00", "20:00-22:00", "All Blocks", "18:00-20:00", "20:00-22:00", "All Blocks", "Can't"];
const PLAYER_ROLES = ["Tank", "DPS", "Support", "Flex"];

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function genDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, m === 4 ? 10 : 31)).padStart(2, '0')}`;
}
function genTime(): string {
  const h = randomFrom([15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1]);
  return `${String(h).padStart(2, '0')}:${String(randomFrom([0, 15, 30, 45])).padStart(2, '0')}`;
}

const MODE_STAT_FIELDS: Record<string, string[]> = {
  "Game Mode 1": ["Kill", "Death", "Assist", "Time"],
  "Game Mode 2": ["Kill", "Death", "Plant", "Defuse"],
  "Game Mode 3": ["Kill", "Death", "Goal", "Assist"],
};
const MODE_MAPS: Record<string, string[]> = {
  "Game Mode 1": ["Map 1", "Map 2", "Map 3"],
  "Game Mode 2": ["Map 4", "Map 5", "Map 6"],
  "Game Mode 3": ["Map 7", "Map 8", "Map 9"],
};

async function batchInsert(table: any, rows: any[], batchSize = 100) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.insert(table).values(batch);
  }
}

async function batchInsertReturning(table: any, rows: any[], batchSize = 100) {
  const results: any[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const inserted = await db.insert(table).values(batch).returning();
    results.push(...inserted);
  }
  return results;
}

export async function seedComprehensiveTestData() {
  const teamId = getTeamId();
  const allGames = await db.select().from(supportedGames);
  const allRosters = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
  const adminUsers = await db.select().from(users).where(and(eq(users.teamId, teamId), eq(users.orgRole, "org_admin")));
  const adminUserId = adminUsers[0]?.id;

  if (allRosters.length === 0) {
    console.log("[seed] No rosters found, skipping.");
    return;
  }

  const playerCount = await db.select({ count: sql<number>`count(*)` }).from(players).where(eq(players.teamId, teamId));
  const pCount = Number(playerCount[0]?.count || 0);
  const evCount = await db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.teamId, teamId));
  const eCount = Number(evCount[0]?.count || 0);

  const needsPlayerRestructure = pCount > 0 && pCount < allRosters.length * 8;
  const needsPlayerSeed = pCount === 0;
  const needsEvents = eCount < allRosters.length * 50;

  if (!needsPlayerRestructure && !needsPlayerSeed && !needsEvents) {
    console.log("[seed] Comprehensive test data already complete. Skipping.");
    return;
  }

  console.log("[seed] Starting comprehensive data restructuring...");
  const stats = { players: 0, staff: 0, modes: 0, maps: 0, fields: 0, seasons: 0, events: 0, matches: 0, playerStats: 0, attendance: 0, avail: 0, offDays: 0, users: 0, roles: 0 };

  const passwordHash = bcrypt.hashSync("0000", 10);
  const playerRole = await db.select().from(roles).where(and(eq(roles.teamId, teamId), eq(roles.name, "Player"))).limit(1);
  const staffRole = await db.select().from(roles).where(and(eq(roles.teamId, teamId), eq(roles.name, "Staff"))).limit(1);
  const playerRoleId = playerRole[0]?.id || null;
  const staffRoleId = staffRole[0]?.id || null;

  for (let ri = 0; ri < allRosters.length; ri++) {
    const roster = allRosters[ri];
    const game = allGames.find(g => g.id === roster.gameId);
    if (!game) continue;

    const abbr = GAME_ABBREVIATIONS[game.slug as keyof typeof GAME_ABBREVIATIONS] || game.slug.toUpperCase().slice(0, 3);
    const sortIdx = roster.sortOrder ?? 0;
    const teamNum = sortIdx + 1;
    const rosterTag = `T${teamNum}`;

    const existingPlayers = await db.select().from(players)
      .where(and(eq(players.teamId, teamId), eq(players.rosterId, roster.id)));

    let rosterPlayers = existingPlayers;

    if (existingPlayers.length !== 8 && (needsPlayerRestructure || needsPlayerSeed)) {
      if (existingPlayers.length > 0) {
        const playerIds = existingPlayers.map(p => p.id);
        await db.delete(playerGameStats).where(and(eq(playerGameStats.teamId, teamId), inArray(playerGameStats.playerId, playerIds)));
        await db.delete(attendance).where(and(eq(attendance.teamId, teamId), inArray(attendance.playerId, playerIds)));
        await db.delete(playerAvailability).where(and(eq(playerAvailability.teamId, teamId), inArray(playerAvailability.playerId, playerIds)));
        await db.update(users).set({ playerId: null }).where(and(eq(users.teamId, teamId), inArray(users.playerId, playerIds)));
        await db.delete(players).where(and(eq(players.teamId, teamId), eq(players.rosterId, roster.id)));
      }

      const playerRows: any[] = [];
      for (const role of PLAYER_ROLES) {
        for (let i = 1; i <= 2; i++) {
          const roleSuffix = role === "Support" ? "Sup" : role;
          const ign = `${abbr}_${rosterTag}_${roleSuffix}${i}`;
          playerRows.push({ teamId, gameId: game.id, rosterId: roster.id, name: ign, role, fullName: ign });
        }
      }
      rosterPlayers = await batchInsertReturning(players, playerRows);
      stats.players += playerRows.length;
    }

    let rosterStaff = await db.select().from(staffTable)
      .where(and(eq(staffTable.teamId, teamId), eq(staffTable.rosterId, roster.id)));

    if (rosterStaff.length === 0) {
      const staffRows = [
        { teamId, gameId: game.id, rosterId: roster.id, name: `Coach_${abbr}_${rosterTag}`, role: "Coach" },
        { teamId, gameId: game.id, rosterId: roster.id, name: `Analyst_${abbr}_${rosterTag}`, role: "Analyst" },
      ];
      rosterStaff = await batchInsertReturning(staffTable, staffRows);
      stats.staff += staffRows.length;
    }

    const existRR = await db.select().from(rosterRoles)
      .where(and(eq(rosterRoles.teamId, teamId), eq(rosterRoles.rosterId, roster.id)));
    const existingRoleNames = existRR.map(r => r.name);
    const newRoles: any[] = [];
    for (let rri = 0; rri < PLAYER_ROLES.length; rri++) {
      if (!existingRoleNames.includes(PLAYER_ROLES[rri])) {
        newRoles.push({ teamId, gameId: game.id, rosterId: roster.id, name: PLAYER_ROLES[rri], type: "player", sortOrder: rri });
      }
    }
    if (newRoles.length > 0) {
      await batchInsert(rosterRoles, newRoles);
      stats.roles += newRoles.length;
    }

    const existModes = await db.select().from(gameModes)
      .where(and(eq(gameModes.teamId, teamId), eq(gameModes.gameId, game.id), eq(gameModes.rosterId, roster.id)));

    let modeEntries: { id: string; name: string; maps: { id: string; name: string }[]; statFields: { id: string; name: string }[] }[] = [];

    if (existModes.length < 3) {
      if (existModes.length > 0) {
        const modeIds = existModes.map(m => m.id);
        await db.delete(maps).where(and(eq(maps.teamId, teamId), inArray(maps.gameModeId, modeIds)));
        await db.delete(statFieldsTable).where(and(eq(statFieldsTable.teamId, teamId), inArray(statFieldsTable.gameModeId, modeIds)));
        await db.delete(gameModes).where(and(eq(gameModes.teamId, teamId), eq(gameModes.gameId, game.id), eq(gameModes.rosterId, roster.id)));
      }

      for (const [modeName, modeStatNames] of Object.entries(MODE_STAT_FIELDS)) {
        const [gm] = await db.insert(gameModes).values({
          teamId, gameId: game.id, rosterId: roster.id, name: modeName, sortOrder: "0",
        }).returning();
        stats.modes++;

        const mapRows = MODE_MAPS[modeName].map(mn => ({
          teamId, gameId: game.id, rosterId: roster.id, name: mn, gameModeId: gm.id, sortOrder: "0",
        }));
        const modeMaps = await batchInsertReturning(maps, mapRows);
        stats.maps += mapRows.length;

        const fieldRows = modeStatNames.map(sf => ({
          teamId, gameId: game.id, rosterId: roster.id, name: sf, gameModeId: gm.id,
        }));
        const modeFields = await batchInsertReturning(statFieldsTable, fieldRows);
        stats.fields += fieldRows.length;

        modeEntries.push({ id: gm.id, name: modeName, maps: modeMaps.map(m => ({ id: m.id, name: m.name })), statFields: modeFields.map(f => ({ id: f.id, name: f.name })) });
      }
    } else {
      for (const mode of existModes) {
        const modeMaps = await db.select().from(maps).where(and(eq(maps.teamId, teamId), eq(maps.gameModeId, mode.id)));
        const modeFields = await db.select().from(statFieldsTable).where(and(eq(statFieldsTable.teamId, teamId), eq(statFieldsTable.gameModeId, mode.id)));
        modeEntries.push({ id: mode.id, name: mode.name, maps: modeMaps.map(m => ({ id: m.id, name: m.name })), statFields: modeFields.map(f => ({ id: f.id, name: f.name })) });
      }
    }

    const existSeasons = await db.select().from(seasons)
      .where(and(eq(seasons.teamId, teamId), eq(seasons.gameId, game.id), eq(seasons.rosterId, roster.id)));
    let seasonIds: string[] = existSeasons.map(s => s.id);
    if (seasonIds.length < 2) {
      const newSeasons: any[] = [];
      if (seasonIds.length === 0) newSeasons.push({ teamId, gameId: game.id, rosterId: roster.id, name: "Season 1", description: "First competitive season" });
      newSeasons.push({ teamId, gameId: game.id, rosterId: roster.id, name: "Season 2", description: "Second competitive season" });
      const inserted = await batchInsertReturning(seasons, newSeasons);
      seasonIds.push(...inserted.map(s => s.id));
      stats.seasons += newSeasons.length;
    }

    const availRows: any[] = [];
    for (const p of rosterPlayers) {
      const existPA = await db.select().from(playerAvailability)
        .where(and(eq(playerAvailability.teamId, teamId), eq(playerAvailability.playerId, p.id))).limit(1);
      if (existPA.length === 0) {
        for (const day of DAYS) {
          availRows.push({ teamId, gameId: game.id, rosterId: roster.id, playerId: p.id, day, availability: randomFrom(AVAIL_SLOTS) });
        }
      }
    }
    const staffAvailRows: any[] = [];
    for (const s of rosterStaff) {
      const existSA = await db.select().from(staffAvailability)
        .where(and(eq(staffAvailability.teamId, teamId), eq(staffAvailability.staffId, s.id))).limit(1);
      if (existSA.length === 0) {
        for (const day of DAYS) {
          staffAvailRows.push({ teamId, gameId: game.id, rosterId: roster.id, staffId: s.id, day, availability: randomFrom(AVAIL_SLOTS) });
        }
      }
    }
    if (availRows.length > 0) { await batchInsert(playerAvailability, availRows); stats.avail += availRows.length; }
    if (staffAvailRows.length > 0) { await batchInsert(staffAvailability, staffAvailRows); stats.avail += staffAvailRows.length; }

    const existEvCount = await db.select({ count: sql<number>`count(*)` }).from(events)
      .where(and(eq(events.teamId, teamId), eq(events.rosterId, roster.id)));
    const rEvCount = Number(existEvCount[0]?.count || 0);
    if (rEvCount >= 50) {
      await seedUsersForRoster(teamId, abbr, teamNum, rosterPlayers, rosterStaff, passwordHash, playerRoleId, staffRoleId, stats);
      if (ri % 10 === 0) console.log(`[seed] Progress: ${ri + 1}/${allRosters.length} rosters...`);
      continue;
    }

    if (rEvCount > 0) {
      await db.execute(sql`
        DELETE FROM player_game_stats WHERE team_id = ${teamId} AND match_id IN (
          SELECT g.id FROM games g JOIN events e ON g.event_id = e.id WHERE e.roster_id = ${roster.id} AND e.team_id = ${teamId}
        )
      `);
      await db.execute(sql`
        DELETE FROM games WHERE team_id = ${teamId} AND event_id IN (
          SELECT id FROM events WHERE roster_id = ${roster.id} AND team_id = ${teamId}
        )
      `);
      await db.execute(sql`
        DELETE FROM attendance WHERE team_id = ${teamId} AND event_id IN (
          SELECT id FROM events WHERE roster_id = ${roster.id} AND team_id = ${teamId}
        )
      `);
      await db.delete(events).where(and(eq(events.teamId, teamId), eq(events.rosterId, roster.id)));
    }

    const existOD = await db.select().from(offDays)
      .where(and(eq(offDays.teamId, teamId), eq(offDays.rosterId, roster.id))).limit(1);
    if (existOD.length === 0) {
      await batchInsert(offDays, ["2026-03-06", "2026-03-13", "2026-03-20", "2026-03-27", "2026-04-03"].map(d => ({
        teamId, gameId: game.id, rosterId: roster.id, date: d,
      })));
      stats.offDays += 5;
    }

    const scrimSubs = ["Practice", "Warm-up"];
    const tourneySubs = ["Stage 1", "Saudi League", "Elite 3000$ Cup"];
    const meetingSubs = ["Vod Review", "Roster Meeting", "Organization Meeting"];

    type EvDef = { title: string; type: string; sub: string; date: string; time: string; withGames: boolean; opponent: string | null; season: string };
    const evDefs: EvDef[] = [];

    for (let i = 0; i < 20; i++) {
      const day = 1 + Math.floor(i * 2);
      const m = day > 31 ? 4 : 3;
      const d = day > 31 ? day - 31 : day;
      const sub = scrimSubs[i % 2];
      const opp = OPPONENTS[i % OPPONENTS.length];
      evDefs.push({
        title: `${sub} vs ${opp}`, type: "Scrim", sub,
        date: genDate(2026, m, d), time: sub === "Warm-up" ? `${randomFrom([14, 15])}:00` : genTime(),
        withGames: true, opponent: opp,
        season: i < 10 ? seasonIds[0] : seasonIds[Math.min(1, seasonIds.length - 1)],
      });
    }

    const tourneyNames = [
      "Saudi League TOP 16", "Saudi League Quarter Finals", "Saudi League Semi Finals", "Saudi League Grand Final",
      "Stage 1 Group A", "Stage 1 Group B", "Stage 1 Playoffs", "Stage 1 Final",
      "Elite 3000$ Cup Round 1", "Elite 3000$ Cup Round 2", "Elite 3000$ Cup Quarter Final",
      "Elite 3000$ Cup Semi Final", "Elite 3000$ Cup Grand Final",
      "Saudi League Opening Match", "Stage 1 Decider", "Saudi League Losers Round",
      "Elite 3000$ Cup Opener", "Saudi League Winners Final", "Stage 1 Rematch", "Saudi League Consolidation",
    ];
    for (let i = 0; i < 20; i++) {
      const day = 2 + Math.floor(i * 2);
      const m = day > 31 ? 4 : 3;
      const d = day > 31 ? day - 31 : day;
      evDefs.push({
        title: `${tourneyNames[i]} VS ${OPPONENTS[(i + 3) % OPPONENTS.length]}`,
        type: "Tournament", sub: tourneySubs[i % 3],
        date: genDate(2026, m, d), time: genTime(),
        withGames: true, opponent: OPPONENTS[(i + 3) % OPPONENTS.length],
        season: i < 10 ? seasonIds[0] : seasonIds[Math.min(1, seasonIds.length - 1)],
      });
    }

    const meetingTitles = [
      "Vod Review — Week 1 Scrims", "Roster Meeting — Role Assignments",
      "Organization Meeting — Upcoming Events", "Vod Review — Tournament Day 1",
      "Roster Meeting — Substitutions", "Organization Meeting — Sponsorship Update",
      "Vod Review — Week 2 Scrims", "Roster Meeting — Meta Discussion",
      "Organization Meeting — Season Review", "Vod Review — Finals Prep",
    ];
    for (let i = 0; i < 10; i++) {
      const day = 5 + i * 6;
      const m = day > 31 ? 4 : 3;
      const d = day > 31 ? day - 31 : day;
      evDefs.push({
        title: meetingTitles[i], type: "Meetings", sub: meetingSubs[i % 3],
        date: genDate(2026, m, d), time: genTime(),
        withGames: false, opponent: null, season: seasonIds[0],
      });
    }

    const eventRows = evDefs.map(ev => ({
      teamId, gameId: game.id, rosterId: roster.id,
      title: ev.title, eventType: ev.type, eventSubType: ev.sub,
      date: ev.date, time: ev.time,
      description: `${ev.type} event for ${roster.name}`,
      opponentName: ev.opponent, seasonId: ev.season,
      result: ev.withGames ? randomFrom(["win", "loss", "win", "loss", "draw"]) : null,
    }));
    const insertedEvents = await batchInsertReturning(events, eventRows);
    stats.events += insertedEvents.length;

    const attendanceRows: any[] = [];
    const allPeople = [
      ...rosterPlayers.map(p => ({ playerId: p.id, staffId: null as string | null })),
      ...rosterStaff.map(s => ({ playerId: null as string | null, staffId: s.id })),
    ];
    for (let ei = 0; ei < insertedEvents.length; ei++) {
      const ev = insertedEvents[ei];
      for (const person of allPeople) {
        attendanceRows.push({
          teamId, gameId: game.id, rosterId: roster.id,
          playerId: person.playerId, staffId: person.staffId,
          eventId: ev.id, date: ev.date,
          status: randomFrom(["attended", "attended", "attended", "attended", "attended", "late", "absent"]),
        });
      }
    }
    if (attendanceRows.length > 0) { await batchInsert(attendance, attendanceRows, 200); stats.attendance += attendanceRows.length; }

    if (modeEntries.length > 0) {
      const gameEventsWithGames = insertedEvents.filter((_, i) => evDefs[i]?.withGames);
      const gameRows: any[] = [];
      const gameMetadata: { eventIdx: number; modeIdx: number; mapIdx: number }[] = [];

      for (let ei = 0; ei < gameEventsWithGames.length; ei++) {
        const ev = gameEventsWithGames[ei];
        for (let g = 0; g < 5; g++) {
          const modeIdx = g % modeEntries.length;
          const mode = modeEntries[modeIdx];
          const mapIdx = g % mode.maps.length;
          const w = randomInt(0, 13);
          const l = randomInt(0, 13);
          gameRows.push({
            teamId, gameId: game.id, rosterId: roster.id,
            eventId: ev.id, gameCode: `Game ${g + 1}`,
            score: `${Math.max(w, l)}-${Math.min(w, l)}`,
            gameModeId: mode.id, mapId: mode.maps[mapIdx]?.id || null,
            result: w > l ? "win" : w < l ? "loss" : "draw",
            link: `https://youtube.com/watch?v=vod_${abbr}_${rosterTag}_g${g + 1}`,
          });
          gameMetadata.push({ eventIdx: ei, modeIdx, mapIdx });
        }
      }

      const insertedGames = await batchInsertReturning(games, gameRows, 100);
      stats.matches += insertedGames.length;

      const statRows: any[] = [];
      for (let gi = 0; gi < insertedGames.length; gi++) {
        const match = insertedGames[gi];
        const meta = gameMetadata[gi];
        const mode = modeEntries[meta.modeIdx];
        for (const p of rosterPlayers) {
          for (const sf of mode.statFields) {
            const isKill = sf.name === "Kill";
            const isDeath = sf.name === "Death";
            statRows.push({
              teamId, gameId: game.id,
              matchId: match.id, playerId: p.id,
              statFieldId: sf.id, value: String(isKill ? randomInt(5, 35) : isDeath ? randomInt(3, 25) : randomInt(0, 20)),
            });
          }
        }
      }

      if (statRows.length > 0) { await batchInsert(playerGameStats, statRows, 500); stats.playerStats += statRows.length; }
    }

    await seedUsersForRoster(teamId, abbr, teamNum, rosterPlayers, rosterStaff, passwordHash, playerRoleId, staffRoleId, stats);

    if (ri % 10 === 0) console.log(`[seed] Progress: ${ri + 1}/${allRosters.length} rosters...`);
  }

  console.log(`[seed] Comprehensive data restructuring complete!`);
  console.log(`[seed]   Players: ${stats.players}, Staff: ${stats.staff}`);
  console.log(`[seed]   Game modes: ${stats.modes}, Maps: ${stats.maps}, Stat fields: ${stats.fields}`);
  console.log(`[seed]   Seasons: ${stats.seasons}, Roster roles: ${stats.roles}`);
  console.log(`[seed]   Events: ${stats.events}, Matches: ${stats.matches}`);
  console.log(`[seed]   Player stats: ${stats.playerStats}, Attendance: ${stats.attendance}`);
  console.log(`[seed]   Availability: ${stats.avail}, Off days: ${stats.offDays}`);
  console.log(`[seed]   User accounts: ${stats.users}`);
}

async function seedUsersForRoster(
  teamId: string, abbr: string, teamNum: number,
  rosterPlayers: any[], rosterStaff: any[],
  passwordHash: string, playerRoleId: string | null, staffRoleId: string | null,
  stats: any
) {
  for (const p of rosterPlayers) {
    const existUser = await db.select().from(users)
      .where(and(eq(users.teamId, teamId), eq(users.playerId, p.id))).limit(1);
    if (existUser.length > 0) continue;

    const roleSuffix = p.role === "Support" ? "sup" : p.role.toLowerCase();
    const roleNum = rosterPlayers.filter((rp: any) => rp.role === p.role).indexOf(p) + 1;
    const username = `${abbr.toLowerCase()}_${teamNum}_${roleSuffix}${roleNum}`;

    const existUsername = await db.select().from(users)
      .where(and(eq(users.teamId, teamId), eq(users.username, username))).limit(1);
    if (existUsername.length > 0) continue;

    await db.insert(users).values({
      teamId, username, passwordHash,
      playerId: p.id, roleId: playerRoleId,
      orgRole: "member", displayName: p.name, status: "active",
    });
    stats.users++;
  }

  for (const s of rosterStaff) {
    const roleSlug = s.role.toLowerCase().replace(/\s+/g, "");
    const username = `${abbr.toLowerCase()}_${teamNum}_${roleSlug}`;

    const existUsername = await db.select().from(users)
      .where(and(eq(users.teamId, teamId), eq(users.username, username))).limit(1);
    if (existUsername.length > 0) continue;

    await db.insert(users).values({
      teamId, username, passwordHash,
      roleId: staffRoleId,
      orgRole: "staff", displayName: s.name, status: "active",
    });
    stats.users++;
  }
}
