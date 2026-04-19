import { db } from "./db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { GAME_ABBREVIATIONS } from "@shared/schema";

export const RESET_PASSWORD = "TheBootcamp&2!@90A94";
export const LOAD_EXAMPLE_PASSWORD = "TheBootcamp&2!@90A94";

// ====================================================================
// TASK 1: Fix broken events in April/May 2026
// ====================================================================
const FIX_PATTERNS: { pattern: RegExp; subTypeName: string; categoryName: string }[] = [
  { pattern: /organization\s*meeting/i, subTypeName: "Organization Meeting", categoryName: "Meetings" },
  { pattern: /roster\s*meeting/i,        subTypeName: "Roster Meeting",        categoryName: "Meetings" },
  { pattern: /vod\s*review/i,            subTypeName: "Vod Review",            categoryName: "Meetings" },
  { pattern: /saudi\s*league/i,          subTypeName: "Saudi League",          categoryName: "Tournament" },
  { pattern: /stage\s*1/i,               subTypeName: "Stage 1",               categoryName: "Tournament" },
  { pattern: /elite/i,                   subTypeName: "Elite 3000$ Cup",       categoryName: "Tournament" },
  { pattern: /warm[\s-]*up/i,            subTypeName: "Warm-up",               categoryName: "Scrim" },
  { pattern: /practice/i,                subTypeName: "Practice",              categoryName: "Scrim" },
];

function pickSubType(title: string, existingSubText: string | null): { sub: string; cat: string } | null {
  for (const p of FIX_PATTERNS) {
    if (p.pattern.test(title)) return { sub: p.subTypeName, cat: p.categoryName };
  }
  if (existingSubText) {
    for (const p of FIX_PATTERNS) {
      if (p.pattern.test(existingSubText)) return { sub: p.subTypeName, cat: p.categoryName };
    }
  }
  return null;
}

export async function fixBrokenEventsAprilMay(): Promise<{ scanned: number; fixed: number; unmatched: any[] }> {
  const broken: any = await db.execute(sql`
    SELECT e.id, e.roster_id, e.title, e.event_type, e.event_sub_type
    FROM events e
    WHERE e.date >= '2026-04-01' AND e.date < '2026-06-01'
      AND (e.event_sub_type IS NULL
           OR e.event_sub_type = ''
           OR e.event_sub_type NOT IN (SELECT id FROM event_sub_types))
  `);
  const rows: any[] = broken.rows ?? [];
  let fixed = 0;
  const unmatched: any[] = [];
  for (const ev of rows) {
    const match = pickSubType(ev.title || "", ev.event_sub_type);
    if (!match) {
      unmatched.push({ id: ev.id, title: ev.title, sub: ev.event_sub_type });
      continue;
    }
    const sub: any = await db.execute(sql`
      SELECT id FROM event_sub_types
      WHERE roster_id = ${ev.roster_id} AND lower(name) = lower(${match.sub})
      LIMIT 1
    `);
    if (!sub.rows?.length) {
      unmatched.push({ id: ev.id, title: ev.title, reason: "no sub-type for roster", subName: match.sub });
      continue;
    }
    await db.execute(sql`
      UPDATE events
      SET event_sub_type = ${sub.rows[0].id}, event_type = ${match.cat}
      WHERE id = ${ev.id}
    `);
    fixed++;
  }
  return { scanned: rows.length, fixed, unmatched };
}

// ====================================================================
// TASK 2A: Reset (wipe) a single roster's data
// ====================================================================
export async function resetRosterData(rosterId: string): Promise<{ deletedUsers: number }> {
  // Find users whose ONLY game assignment is this roster (so we can delete them after)
  const candidateUsersRes: any = await db.execute(sql`
    SELECT DISTINCT uga.user_id AS user_id
    FROM user_game_assignments uga
    WHERE uga.roster_id = ${rosterId}
      AND NOT EXISTS (
        SELECT 1 FROM user_game_assignments uga2
        WHERE uga2.user_id = uga.user_id AND uga2.roster_id <> ${rosterId}
      )
  `);
  const userIds: string[] = (candidateUsersRes.rows ?? []).map((r: any) => r.user_id).filter(Boolean);

  // 0. CRITICAL: null out users.player_id pointing to this roster's players (prevents FK violation)
  await db.execute(sql`
    UPDATE users SET player_id = NULL
    WHERE player_id IN (SELECT id FROM players WHERE roster_id = ${rosterId})
  `);
  // 0b. null out staff.user_id references too (staff has user_id FK to users; will be safer)
  await db.execute(sql`
    UPDATE staff SET user_id = NULL WHERE roster_id = ${rosterId}
  `);
  // 1. player_game_stats (via games of this roster)
  await db.execute(sql`
    DELETE FROM player_game_stats
    WHERE match_id IN (SELECT id FROM games WHERE roster_id = ${rosterId})
  `);
  // 2. attendance
  await db.execute(sql`DELETE FROM attendance WHERE roster_id = ${rosterId}`);
  // 3. games
  await db.execute(sql`DELETE FROM games WHERE roster_id = ${rosterId}`);
  // 4. events
  await db.execute(sql`DELETE FROM events WHERE roster_id = ${rosterId}`);
  // 5. player_availability + players
  await db.execute(sql`DELETE FROM player_availability WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM players WHERE roster_id = ${rosterId}`);
  // 6. staff_availability + staff
  await db.execute(sql`DELETE FROM staff_availability WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM staff WHERE roster_id = ${rosterId}`);
  // 7. chat
  await db.execute(sql`
    DELETE FROM chat_messages
    WHERE channel_id IN (SELECT id FROM chat_channels WHERE roster_id = ${rosterId})
  `);
  await db.execute(sql`
    DELETE FROM chat_channel_permissions
    WHERE channel_id IN (SELECT id FROM chat_channels WHERE roster_id = ${rosterId})
  `);
  await db.execute(sql`DELETE FROM chat_channels WHERE roster_id = ${rosterId}`);
  // 8. availability_slots
  await db.execute(sql`DELETE FROM availability_slots WHERE roster_id = ${rosterId}`);
  // 9. game config: stat_fields, maps, game_modes, seasons
  await db.execute(sql`DELETE FROM stat_fields WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM maps WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM game_modes WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM seasons WHERE roster_id = ${rosterId}`);
  // 10. event sub-types + categories
  await db.execute(sql`DELETE FROM event_sub_types WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM event_categories WHERE roster_id = ${rosterId}`);
  // 11. roster_roles
  await db.execute(sql`DELETE FROM roster_roles WHERE roster_id = ${rosterId}`);
  // 12. extras
  await db.execute(sql`DELETE FROM off_days WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM schedules WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM team_notes WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM settings WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM roles WHERE roster_id = ${rosterId} AND COALESCE(is_system, false) = false`);
  // 13. user_game_assignments for this roster
  await db.execute(sql`DELETE FROM user_game_assignments WHERE roster_id = ${rosterId}`);
  // 14. delete users whose only assignment was this roster
  let deletedUsers = 0;
  for (const uid of userIds) {
    const r: any = await db.execute(sql`DELETE FROM users WHERE id = ${uid} RETURNING id`);
    if (r.rows?.length) deletedUsers++;
  }
  return { deletedUsers };
}

// ====================================================================
// TASK 2B: Load example data
// ====================================================================
const OPPONENTS = [
  "Falcons", "Liquid", "Vitality", "FaZe", "Twisted Minds",
  "Virtus Pro", "GenG", "Karmine Corp", "T1", "100 Thieves", "G2",
];

const ROLE_DEFS = [
  { role: "Tank", labels: ["Tank1", "Tank2"] },
  { role: "DPS", labels: ["DPS1", "DPS2"] },
  { role: "Support", labels: ["Sup1", "Sup2"] },
  { role: "Flex", labels: ["Flex1", "Flex2"] },
];

const STAFF_DEFS = [
  { name: "Head Coach", role: "Head Coach", short: "coach" },
  { name: "Assistant Coach", role: "Assistant Coach", short: "asscoach" },
  { name: "Analyst", role: "Analyst", short: "analyst" },
  { name: "Manager", role: "Manager", short: "manager" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AVAIL_OPTIONS = ["available", "busy", "maybe"];

const STAT_FIELDS_BY_MODE: Record<string, string[]> = {
  "Game Mode 1": ["Kill", "Death", "Assist", "Time"],
  "Game Mode 2": ["Kill", "Death", "Plant", "Defuse"],
  "Game Mode 3": ["Kill", "Death", "Goal", "Assist"],
};

const MAPS_BY_MODE: Record<string, string[]> = {
  "Game Mode 1": ["Map 1", "Map 2", "Map 3"],
  "Game Mode 2": ["Map 4", "Map 5", "Map 6"],
  "Game Mode 3": ["Map 7", "Map 8", "Map 9"],
};

const CATEGORIES = [
  { name: "Scrim", color: "#3b82f6", subs: ["Practice", "Warm-up"] },
  { name: "Tournament", color: "#ef4444", subs: ["Stage 1", "Saudi League", "Elite 3000$ Cup"] },
  { name: "Meetings", color: "#a855f7", subs: ["Vod Review", "Roster Meeting", "Organization Meeting"] },
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function pad2(n: number) { return n.toString().padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export async function loadExampleData(rosterId: string): Promise<{
  events: number; games: number; players: number; staff: number; users: number;
}> {
  // Wipe first
  await resetRosterData(rosterId);

  // Look up roster + game info
  const rosterRes: any = await db.execute(sql`
    SELECT r.id, r.team_id, r.game_id, r.name, r.slug, r.sort_order, sg.slug AS game_slug, sg.name AS game_name
    FROM rosters r
    JOIN supported_games sg ON sg.id = r.game_id
    WHERE r.id = ${rosterId}
    LIMIT 1
  `);
  if (!rosterRes.rows?.length) throw new Error("Roster not found");
  const r = rosterRes.rows[0];
  const teamId: string | null = r.team_id;
  const gameId: string = r.game_id;
  const gameSlug: string = r.game_slug;
  const abbrevUpper: string = (GAME_ABBREVIATIONS as any)[gameSlug] || gameSlug.toUpperCase();
  const abbrevLower: string = abbrevUpper.toLowerCase();
  const teamN: number = (r.sort_order ?? 0) + 1;
  const userTag: string = `${gameSlug}_${(r.id as string).replace(/-/g, "").slice(0, 8)}`;

  // ---------- Game Config ----------
  // Game modes
  const modeIds: Record<string, string> = {};
  for (const modeName of ["Game Mode 1", "Game Mode 2", "Game Mode 3"]) {
    const ins: any = await db.execute(sql`
      INSERT INTO game_modes (team_id, game_id, roster_id, name, sort_order)
      VALUES (${teamId}, ${gameId}, ${rosterId}, ${modeName}, ${"0"}) RETURNING id
    `);
    modeIds[modeName] = ins.rows[0].id;
  }
  // Maps
  const mapsByMode: Record<string, { id: string; name: string }[]> = {};
  for (const [modeName, mapNames] of Object.entries(MAPS_BY_MODE)) {
    mapsByMode[modeName] = [];
    for (const mn of mapNames) {
      const ins: any = await db.execute(sql`
        INSERT INTO maps (team_id, game_id, roster_id, name, game_mode_id, sort_order)
        VALUES (${teamId}, ${gameId}, ${rosterId}, ${mn}, ${modeIds[modeName]}, ${"0"}) RETURNING id
      `);
      mapsByMode[modeName].push({ id: ins.rows[0].id, name: mn });
    }
  }
  // Seasons
  const seasonIds: string[] = [];
  for (const sn of ["Season 1", "Season 2"]) {
    const ins: any = await db.execute(sql`
      INSERT INTO seasons (team_id, game_id, roster_id, name) VALUES (${teamId}, ${gameId}, ${rosterId}, ${sn}) RETURNING id
    `);
    seasonIds.push(ins.rows[0].id);
  }
  // Roster roles
  for (const rn of ["Tank", "DPS", "Support", "Flex"]) {
    await db.execute(sql`
      INSERT INTO roster_roles (team_id, game_id, roster_id, name, type, sort_order)
      VALUES (${teamId}, ${gameId}, ${rosterId}, ${rn}, ${"player"}, ${0})
    `);
  }
  // Stat fields
  const statFieldsByMode: Record<string, { id: string; name: string }[]> = {};
  for (const [modeName, fieldNames] of Object.entries(STAT_FIELDS_BY_MODE)) {
    statFieldsByMode[modeName] = [];
    for (const fn of fieldNames) {
      const ins: any = await db.execute(sql`
        INSERT INTO stat_fields (team_id, game_id, roster_id, name, game_mode_id)
        VALUES (${teamId}, ${gameId}, ${rosterId}, ${fn}, ${modeIds[modeName]}) RETURNING id
      `);
      statFieldsByMode[modeName].push({ id: ins.rows[0].id, name: fn });
    }
  }
  // Event categories + sub-types — insert FIRST, then re-query for verification
  const catIdByName: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const catIns: any = await db.execute(sql`
      INSERT INTO event_categories (team_id, game_id, roster_id, name, color, sort_order)
      VALUES (${teamId}, ${gameId}, ${rosterId}, ${cat.name}, ${cat.color}, ${0}) RETURNING id
    `);
    catIdByName[cat.name] = catIns.rows[0].id;
    for (const sn of cat.subs) {
      await db.execute(sql`
        INSERT INTO event_sub_types (team_id, game_id, roster_id, category_id, name, color, sort_order)
        VALUES (${teamId}, ${gameId}, ${rosterId}, ${catIdByName[cat.name]}, ${sn}, ${cat.color}, ${0})
      `);
    }
  }
  // Re-query everything back from the DB to make sure we use the IDs that actually exist
  const catRowsRes: any = await db.execute(sql`
    SELECT id, name FROM event_categories WHERE roster_id = ${rosterId}
  `);
  const subRowsRes: any = await db.execute(sql`
    SELECT id, name, category_id FROM event_sub_types WHERE roster_id = ${rosterId}
  `);
  const catIdToName: Record<string, string> = {};
  const catNameToId: Record<string, string> = {};
  for (const row of (catRowsRes.rows ?? [])) {
    catIdToName[row.id] = row.name;
    catNameToId[row.name] = row.id;
  }
  const subTypesByCat: Record<string, { id: string; name: string }[]> = {};
  for (const row of (subRowsRes.rows ?? [])) {
    const catName = catIdToName[row.category_id];
    if (!catName) continue;
    if (!subTypesByCat[catName]) subTypesByCat[catName] = [];
    subTypesByCat[catName].push({ id: row.id, name: row.name });
  }
  // Verify every category we expect exists with sub-types
  for (const cat of CATEGORIES) {
    if (!subTypesByCat[cat.name] || subTypesByCat[cat.name].length === 0) {
      throw new Error(`Failed to seed sub-types for category "${cat.name}" on roster ${rosterId}`);
    }
  }

  // ---------- Players + their user accounts ----------
  const passwordHash = bcrypt.hashSync("0000", 10);
  const players: { id: string; name: string; role: string; userId: string }[] = [];
  for (const rd of ROLE_DEFS) {
    for (const lbl of rd.labels) {
      const playerName = `${abbrevUpper}_T${teamN}_${lbl}`;
      const pIns: any = await db.execute(sql`
        INSERT INTO players (team_id, game_id, roster_id, name, role)
        VALUES (${teamId}, ${gameId}, ${rosterId}, ${playerName}, ${rd.role}) RETURNING id
      `);
      const pid: string = pIns.rows[0].id;
      // Player availability
      for (const day of DAYS) {
        await db.execute(sql`
          INSERT INTO player_availability (team_id, game_id, roster_id, player_id, day, availability)
          VALUES (${teamId}, ${gameId}, ${rosterId}, ${pid}, ${day}, ${rand(AVAIL_OPTIONS)})
        `);
      }
      const username = `${userTag}_${lbl.toLowerCase()}`;
      const uIns: any = await db.execute(sql`
        INSERT INTO users (team_id, username, password_hash, org_role, status, player_id)
        VALUES (${teamId}, ${username}, ${passwordHash}, ${"member"}, ${"active"}, ${pid}) RETURNING id
      `);
      const uid: string = uIns.rows[0].id;
      await db.execute(sql`
        INSERT INTO user_game_assignments (team_id, user_id, game_id, roster_id, assigned_role, status, approval_game_status, approval_org_status)
        VALUES (${teamId}, ${uid}, ${gameId}, ${rosterId}, ${rd.role}, ${"approved"}, ${"approved"}, ${"approved"})
      `);
      players.push({ id: pid, name: playerName, role: rd.role, userId: uid });
    }
  }

  // ---------- Staff + their user accounts ----------
  let staffCount = 0;
  for (const sd of STAFF_DEFS) {
    const sIns: any = await db.execute(sql`
      INSERT INTO staff (team_id, game_id, roster_id, name, role)
      VALUES (${teamId}, ${gameId}, ${rosterId}, ${sd.name}, ${sd.role}) RETURNING id
    `);
    const sid: string = sIns.rows[0].id;
    for (const day of DAYS) {
      await db.execute(sql`
        INSERT INTO staff_availability (team_id, game_id, roster_id, staff_id, day, availability)
        VALUES (${teamId}, ${gameId}, ${rosterId}, ${sid}, ${day}, ${rand(AVAIL_OPTIONS)})
      `);
    }
    const username = `${userTag}_${sd.short}`;
    const uIns: any = await db.execute(sql`
      INSERT INTO users (team_id, username, password_hash, org_role, status)
      VALUES (${teamId}, ${username}, ${passwordHash}, ${"staff"}, ${"active"}) RETURNING id
    `);
    const uid: string = uIns.rows[0].id;
    await db.execute(sql`
      UPDATE staff SET user_id = ${uid} WHERE id = ${sid}
    `);
    await db.execute(sql`
      INSERT INTO user_game_assignments (team_id, user_id, game_id, roster_id, assigned_role, status, approval_game_status, approval_org_status)
      VALUES (${teamId}, ${uid}, ${gameId}, ${rosterId}, ${sd.role}, ${"approved"}, ${"approved"}, ${"approved"})
    `);
    staffCount++;
  }

  // ---------- Events / Games / Stats / Attendance ----------
  const today = new Date();
  const start = new Date(today); start.setMonth(start.getMonth() - 1);
  const end = new Date(today); end.setMonth(end.getMonth() + 1);

  const subPractice = subTypesByCat["Scrim"].find(s => s.name === "Practice")!;
  const subWarmup = subTypesByCat["Scrim"].find(s => s.name === "Warm-up")!;
  const tournSubs = subTypesByCat["Tournament"];
  const meetingSubs = subTypesByCat["Meetings"];
  const allModes = Object.keys(modeIds);

  let eventCount = 0;
  let gameCount = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay(); // 0=Sun ... 4=Thu, 5=Fri
    const dateStr = isoDate(d);
    if (dow === 4 || dow === 5) {
      // Off day
      await db.execute(sql`
        INSERT INTO off_days (team_id, game_id, roster_id, date)
        VALUES (${teamId}, ${gameId}, ${rosterId}, ${dateStr})
      `);
      continue;
    }

    // Build day's event mix
    const dayEvents: { kind: "scrim_practice" | "scrim_warmup" | "tournament" | "meeting"; time: string; subId: string; subName: string; title: string; }[] = [];

    // Always 1 practice scrim
    dayEvents.push({ kind: "scrim_practice", time: "16:00", subId: subPractice.id, subName: subPractice.name, title: "Practice" });

    // ~50% chance of a tournament
    if (Math.random() < 0.5) {
      const t = rand(tournSubs);
      dayEvents.push({ kind: "scrim_warmup", time: "18:00", subId: subWarmup.id, subName: subWarmup.name, title: `Warm-up vs ${rand(OPPONENTS)}` });
      dayEvents.push({ kind: "tournament", time: "19:00", subId: t.id, subName: t.name, title: `${t.name} vs ${rand(OPPONENTS)}` });
    }

    // ~30% chance of a meeting
    if (Math.random() < 0.3) {
      const m = rand(meetingSubs);
      dayEvents.push({ kind: "meeting", time: "15:00", subId: m.id, subName: m.name, title: m.name });
    }

    for (const ev of dayEvents) {
      const eventTypeStr =
        ev.kind === "tournament" ? "Tournament" :
        ev.kind === "meeting" ? "Meetings" : "Scrim";
      const evIns: any = await db.execute(sql`
        INSERT INTO events (team_id, game_id, roster_id, title, event_type, event_sub_type, date, time, season_id)
        VALUES (${teamId}, ${gameId}, ${rosterId}, ${ev.title}, ${eventTypeStr}, ${ev.subId}, ${dateStr}, ${ev.time}, ${rand(seasonIds)})
        RETURNING id
      `);
      const eventId: string = evIns.rows[0].id;
      eventCount++;

      // Attendance for everyone
      for (const p of players) {
        const status = rand(["attended", "attended", "attended", "late", "absent"]);
        await db.execute(sql`
          INSERT INTO attendance (team_id, game_id, roster_id, player_id, date, event_id, status)
          VALUES (${teamId}, ${gameId}, ${rosterId}, ${p.id}, ${dateStr}, ${eventId}, ${status})
        `);
      }

      // Games (only for scrim/tournament, 5 each)
      if (ev.kind !== "meeting") {
        for (let g = 1; g <= 5; g++) {
          const modeName = rand(allModes);
          const map = rand(mapsByMode[modeName]);
          const fields = statFieldsByMode[modeName];
          const score = `${randInt(0, 16)}-${randInt(0, 16)}`;
          const gameIns: any = await db.execute(sql`
            INSERT INTO games (team_id, game_id, roster_id, event_id, game_code, score, game_mode_id, map_id, result)
            VALUES (${teamId}, ${gameId}, ${rosterId}, ${eventId}, ${`G${g}`}, ${score}, ${modeIds[modeName]}, ${map.id}, ${rand(["win", "loss", "draw"])})
            RETURNING id
          `);
          const matchId: string = gameIns.rows[0].id;
          gameCount++;

          // Player stats: every player x every field
          for (const p of players) {
            for (const f of fields) {
              await db.execute(sql`
                INSERT INTO player_game_stats (team_id, game_id, match_id, player_id, stat_field_id, value)
                VALUES (${teamId}, ${gameId}, ${matchId}, ${p.id}, ${f.id}, ${randInt(0, 25).toString()})
              `);
            }
          }
        }
      }
    }
  }

  return {
    events: eventCount,
    games: gameCount,
    players: players.length,
    staff: staffCount,
    users: players.length + staffCount,
  };
}
