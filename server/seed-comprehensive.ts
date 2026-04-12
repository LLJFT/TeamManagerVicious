import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  players, staff as staffTable, events, games, playerGameStats, attendance,
  offDays, seasons, gameModes, maps, statFields as statFieldsTable,
  chatChannels, chatMessages, playerAvailability, staffAvailability,
  supportedGames, rosters, users,
  GAME_ABBREVIATIONS,
} from "@shared/schema";
import { getTeamId } from "./storage";

const OPPONENTS = ["Falcons", "Liquid", "Vitality", "FaZe", "Twisted Minds", "Virtus Pro", "GenG", "Karmine Corp", "T1", "100 Thieves", "G2"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const AVAIL_SLOTS = ["Unknown", "18:00-20:00", "20:00-22:00", "All Blocks", "Can't"];

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function genDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, m === 4 ? 10 : 31)).padStart(2, '0')}`;
}
function genTime(): string {
  return `${String(randomFrom([14, 15, 16, 17, 18, 19, 20, 21])).padStart(2, '0')}:${String(randomFrom([0, 15, 30, 45])).padStart(2, '0')}`;
}

export async function seedComprehensiveTestData() {
  const teamId = getTeamId();
  const allGames = await db.select().from(supportedGames);
  const allRosters = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
  const adminUsers = await db.select().from(users).where(eq(users.teamId, teamId)).limit(1);
  const adminUserId = adminUsers[0]?.id;

  if (allRosters.length === 0) {
    console.log("[seed] No rosters found, skipping comprehensive seeding.");
    return;
  }

  const existingEventCount = await db.select({ count: sql<number>`count(*)` }).from(events).where(eq(events.teamId, teamId));
  const existingChatCount = await db.select({ count: sql<number>`count(*)` }).from(chatMessages).where(eq(chatMessages.teamId, teamId));
  const existingAvailCount = await db.select({ count: sql<number>`count(*)` }).from(playerAvailability).where(eq(playerAvailability.teamId, teamId));
  const existingStaffAvailCount = await db.select({ count: sql<number>`count(*)` }).from(staffAvailability).where(eq(staffAvailability.teamId, teamId));
  const existingOffDayCount = await db.select({ count: sql<number>`count(*)` }).from(offDays).where(eq(offDays.teamId, teamId));

  const evCount = Number(existingEventCount[0]?.count || 0);
  const chatCount = Number(existingChatCount[0]?.count || 0);
  const availCount = Number(existingAvailCount[0]?.count || 0);
  const staffAvCount = Number(existingStaffAvailCount[0]?.count || 0);
  const offDayCount = Number(existingOffDayCount[0]?.count || 0);

  const needsAvailability = availCount < allRosters.length * 4;
  const needsStaffAvailability = staffAvCount < allRosters.length * 2;
  const needsChatMessages = chatCount < allRosters.length * 5;
  const needsOffDays = offDayCount < allRosters.length * 2;
  const needsEvents = evCount < allRosters.length * 20;

  if (!needsAvailability && !needsStaffAvailability && !needsChatMessages && !needsOffDays && !needsEvents) {
    console.log("[seed] Comprehensive test data already complete. Skipping.");
    return;
  }

  console.log("[seed] Adding missing comprehensive test data...");
  let stats = { avail: 0, staffAvail: 0, offDays: 0, events: 0, matches: 0, playerStats: 0, attendance: 0, chat: 0 };

  for (const roster of allRosters) {
    const game = allGames.find(g => g.id === roster.gameId);
    if (!game) continue;

    const abbr = GAME_ABBREVIATIONS[game.slug as keyof typeof GAME_ABBREVIATIONS] || game.slug.toUpperCase().slice(0, 3);
    const sortIdx = roster.sortOrder ?? 0;
    const rosterType = sortIdx === 0 ? "T1" : `T${sortIdx + 1}`;
    const playerSuffix = sortIdx === 0 ? "" : `_${rosterType}`;

    const rosterPlayers = await db.select().from(players)
      .where(and(eq(players.teamId, teamId), eq(players.gameId, game.id), eq(players.rosterId, roster.id)));

    const rosterStaff = await db.select().from(staffTable)
      .where(and(eq(staffTable.teamId, teamId), eq(staffTable.gameId, game.id), eq(staffTable.rosterId, roster.id)));

    if (needsAvailability && rosterPlayers.length > 0) {
      const existPA = await db.select().from(playerAvailability)
        .where(and(eq(playerAvailability.teamId, teamId), eq(playerAvailability.gameId, game.id), eq(playerAvailability.rosterId, roster.id)))
        .limit(1);
      if (existPA.length === 0) {
        for (const p of rosterPlayers) {
          for (const day of DAYS) {
            await db.insert(playerAvailability).values({
              teamId, gameId: game.id, rosterId: roster.id,
              playerId: p.id, day, availability: randomFrom(AVAIL_SLOTS),
            });
            stats.avail++;
          }
        }
      }
    }

    if (needsStaffAvailability && rosterStaff.length > 0) {
      const existSA = await db.select().from(staffAvailability)
        .where(and(eq(staffAvailability.teamId, teamId), eq(staffAvailability.gameId, game.id), eq(staffAvailability.rosterId, roster.id)))
        .limit(1);
      if (existSA.length === 0) {
        for (const s of rosterStaff) {
          for (const day of DAYS) {
            await db.insert(staffAvailability).values({
              teamId, gameId: game.id, rosterId: roster.id,
              staffId: s.id, day, availability: randomFrom(AVAIL_SLOTS),
            });
            stats.staffAvail++;
          }
        }
      }
    }

    if (needsOffDays) {
      const existOD = await db.select().from(offDays)
        .where(and(eq(offDays.teamId, teamId), eq(offDays.gameId, game.id), eq(offDays.rosterId, roster.id)))
        .limit(1);
      if (existOD.length === 0) {
        for (const d of [genDate(2026, 3, 8), genDate(2026, 3, 22), genDate(2026, 4, 5)]) {
          await db.insert(offDays).values({ teamId, gameId: game.id, rosterId: roster.id, date: d });
          stats.offDays++;
        }
      }
    }

    if (needsChatMessages) {
      const existCh = await db.select().from(chatMessages)
        .where(eq(chatMessages.teamId, teamId))
        .limit(1);
      const channels = await db.select().from(chatChannels)
        .where(and(eq(chatChannels.teamId, teamId), eq(chatChannels.gameId, game.id), eq(chatChannels.rosterId, roster.id)))
        .limit(1);

      if (channels.length > 0) {
        const chId = channels[0].id;
        const existMsg = await db.select({ count: sql<number>`count(*)` }).from(chatMessages)
          .where(eq(chatMessages.channelId, chId));
        if (Number(existMsg[0]?.count || 0) < 5) {
          const texts = [
            "Good practice today, let's keep the momentum going!",
            "We need to work on our rotations for next match.",
            "Everyone review the VOD before tomorrow's scrim.",
            "New strat ideas posted in the strategy channel.",
            "Great win tonight! Solid teamwork all around.",
          ];
          for (const msg of texts) {
            await db.insert(chatMessages).values({
              teamId, gameId: game.id, channelId: chId,
              userId: adminUserId, message: msg,
              createdAt: new Date(Date.now() - randomInt(0, 7 * 86400000)).toISOString(),
            });
            stats.chat++;
          }
          for (let i = 0; i < 2; i++) {
            await db.insert(chatMessages).values({
              teamId, gameId: game.id, channelId: chId,
              userId: adminUserId, message: `Scoreboard from match ${i + 1}`,
              attachmentUrl: "/uploads/general/IMG_4357.png",
              attachmentType: "image", attachmentName: "IMG_4357.png", attachmentSize: 45000,
              createdAt: new Date(Date.now() - randomInt(0, 3 * 86400000)).toISOString(),
            });
            stats.chat++;
          }
          await db.insert(chatMessages).values({
            teamId, gameId: game.id, channelId: chId,
            userId: adminUserId, message: "Voice note from coach",
            attachmentUrl: "/uploads/general/IMG_4357.png",
            attachmentType: "audio", attachmentName: "voice_note.ogg", attachmentSize: 128000,
            createdAt: new Date(Date.now() - randomInt(0, 2 * 86400000)).toISOString(),
          });
          stats.chat++;
          await db.insert(chatMessages).values({
            teamId, gameId: game.id, channelId: chId,
            userId: adminUserId, message: "Updated tournament bracket",
            attachmentUrl: "/uploads/general/IMG_4357.png",
            attachmentType: "file", attachmentName: "bracket.pdf", attachmentSize: 256000,
            createdAt: new Date(Date.now() - randomInt(0, 86400000)).toISOString(),
          });
          stats.chat++;
        }
      }
    }

    if (needsEvents) {
      const existEv = await db.select({ count: sql<number>`count(*)` }).from(events)
        .where(and(eq(events.teamId, teamId), eq(events.gameId, game.id), eq(events.rosterId, roster.id)));
      if (Number(existEv[0]?.count || 0) >= 25) continue;

      let rosterSeason = await db.select().from(seasons)
        .where(and(eq(seasons.teamId, teamId), eq(seasons.gameId, game.id), eq(seasons.rosterId, roster.id)))
        .limit(1);
      let seasonId: string;
      if (rosterSeason.length > 0) {
        seasonId = rosterSeason[0].id;
      } else {
        const [s] = await db.insert(seasons).values({
          teamId, gameId: game.id, rosterId: roster.id,
          name: "Spring 2026", description: "Spring competitive season",
        }).returning();
        seasonId = s.id;
      }

      let rosterModes = await db.select().from(gameModes)
        .where(and(eq(gameModes.teamId, teamId), eq(gameModes.gameId, game.id), eq(gameModes.rosterId, roster.id)));
      let gameModeId: string;
      if (rosterModes.length > 0) {
        gameModeId = rosterModes[0].id;
      } else {
        const [gm] = await db.insert(gameModes).values({
          teamId, gameId: game.id, rosterId: roster.id, name: "Competitive", sortOrder: "0",
        }).returning();
        gameModeId = gm.id;
      }

      let rosterMaps = await db.select().from(maps)
        .where(and(eq(maps.teamId, teamId), eq(maps.gameId, game.id), eq(maps.rosterId, roster.id)));
      if (rosterMaps.length === 0) {
        for (const mn of ["Map Alpha", "Map Beta", "Map Gamma", "Map Delta", "Map Epsilon"]) {
          const [m] = await db.insert(maps).values({
            teamId, gameId: game.id, rosterId: roster.id, name: mn, gameModeId, sortOrder: "0",
          }).returning();
          rosterMaps.push(m);
        }
      }

      let rosterStatFields = await db.select().from(statFieldsTable)
        .where(and(eq(statFieldsTable.teamId, teamId), eq(statFieldsTable.gameId, game.id), eq(statFieldsTable.rosterId, roster.id)));
      if (rosterStatFields.length === 0) {
        for (const sf of ["Kills", "Deaths", "Assists", "Damage"]) {
          const [s] = await db.insert(statFieldsTable).values({
            teamId, gameId: game.id, rosterId: roster.id, name: sf, gameModeId,
          }).returning();
          rosterStatFields.push(s);
        }
      }

      const scrimSubs = ["Practice", "Warm-up"];
      const tourneySubs = ["Stage 1", "Saudi League", "Elite 3000$ Cup"];
      const meetingSubs = ["Vod Review", "Roster Meeting", "Organization Meeting"];
      const tourneyTitles = [
        "Group Stage Match 1", "Group Stage Match 2", "Group Stage Match 3",
        "Quarter-Final", "Semi-Final", "Grand Final",
        "Saudi League Week 1", "Saudi League Week 2", "Saudi League Week 3",
        "Elite Cup Round 1",
      ];
      const meetingTitles = [
        "Weekly VOD Review Session", "Pre-Tournament Strategy Meeting",
        "Org-Wide Performance Review", "Post-Match Analysis",
        "Roster Swap Discussion",
      ];

      type EvDef = { title: string; type: string; sub: string | null; date: string; withGames: boolean };
      const evDefs: EvDef[] = [];

      for (let i = 0; i < 12; i++) {
        const day = 1 + Math.floor(i * 3.3);
        const m = day > 31 ? 4 : 3;
        const d = day > 31 ? day - 31 : day;
        evDefs.push({ title: `Scrim vs ${OPPONENTS[i % OPPONENTS.length]}`, type: "Scrim", sub: scrimSubs[i % 2], date: genDate(2026, m, d), withGames: true });
      }
      for (let i = 0; i < 10; i++) {
        const day = 2 + i * 4;
        const m = day > 31 ? 4 : 3;
        const d = day > 31 ? day - 31 : day;
        evDefs.push({ title: tourneyTitles[i], type: "Tournament", sub: tourneySubs[i % 3], date: genDate(2026, m, d), withGames: true });
      }
      for (let i = 0; i < 5; i++) {
        const day = 5 + i * 7;
        const m = day > 31 ? 4 : 3;
        const d = day > 31 ? day - 31 : day;
        evDefs.push({ title: meetingTitles[i], type: "Meetings", sub: meetingSubs[i % 3], date: genDate(2026, m, d), withGames: false });
      }

      for (const ev of evDefs) {
        const opp = ev.title.includes(" vs ") ? ev.title.split(" vs ")[1] : randomFrom(OPPONENTS);
        const [inserted] = await db.insert(events).values({
          teamId, gameId: game.id, rosterId: roster.id,
          title: ev.title, eventType: ev.type, eventSubType: ev.sub,
          date: ev.date, time: genTime(),
          description: `${ev.type} event for ${roster.name}`,
          opponentName: opp, seasonId,
          result: ev.withGames ? randomFrom(["Win", "Loss", "Draw"]) : null,
        }).returning();
        stats.events++;

        const allPeople = [
          ...rosterPlayers.map(p => ({ playerId: p.id, staffId: null as string | null })),
          ...rosterStaff.map(s => ({ playerId: null as string | null, staffId: s.id })),
        ];
        for (const person of allPeople) {
          await db.insert(attendance).values({
            teamId, gameId: game.id, rosterId: roster.id,
            playerId: person.playerId, staffId: person.staffId,
            eventId: inserted.id, date: ev.date,
            status: randomFrom(["Present", "Present", "Present", "Present", "Late", "Absent"]),
          });
          stats.attendance++;
        }

        if (ev.withGames) {
          for (let g = 0; g < 5; g++) {
            const score = `${randomInt(0, 3)}-${randomInt(0, 3)}`;
            const [match] = await db.insert(games).values({
              teamId, gameId: game.id, rosterId: roster.id,
              eventId: inserted.id, gameCode: `Game ${g + 1}`,
              score, imageUrl: "/uploads/general/IMG_4357.png",
              gameModeId, mapId: rosterMaps[g % rosterMaps.length].id,
              result: randomFrom(["Win", "Loss"]),
              link: `https://youtube.com/watch?v=vod_${abbr}_${rosterType}_${g}`,
            }).returning();
            stats.matches++;

            for (const p of rosterPlayers) {
              for (const sf of rosterStatFields) {
                await db.insert(playerGameStats).values({
                  teamId, gameId: game.id,
                  matchId: match.id, playerId: p.id,
                  statFieldId: sf.id, value: String(randomInt(0, 30)),
                });
                stats.playerStats++;
              }
            }
          }
        }
      }
    }
  }

  console.log(`[seed] Comprehensive test data seeding complete!`);
  console.log(`[seed]   Player availability: ${stats.avail}`);
  console.log(`[seed]   Staff availability: ${stats.staffAvail}`);
  console.log(`[seed]   Off days: ${stats.offDays}`);
  console.log(`[seed]   Events: ${stats.events}`);
  console.log(`[seed]   Matches: ${stats.matches}`);
  console.log(`[seed]   Player stats: ${stats.playerStats}`);
  console.log(`[seed]   Attendance: ${stats.attendance}`);
  console.log(`[seed]   Chat messages: ${stats.chat}`);
}
