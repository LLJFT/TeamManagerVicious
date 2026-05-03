import { db } from "./db";
import { sql, type SQL } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { GAME_ABBREVIATIONS, type GameTemplateConfig } from "@shared/schema";
import { OPPONENT_SEEDS_BY_GAME_SLUG, type RealOpponent } from "./defaults/realOpponents";

// ---------------------------------------------------------------------------
// Bulk-insert helpers. Each call is a SINGLE round-trip with multi-row VALUES,
// which is 10–100x faster than looping per-row INSERTs on a remote DB.
// ---------------------------------------------------------------------------
function rowToValuesSql(values: any[]): SQL {
  return sql.join([sql`(`, sql.join(values.map(v => sql`${v}`), sql`, `), sql`)`]);
}
async function bulkInsert(
  table: string,
  columns: string[],
  rows: any[][],
): Promise<void> {
  if (rows.length === 0) return;
  const colList = sql.raw(columns.join(", "));
  const tbl = sql.raw(table);
  const valuesSql = sql.join(rows.map(r => rowToValuesSql(r)), sql`, `);
  await db.execute(sql`INSERT INTO ${tbl} (${colList}) VALUES ${valuesSql}`);
}
async function bulkInsertReturningIds(
  table: string,
  columns: string[],
  rows: any[][],
): Promise<string[]> {
  if (rows.length === 0) return [];
  const colList = sql.raw(columns.join(", "));
  const tbl = sql.raw(table);
  const valuesSql = sql.join(rows.map(r => rowToValuesSql(r)), sql`, `);
  const res: any = await db.execute(
    sql`INSERT INTO ${tbl} (${colList}) VALUES ${valuesSql} RETURNING id`,
  );
  // Postgres preserves insertion order in RETURNING, so this maps 1:1 to rows.
  return (res.rows ?? []).map((r: any) => r.id);
}
// Postgres caps prepared-statement params at 32k. Chunk wide bulk inserts to
// stay safely below that even with ~10 columns and large row counts.
const BULK_CHUNK = 500;
async function bulkInsertChunked(table: string, columns: string[], rows: any[][]): Promise<void> {
  for (let i = 0; i < rows.length; i += BULK_CHUNK) {
    await bulkInsert(table, columns, rows.slice(i, i + BULK_CHUNK));
  }
}
// Pre-generate UUIDs client-side and prepend them to each row so we don't
// depend on `INSERT ... RETURNING id` preserving VALUES order (Postgres does
// not contractually guarantee that). All `id` columns in this schema default
// to gen_random_uuid(), so providing a UUID is equivalent.
async function bulkInsertWithIds(table: string, columns: string[], rows: any[][]): Promise<string[]> {
  if (rows.length === 0) return [];
  const ids = rows.map(() => crypto.randomUUID());
  const colsWithId = ["id", ...columns];
  const rowsWithId = rows.map((r, i) => [ids[i], ...r]);
  for (let i = 0; i < rowsWithId.length; i += BULK_CHUNK) {
    await bulkInsert(table, colsWithId, rowsWithId.slice(i, i + BULK_CHUNK));
  }
  return ids;
}

export const RESET_PASSWORD = "TheBootcamp&2!@90A94";
export const LOAD_EXAMPLE_PASSWORD = "TheBootcamp&2!@90A94";

// ====================================================================
// In-memory job tracker for long-running async operations
// ====================================================================
type JobStatus = "running" | "completed" | "failed";
interface Job {
  id: string;
  type: string;
  status: JobStatus;
  startedAt: number;
  finishedAt?: number;
  result?: any;
  error?: string;
  message?: string;
}
const jobs = new Map<string, Job>();

function newJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function startJob<T>(type: string, work: (jobId: string) => Promise<T>): Job {
  const job: Job = {
    id: newJobId(),
    type,
    status: "running",
    startedAt: Date.now(),
    message: "Starting...",
  };
  jobs.set(job.id, job);
  // Fire-and-forget; updates happen via the closure. Pass the job id into
  // `work` so the work fn can call setJobMessage(jobId, …) for live progress.
  work(job.id)
    .then((res) => {
      job.status = "completed";
      job.finishedAt = Date.now();
      job.result = res;
      job.message = "Completed";
    })
    .catch((err) => {
      job.status = "failed";
      job.finishedAt = Date.now();
      job.error = err?.message || String(err);
      job.message = "Failed";
      console.error(`[job ${job.id}] ${type} failed:`, err);
    });
  // Auto-clean after 1 hour
  setTimeout(() => jobs.delete(job.id), 60 * 60 * 1000);
  return job;
}

export function getJob(id: string): Job | null {
  return jobs.get(id) || null;
}

export function setJobMessage(id: string, message: string) {
  const j = jobs.get(id);
  if (j) j.message = message;
}

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

// Default fallback sub-type when no title pattern matches
const DEFAULT_FALLBACK = { subTypeName: "Stage 1", categoryName: "Tournament" };

function pickSubType(title: string, existingSubText: string | null): { sub: string; cat: string } {
  for (const p of FIX_PATTERNS) {
    if (p.pattern.test(title)) return { sub: p.subTypeName, cat: p.categoryName };
  }
  if (existingSubText) {
    for (const p of FIX_PATTERNS) {
      if (p.pattern.test(existingSubText)) return { sub: p.subTypeName, cat: p.categoryName };
    }
  }
  // Default for "Tournament Match" or any unknown title
  return { sub: DEFAULT_FALLBACK.subTypeName, cat: DEFAULT_FALLBACK.categoryName };
}

export async function fixBrokenEventsAprilMay(): Promise<{ scanned: number; fixed: number; unmatched: any[] }> {
  // NOTE: name kept for backward compatibility with the existing endpoint;
  // now scans ALL dates (not just April/May) and uses a default fallback so
  // every broken event gets repaired.
  const broken: any = await db.execute(sql`
    SELECT e.id, e.roster_id, e.title, e.event_type, e.event_sub_type
    FROM events e
    WHERE e.event_sub_type IS NULL
       OR e.event_sub_type = ''
       OR e.event_sub_type NOT IN (SELECT id FROM event_sub_types)
  `);
  const rows: any[] = broken.rows ?? [];
  let fixed = 0;
  const unmatched: any[] = [];
  for (const ev of rows) {
    const match = pickSubType(ev.title || "", ev.event_sub_type);
    let sub: any = await db.execute(sql`
      SELECT id FROM event_sub_types
      WHERE roster_id = ${ev.roster_id} AND lower(name) = lower(${match.sub})
      LIMIT 1
    `);
    // If the matched sub-type doesn't exist for this roster, try the default
    if (!sub.rows?.length && match.sub !== DEFAULT_FALLBACK.subTypeName) {
      sub = await db.execute(sql`
        SELECT id FROM event_sub_types
        WHERE roster_id = ${ev.roster_id} AND lower(name) = lower(${DEFAULT_FALLBACK.subTypeName})
        LIMIT 1
      `);
    }
    // If still no sub-type, fall back to ANY sub-type for this roster
    if (!sub.rows?.length) {
      sub = await db.execute(sql`
        SELECT id FROM event_sub_types WHERE roster_id = ${ev.roster_id} LIMIT 1
      `);
    }
    if (!sub.rows?.length) {
      unmatched.push({ id: ev.id, title: ev.title, reason: "roster has no sub-types at all" });
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
  // 1b. opponent_player_game_stats (via games of this roster)
  await db.execute(sql`
    DELETE FROM opponent_player_game_stats
    WHERE match_id IN (SELECT id FROM games WHERE roster_id = ${rosterId})
  `);
  // 1c. match_participants, game_heroes, game_hero_ban_actions, game_map_veto_rows, game_rounds
  await db.execute(sql`DELETE FROM match_participants WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM game_heroes WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM game_hero_ban_actions WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM game_map_veto_rows WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM game_rounds WHERE roster_id = ${rosterId}`);
  // 2. attendance
  await db.execute(sql`DELETE FROM attendance WHERE roster_id = ${rosterId}`);
  // 3. games
  await db.execute(sql`DELETE FROM games WHERE roster_id = ${rosterId}`);
  // 4. events
  await db.execute(sql`DELETE FROM events WHERE roster_id = ${rosterId}`);
  // 4b. opponents + opponent_players (cascade handles opponent_players)
  await db.execute(sql`DELETE FROM opponents WHERE roster_id = ${rosterId}`);
  // 4c. heroes (roster-scoped only) + ban/veto systems + sides
  await db.execute(sql`DELETE FROM heroes WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM hero_ban_systems WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM map_veto_systems WHERE roster_id = ${rosterId}`);
  await db.execute(sql`DELETE FROM sides WHERE roster_id = ${rosterId}`);
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
// Fallback opponent list (used only if no real-team list is registered for the
// game slug AND no game_template exists for the game). Real lists in
// server/defaults/realOpponents.ts are preferred.
const FALLBACK_OPPONENTS: RealOpponent[] = [
  { name: "Falcons", shortName: "FLCN", region: "EMEA" },
  { name: "Liquid", shortName: "LIQ", region: "NA" },
  { name: "Vitality", shortName: "VIT", region: "EMEA" },
  { name: "FaZe", shortName: "FAZE", region: "NA" },
  { name: "Twisted Minds", shortName: "TM", region: "EMEA" },
  { name: "Virtus Pro", shortName: "VP", region: "EMEA" },
  { name: "GenG", shortName: "GENG", region: "APAC" },
  { name: "Karmine Corp", shortName: "KC", region: "EMEA" },
  { name: "T1", shortName: "T1", region: "APAC" },
  { name: "100 Thieves", shortName: "100T", region: "NA" },
  { name: "G2", shortName: "G2", region: "EMEA" },
  { name: "Cloud9", shortName: "C9", region: "NA" },
  { name: "NRG", shortName: "NRG", region: "NA" },
  { name: "DRX", shortName: "DRX", region: "APAC" },
  { name: "Sentinels", shortName: "SEN", region: "NA" },
];

// Opponent-player roles for fallback generation (one Tank, two DPS, two Support
// — a standard 5-stack composition that matches the analytics expectations).
const FALLBACK_OPP_ROLES = ["Tank", "DPS", "DPS", "Support", "Support"];

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

export async function loadExampleData(rosterId: string, jobId?: string): Promise<{
  events: number; games: number; players: number; staff: number; users: number;
}> {
  const phase = (msg: string) => { if (jobId) setJobMessage(jobId, msg); };
  // Wipe first
  phase("Wiping existing roster data…");
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

  // ---------- Game Template Lookup (source of truth for ALL config when present) ----------
  // Pulled BEFORE seeding so modes/maps/stat-fields/roles/categories/ban+veto
  // systems can all honor template values. Images (opponent logos, hero images,
  // map images) are preserved verbatim — defaults never overwrite template values.
  phase("Looking up game template…");
  let templateConfig: GameTemplateConfig | null = null;
  let templateName: string | null = null;
  try {
    const tplRes: any = await db.execute(sql`
      SELECT name, config FROM game_templates
      WHERE game_id = ${gameId}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1
    `);
    if (tplRes.rows?.length) {
      templateName = tplRes.rows[0].name as string;
      const cfg = tplRes.rows[0].config;
      templateConfig = (typeof cfg === "string" ? JSON.parse(cfg) : cfg) as GameTemplateConfig;
    }
  } catch (e) {
    templateConfig = null;
  }
  const usedTemplate = !!(templateConfig && (
    (templateConfig.opponents?.length ?? 0) > 0 ||
    (templateConfig.heroes?.length ?? 0) > 0 ||
    (templateConfig.maps?.length ?? 0) > 0 ||
    (templateConfig.gameModes?.length ?? 0) > 0
  ));

  // ---------- Game Config (template-first, defaults only fill gaps) ----------
  phase(usedTemplate
    ? `Seeding game config from template "${templateName}"…`
    : "Seeding game config (modes, maps, seasons, stat fields)…");

  // ---- Game modes ----
  const modeIds: Record<string, string> = {};            // name -> id
  const modeTempIdToId: Record<string, string> = {};      // template tempId -> id
  const modeTempIdToName: Record<string, string> = {};    // template tempId -> name
  type ModeSeed = {
    tempId?: string; name: string; sortOrder: string;
    scoreType: string; maxScore: number | null; maxRoundWins: number | null;
    maxRoundsPerGame: number | null; maxScorePerRoundPerSide: number | null;
  };
  const modeSeed: ModeSeed[] = templateConfig?.gameModes?.length
    ? templateConfig.gameModes.map((m, i) => ({
        tempId: m.tempId, name: m.name, sortOrder: m.sortOrder ?? String(i),
        scoreType: m.scoreType ?? "numeric",
        maxScore: m.maxScore ?? null, maxRoundWins: m.maxRoundWins ?? null,
        maxRoundsPerGame: m.maxRoundsPerGame ?? null,
        maxScorePerRoundPerSide: m.maxScorePerRoundPerSide ?? null,
      }))
    : ["Game Mode 1", "Game Mode 2", "Game Mode 3"].map((n, i) => ({
        name: n, sortOrder: String(i), scoreType: "numeric",
        maxScore: null, maxRoundWins: null, maxRoundsPerGame: null, maxScorePerRoundPerSide: null,
      }));
  const modeIdList = await bulkInsertWithIds(
    "game_modes",
    ["team_id", "game_id", "roster_id", "name", "sort_order", "score_type", "max_score", "max_round_wins", "max_rounds_per_game", "max_score_per_round_per_side"],
    modeSeed.map(m => [teamId, gameId, rosterId, m.name, m.sortOrder, m.scoreType, m.maxScore, m.maxRoundWins, m.maxRoundsPerGame, m.maxScorePerRoundPerSide]),
  );
  modeSeed.forEach((m, i) => {
    modeIds[m.name] = modeIdList[i];
    if (m.tempId) {
      modeTempIdToId[m.tempId] = modeIdList[i];
      modeTempIdToName[m.tempId] = m.name;
    }
  });

  // ---- Maps (template carries imageUrl + game-mode link) ----
  const mapsByMode: Record<string, { id: string; name: string }[]> = {};
  Object.keys(modeIds).forEach(n => { mapsByMode[n] = []; });
  type MapSeed = { name: string; modeName: string; modeId: string; imageUrl: string | null; sortOrder: string };
  const mapSeeds: MapSeed[] = [];
  const fallbackModeName = Object.keys(modeIds)[0];
  if (templateConfig?.maps?.length) {
    templateConfig.maps.forEach((m, i) => {
      let modeName = m.gameModeTempId ? modeTempIdToName[m.gameModeTempId] : undefined;
      let modeId = m.gameModeTempId ? modeTempIdToId[m.gameModeTempId] : undefined;
      if (!modeName || !modeId) { modeName = fallbackModeName; modeId = modeIds[fallbackModeName]; }
      mapSeeds.push({ name: m.name, modeName, modeId, imageUrl: m.imageUrl ?? null, sortOrder: m.sortOrder ?? String(i) });
    });
  } else {
    for (const [modeName, mapNames] of Object.entries(MAPS_BY_MODE)) {
      if (!modeIds[modeName]) continue;
      for (const mn of mapNames) {
        mapSeeds.push({ name: mn, modeName, modeId: modeIds[modeName], imageUrl: null, sortOrder: "0" });
      }
    }
  }
  // Pad any mode that ended up empty so the games loop always has a map per mode.
  for (const modeName of Object.keys(modeIds)) {
    if (!mapSeeds.some(m => m.modeName === modeName)) {
      mapSeeds.push({ name: `${modeName} Map`, modeName, modeId: modeIds[modeName], imageUrl: null, sortOrder: "0" });
    }
  }
  if (mapSeeds.length > 0) {
    const mapIds = await bulkInsertWithIds(
      "maps",
      ["team_id", "game_id", "roster_id", "name", "game_mode_id", "image_url", "sort_order"],
      mapSeeds.map(m => [teamId, gameId, rosterId, m.name, m.modeId, m.imageUrl, m.sortOrder]),
    );
    mapIds.forEach((id, i) => {
      mapsByMode[mapSeeds[i].modeName].push({ id, name: mapSeeds[i].name });
    });
  }

  // ---- Seasons (no template field) ----
  const seasonIds = await bulkInsertWithIds(
    "seasons",
    ["team_id", "game_id", "roster_id", "name"],
    ["Season 1", "Season 2"].map(n => [teamId, gameId, rosterId, n]),
  );

  // ---- Roster roles (template if present) ----
  {
    const roleSeed = templateConfig?.rosterRoles?.length
      ? templateConfig.rosterRoles.map((r, i) => ({ name: r.name, type: r.type ?? "player", sortOrder: r.sortOrder ?? i }))
      : ["Tank", "DPS", "Support", "Flex"].map((n, i) => ({ name: n, type: "player", sortOrder: i }));
    await bulkInsert(
      "roster_roles",
      ["team_id", "game_id", "roster_id", "name", "type", "sort_order"],
      roleSeed.map(r => [teamId, gameId, rosterId, r.name, r.type, r.sortOrder]),
    );
  }

  // ---- Availability slots (template if present, else sensible defaults) ----
  // Wiped earlier at line 275; loadExampleData previously left this empty,
  // so the Roster Settings → Availability Slots panel rendered blank even
  // when the game template defined them. Re-insert here.
  {
    const slotSeed = templateConfig?.availabilitySlots?.length
      ? templateConfig.availabilitySlots.map((s, i) => ({ label: s.label, sortOrder: s.sortOrder ?? i }))
      : ["Morning", "Afternoon", "Evening", "Night"].map((n, i) => ({ label: n, sortOrder: i }));
    if (slotSeed.length > 0) {
      await bulkInsert(
        "availability_slots",
        ["team_id", "game_id", "roster_id", "label", "sort_order"],
        slotSeed.map(s => [teamId, gameId, rosterId, s.label, s.sortOrder]),
      );
    }
  }

  // ---- Stat fields (template if present, linked via gameModeTempId) ----
  const statFieldsByMode: Record<string, { id: string; name: string }[]> = {};
  Object.keys(modeIds).forEach(n => { statFieldsByMode[n] = []; });
  type SfSeed = { name: string; modeName: string; modeId: string };
  const sfSeeds: SfSeed[] = [];
  if (templateConfig?.statFields?.length) {
    for (const f of templateConfig.statFields) {
      let modeName = f.gameModeTempId ? modeTempIdToName[f.gameModeTempId] : undefined;
      let modeId = f.gameModeTempId ? modeTempIdToId[f.gameModeTempId] : undefined;
      if (!modeName || !modeId) { modeName = fallbackModeName; modeId = modeIds[fallbackModeName]; }
      sfSeeds.push({ name: f.name, modeName, modeId });
    }
  } else {
    for (const [modeName, fieldNames] of Object.entries(STAT_FIELDS_BY_MODE)) {
      if (!modeIds[modeName]) continue;
      for (const fn of fieldNames) sfSeeds.push({ name: fn, modeName, modeId: modeIds[modeName] });
    }
  }
  if (sfSeeds.length > 0) {
    const sfIds = await bulkInsertWithIds(
      "stat_fields",
      ["team_id", "game_id", "roster_id", "name", "game_mode_id"],
      sfSeeds.map(s => [teamId, gameId, rosterId, s.name, s.modeId]),
    );
    sfIds.forEach((id, i) => statFieldsByMode[sfSeeds[i].modeName].push({ id, name: sfSeeds[i].name }));
  }

  // ---- Event categories + sub-types ----
  // CRITICAL: events loop later requires Scrim (with Practice + Warm-up),
  // Tournament, and Meetings categories to plan a realistic calendar. So
  // ALWAYS seed those defaults; ADDITIONALLY merge any template-only extras
  // (categories or sub-types not already covered).
  const tplCatTempIdToName: Record<string, string> = {};
  const seenCatNamesLower = new Set(CATEGORIES.map(c => c.name.toLowerCase()));
  const extraCats: Array<{ name: string; color: string }> = [];
  if (templateConfig?.eventCategories?.length) {
    for (const c of templateConfig.eventCategories) {
      tplCatTempIdToName[c.tempId] = c.name;
      const lower = c.name.toLowerCase();
      if (seenCatNamesLower.has(lower)) continue;
      seenCatNamesLower.add(lower);
      extraCats.push({ name: c.name, color: c.color ?? "#3b82f6" });
    }
  }
  const allCatNames = [...CATEGORIES.map(c => c.name), ...extraCats.map(c => c.name)];
  const allCatColors = [...CATEGORIES.map(c => c.color), ...extraCats.map(c => c.color)];
  const catIdList = await bulkInsertWithIds(
    "event_categories",
    ["team_id", "game_id", "roster_id", "name", "color", "sort_order"],
    allCatNames.map((n, i) => [teamId, gameId, rosterId, n, allCatColors[i], 0]),
  );
  const catIdByName: Record<string, string> = {};
  const catIdToName: Record<string, string> = {};
  allCatNames.forEach((n, i) => { catIdByName[n] = catIdList[i]; catIdToName[catIdList[i]] = n; });

  type SubSeed = { catId: string; catName: string; name: string; color: string };
  const subSeeds: SubSeed[] = [];
  for (const cat of CATEGORIES) {
    for (const sn of cat.subs) {
      subSeeds.push({ catId: catIdByName[cat.name], catName: cat.name, name: sn, color: cat.color });
    }
  }
  if (templateConfig?.eventSubTypes?.length) {
    for (const s of templateConfig.eventSubTypes) {
      const catName = tplCatTempIdToName[s.categoryTempId];
      if (!catName) continue;
      const catId = catIdByName[catName];
      if (!catId) continue;
      if (subSeeds.some(x => x.catName === catName && x.name.toLowerCase() === s.name.toLowerCase())) continue;
      subSeeds.push({ catId, catName, name: s.name, color: s.color ?? "#3b82f6" });
    }
  }
  if (subSeeds.length > 0) {
    await bulkInsert(
      "event_sub_types",
      ["team_id", "game_id", "roster_id", "category_id", "name", "color", "sort_order"],
      subSeeds.map(s => [teamId, gameId, rosterId, s.catId, s.name, s.color, 0]),
    );
  }
  // Re-query sub-types so the planner sees the rows actually persisted.
  const subRowsRes: any = await db.execute(sql`
    SELECT id, name, category_id FROM event_sub_types WHERE roster_id = ${rosterId}
  `);
  const subTypesByCat: Record<string, { id: string; name: string }[]> = {};
  for (const row of (subRowsRes.rows ?? [])) {
    const catName = catIdToName[row.category_id];
    if (!catName) continue;
    if (!subTypesByCat[catName]) subTypesByCat[catName] = [];
    subTypesByCat[catName].push({ id: row.id, name: row.name });
  }
  for (const cat of CATEGORIES) {
    if (!subTypesByCat[cat.name] || subTypesByCat[cat.name].length === 0) {
      throw new Error(`Failed to seed sub-types for category "${cat.name}" on roster ${rosterId}`);
    }
  }

  // ---------- Players + their user accounts ----------
  phase("Seeding 8 players, availability, and user accounts…");
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
  phase("Seeding staff and availability…");
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

  // ---------- Opponents + Opponent Rosters ----------
  // (templateConfig was loaded earlier so it could drive game-config seeding too)
  phase(usedTemplate
    ? `Seeding opponents from template "${templateName}"…`
    : "Seeding 15 fallback opponents with 5-player rosters each…");

  type OppSeed = { name: string; shortName: string | null; logoUrl: string | null; region: string | null };
  let oppSeeds: OppSeed[] = [];
  let oppPlayerSeeds: Array<{ oppIdx: number; name: string; role: string }> = [];

  if (usedTemplate && templateConfig?.opponents?.length) {
    // Map template tempId -> array index so we can attach players.
    const tempIdToIdx = new Map<string, number>();
    templateConfig.opponents.forEach((o, idx) => {
      tempIdToIdx.set(o.tempId, idx);
      oppSeeds.push({
        name: o.name,
        shortName: o.shortName ?? null,
        logoUrl: o.logoUrl ?? null,
        region: o.region ?? null,
      });
    });
    // Template players (linked by opponentTempId)
    if (templateConfig.players?.length) {
      for (const p of templateConfig.players) {
        const idx = tempIdToIdx.get(p.opponentTempId);
        if (idx === undefined) continue;
        oppPlayerSeeds.push({ oppIdx: idx, name: p.ign || p.name, role: p.role || "Flex" });
      }
    }
    // For any opponent without a template-defined player roster, generate 5.
    const oppsWithPlayers = new Set(oppPlayerSeeds.map(p => p.oppIdx));
    for (let i = 0; i < oppSeeds.length; i++) {
      if (oppsWithPlayers.has(i)) continue;
      const short = oppSeeds[i].shortName || oppSeeds[i].name.slice(0, 4).toUpperCase();
      for (let n = 0; n < 5; n++) {
        oppPlayerSeeds.push({ oppIdx: i, name: `${short} P${n + 1}`, role: FALLBACK_OPP_ROLES[n] });
      }
    }
  } else {
    // No template — fall back to the curated real-team list for this game,
    // or to the generic FALLBACK_OPPONENTS if the game slug isn't registered
    // OR if the curated list is empty/short. Pad with FALLBACK_OPPONENTS so we
    // always end up with 15 opponents (downstream uses modulo on this length).
    const curated = OPPONENT_SEEDS_BY_GAME_SLUG[gameSlug] ?? [];
    const padded = curated.length >= 15
      ? curated
      : [...curated, ...FALLBACK_OPPONENTS.filter(f => !curated.some(c => c.name === f.name))];
    const realList = padded.length > 0 ? padded : FALLBACK_OPPONENTS;
    oppSeeds = realList.slice(0, 15).map(o => ({
      name: o.name,
      shortName: o.shortName ?? null,
      logoUrl: null,
      region: o.region ?? null,
    }));
    // 5 generated players per opponent.
    oppSeeds.forEach((o, idx) => {
      const short = o.shortName || o.name.slice(0, 4).toUpperCase();
      for (let n = 0; n < 5; n++) {
        oppPlayerSeeds.push({ oppIdx: idx, name: `${short} P${n + 1}`, role: FALLBACK_OPP_ROLES[n] });
      }
    });
  }

  const opponentIds = await bulkInsertWithIds(
    "opponents",
    ["team_id", "game_id", "roster_id", "name", "short_name", "logo_url", "region", "is_active", "sort_order"],
    oppSeeds.map((o, i) => [teamId, gameId, rosterId, o.name, o.shortName, o.logoUrl, o.region, true, i]),
  );
  const opponentPlayerIdsByOpp: string[][] = opponentIds.map(() => []);
  // Insert opponent players grouped by opponent so we know which ids belong where.
  // Single bulk insert with ordered RETURNING; map back via insertion order per opponent.
  if (oppPlayerSeeds.length > 0) {
    const oppPlayerRows = oppPlayerSeeds.map((p, i) => [
      teamId, gameId, rosterId, opponentIds[p.oppIdx], p.name, p.role, true, i,
    ]);
    const oppPlayerIds = await bulkInsertWithIds(
      "opponent_players",
      ["team_id", "game_id", "roster_id", "opponent_id", "name", "role", "is_starter", "sort_order"],
      oppPlayerRows,
    );
    oppPlayerIds.forEach((id, i) => {
      opponentPlayerIdsByOpp[oppPlayerSeeds[i].oppIdx].push(id);
    });
  }

  // ---------- Heroes (template if present, else 12-hero fallback) ----------
  // Heroes are required for Hero Insights, hero-ban actions, hero-pick analytics
  // and Player Leaderboard hero specialization. Always seed at least a usable
  // pool so analytics pages light up even without a template.
  let heroIds: string[] = [];
  let heroRolesById: Record<string, string> = {};
  let heroSeed: Array<{ name: string; role: string; imageUrl: string | null }>;
  if (templateConfig?.heroes?.length) {
    phase(`Seeding ${templateConfig.heroes.length} heroes from template…`);
    heroSeed = templateConfig.heroes.map(h => ({
      name: h.name, role: h.role || "Flex", imageUrl: h.imageUrl ?? null,
    }));
  } else {
    phase("Seeding 12 fallback heroes (4 Tank / 4 DPS / 4 Support)…");
    heroSeed = [];
    (["Tank", "DPS", "Support"] as const).forEach(role => {
      for (let i = 1; i <= 4; i++) heroSeed.push({ name: `${role} Hero ${i}`, role, imageUrl: null });
    });
  }
  heroIds = await bulkInsertWithIds(
    "heroes",
    ["team_id", "game_id", "roster_id", "name", "role", "image_url", "is_active", "sort_order"],
    heroSeed.map((h, i) => [teamId, gameId, rosterId, h.name, h.role, h.imageUrl, true, i]),
  );
  heroIds.forEach((id, i) => { heroRolesById[id] = heroSeed[i].role; });

  // ---------- Sides (template if present, else Attack/Defense) ----------
  // sides was wiped earlier — game_rounds.sideId and game_map_veto_rows.sideId
  // both reference this table, so we must always reseed.
  phase("Seeding sides…");
  const sideSeed = (templateConfig?.sides?.length
    ? templateConfig.sides.map((s, i) => ({ name: s.name, sortOrder: s.sortOrder ?? String(i) }))
    : [{ name: "Attack", sortOrder: "0" }, { name: "Defense", sortOrder: "1" }]);
  const sideIds = await bulkInsertWithIds(
    "sides",
    ["team_id", "game_id", "roster_id", "name", "sort_order"],
    sideSeed.map(s => [teamId, gameId, rosterId, s.name, s.sortOrder]),
  );

  // ---------- Hero-Ban + Map-Veto Systems (template if present, else defaults) ----------
  phase("Seeding hero-ban + map-veto systems…");
  const tplBan = templateConfig?.heroBanSystems?.[0];
  const banSysIds = await bulkInsertWithIds(
    "hero_ban_systems",
    [
      "team_id", "game_id", "roster_id", "name", "enabled", "mode",
      "supports_locks", "bans_per_team", "locks_per_team",
      "bans_target_enemy", "locks_secure_own",
      "bans_per_round", "bans_every_side_switch", "bans_every_two_rounds",
      "bans_reset_on_halftime", "overtime_behavior",
      "total_bans_per_map", "bans_accumulate", "notes", "sort_order",
    ],
    [[
      teamId, gameId, rosterId,
      tplBan?.name ?? "Standard Bans",
      tplBan?.enabled ?? true,
      tplBan?.mode ?? "simple",
      tplBan?.supportsLocks ?? false,
      tplBan?.bansPerTeam ?? 2,
      tplBan?.locksPerTeam ?? 0,
      tplBan?.bansTargetEnemy ?? true,
      tplBan?.locksSecureOwn ?? false,
      tplBan?.bansPerRound ?? null,
      tplBan?.bansEverySideSwitch ?? false,
      tplBan?.bansEveryTwoRounds ?? false,
      tplBan?.bansResetOnHalftime ?? false,
      tplBan?.overtimeBehavior ?? null,
      tplBan?.totalBansPerMap ?? null,
      tplBan?.bansAccumulate ?? false,
      tplBan?.notes ?? null,
      tplBan?.sortOrder ?? 0,
    ]],
  );
  const heroBanSystemId = banSysIds[0];

  const tplVeto = templateConfig?.mapVetoSystems?.[0];
  const vetoSysIds = await bulkInsertWithIds(
    "map_veto_systems",
    [
      "team_id", "game_id", "roster_id", "name", "enabled",
      "supports_ban", "supports_pick", "supports_decider", "supports_side_choice",
      "default_row_count", "notes", "sort_order",
    ],
    [[
      teamId, gameId, rosterId,
      tplVeto?.name ?? "Standard Veto",
      tplVeto?.enabled ?? true,
      tplVeto?.supportsBan ?? true,
      tplVeto?.supportsPick ?? true,
      tplVeto?.supportsDecider ?? true,
      tplVeto?.supportsSideChoice ?? true,
      tplVeto?.defaultRowCount ?? 7,
      tplVeto?.notes ?? null,
      tplVeto?.sortOrder ?? 0,
    ]],
  );
  const mapVetoSystemId = vetoSysIds[0];

  // ---------- Plan all events/games up-front (no DB calls in this loop) ----------
  phase("Planning event calendar…");
  const today = new Date();
  const start = new Date(today); start.setMonth(start.getMonth() - 1);
  const end = new Date(today); end.setMonth(end.getMonth() + 1);

  const subPractice = subTypesByCat["Scrim"].find(s => s.name === "Practice")!;
  const subWarmup = subTypesByCat["Scrim"].find(s => s.name === "Warm-up")!;
  const tournSubs = subTypesByCat["Tournament"];
  const meetingSubs = subTypesByCat["Meetings"];
  const allModes = Object.keys(modeIds);

  type EventPlan = {
    kind: "scrim_practice" | "scrim_warmup" | "tournament" | "meeting";
    title: string; eventTypeStr: string; subId: string;
    date: string; time: string; seasonId: string;
    opponentIdx: number; // index into opponentIds (meetings still get one for FK consistency? no — meetings have no opponent)
  };
  const planned: EventPlan[] = [];
  const offDayDates: string[] = [];
  let oppCursor = 0;
  const nextOpp = () => { const i = oppCursor % opponentIds.length; oppCursor++; return i; };

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const dateStr = isoDate(d);
    if (dow === 4 || dow === 5) { offDayDates.push(dateStr); continue; }

    const seasonId = rand(seasonIds);
    // Always 1 practice scrim — assigned a real opponent so head-to-head fills up.
    planned.push({
      kind: "scrim_practice", title: "Practice",
      eventTypeStr: "Scrim", subId: subPractice.id,
      date: dateStr, time: "16:00", seasonId, opponentIdx: nextOpp(),
    });
    if (Math.random() < 0.5) {
      const t = rand(tournSubs);
      const oppA = nextOpp();
      const oppB = nextOpp();
      planned.push({
        kind: "scrim_warmup", title: `Warm-up vs ${oppSeeds[oppA].name}`,
        eventTypeStr: "Scrim", subId: subWarmup.id,
        date: dateStr, time: "18:00", seasonId, opponentIdx: oppA,
      });
      planned.push({
        kind: "tournament", title: `${t.name} vs ${oppSeeds[oppB].name}`,
        eventTypeStr: "Tournament", subId: t.id,
        date: dateStr, time: "19:00", seasonId, opponentIdx: oppB,
      });
    }
    if (Math.random() < 0.3) {
      const m = rand(meetingSubs);
      planned.push({
        kind: "meeting", title: m.name,
        eventTypeStr: "Meetings", subId: m.id,
        date: dateStr, time: "15:00", seasonId, opponentIdx: -1,
      });
    }
  }

  // ---------- Bulk insert: off_days, events ----------
  phase(`Inserting ${offDayDates.length} off-days…`);
  await bulkInsertChunked(
    "off_days",
    ["team_id", "game_id", "roster_id", "date"],
    offDayDates.map(d => [teamId, gameId, rosterId, d]),
  );

  phase(`Inserting ${planned.length} events…`);
  const eventIds = await bulkInsertWithIds(
    "events",
    ["team_id", "game_id", "roster_id", "title", "event_type", "event_sub_type", "date", "time", "season_id", "opponent_id"],
    planned.map(p => [
      teamId, gameId, rosterId, p.title, p.eventTypeStr, p.subId, p.date, p.time, p.seasonId,
      p.opponentIdx >= 0 ? opponentIds[p.opponentIdx] : null,
    ]),
  );

  // ---------- Bulk insert: attendance (8 players × every event) ----------
  phase(`Inserting attendance for ${planned.length} events…`);
  const attendanceRows: any[][] = [];
  for (let i = 0; i < planned.length; i++) {
    const p = planned[i];
    const eventId = eventIds[i];
    for (const pl of players) {
      attendanceRows.push([
        teamId, gameId, rosterId, pl.id, p.date, eventId,
        rand(["attended", "attended", "attended", "late", "absent"]),
      ]);
    }
  }
  await bulkInsertChunked(
    "attendance",
    ["team_id", "game_id", "roster_id", "player_id", "date", "event_id", "status"],
    attendanceRows,
  );

  // ---------- Plan games (5 per non-meeting event) ----------
  type GamePlan = {
    eventIdx: number; eventId: string; opponentId: string;
    modeName: string; modeId: string; mapId: string;
    fields: { id: string; name: string }[];
    code: string; score: string; result: string;
  };
  const gamePlans: GamePlan[] = [];
  for (let i = 0; i < planned.length; i++) {
    const p = planned[i];
    if (p.kind === "meeting") continue;
    const eventId = eventIds[i];
    const oppId = opponentIds[p.opponentIdx];
    for (let g = 1; g <= 5; g++) {
      const modeName = rand(allModes);
      const map = rand(mapsByMode[modeName]);
      gamePlans.push({
        eventIdx: i, eventId, opponentId: oppId,
        modeName, modeId: modeIds[modeName], mapId: map.id,
        fields: statFieldsByMode[modeName],
        code: `G${g}`,
        score: `${randInt(0, 16)}-${randInt(0, 16)}`,
        result: rand(["win", "loss", "draw"]),
      });
    }
  }

  phase(`Inserting ${gamePlans.length} games…`);
  const gameIds = await bulkInsertWithIds(
    "games",
    ["team_id", "game_id", "roster_id", "event_id", "game_code", "score", "game_mode_id", "map_id", "result", "opponent_id", "hero_ban_system_id", "map_veto_system_id"],
    gamePlans.map(g => [
      teamId, gameId, rosterId, g.eventId, g.code, g.score, g.modeId, g.mapId, g.result, g.opponentId, heroBanSystemId, mapVetoSystemId,
    ]),
  );

  // ---------- Bulk insert: match_participants (us + opponent) ----------
  phase(`Inserting match participants for ${gameIds.length} games…`);
  const participantRows: any[][] = [];
  for (let gi = 0; gi < gamePlans.length; gi++) {
    const matchId = gameIds[gi];
    // Find which opponent this game is against → grab its 5 players.
    const oppIdx = oppSeeds.findIndex((_, idx) => opponentIds[idx] === gamePlans[gi].opponentId);
    const oppPlayerIds = oppIdx >= 0 ? opponentPlayerIdsByOpp[oppIdx] : [];
    for (const pl of players) {
      participantRows.push([teamId, gameId, rosterId, matchId, "us", pl.id, null, true]);
    }
    for (const oppPid of oppPlayerIds) {
      participantRows.push([teamId, gameId, rosterId, matchId, "opponent", null, oppPid, true]);
    }
  }
  await bulkInsertChunked(
    "match_participants",
    ["team_id", "game_id", "roster_id", "match_id", "side", "player_id", "opponent_player_id", "played"],
    participantRows,
  );

  // ---------- Bulk insert: game_rounds (3 rounds per game with side rotation) ----------
  // Powers Map Insights → Side WR and Trends → By Side.
  phase(`Inserting rounds for ${gameIds.length} games…`);
  const roundRows: any[][] = [];
  for (let gi = 0; gi < gamePlans.length; gi++) {
    const matchId = gameIds[gi];
    for (let rn = 1; rn <= 3; rn++) {
      // Alternate sides per round so per-side win rates have meaningful spread.
      const sideId = sideIds[(rn - 1) % sideIds.length];
      roundRows.push([
        teamId, gameId, rosterId, matchId, rn, sideId,
        randInt(0, 13), randInt(0, 13),
      ]);
    }
  }
  await bulkInsertChunked(
    "game_rounds",
    ["team_id", "game_id", "roster_id", "match_id", "round_number", "side_id", "team_score", "opponent_score"],
    roundRows,
  );

  // ---------- Bulk insert: game_heroes (per-match hero picks for both sides) ----------
  // Powers Hero Insights pick%, Player Leaderboard hero specialization,
  // Draft Stats hero tab, and Hero Pool by Player.
  let heroPicksCount = 0;
  if (heroIds.length > 0) {
    phase(`Inserting hero picks for ${gameIds.length} games…`);
    // Pull a hero per slot; prefer unique within a side, but allow repeats
    // when the hero pool is smaller than the side size (e.g. template with
    // <5 heroes) — sampling-with-replacement keeps analytics populated.
    const pickPool = (size: number): string[] => {
      if (heroIds.length >= size) {
        return [...heroIds].sort(() => Math.random() - 0.5).slice(0, size);
      }
      const out: string[] = [];
      for (let i = 0; i < size; i++) out.push(heroIds[Math.floor(Math.random() * heroIds.length)]);
      return out;
    };
    const heroPickRows: any[][] = [];
    for (let gi = 0; gi < gamePlans.length; gi++) {
      const matchId = gameIds[gi];
      const oppIdx = oppSeeds.findIndex((_, idx) => opponentIds[idx] === gamePlans[gi].opponentId);
      const oppPlayerIds = oppIdx >= 0 ? opponentPlayerIdsByOpp[oppIdx] : [];
      const usPool = pickPool(players.length);
      const oppPool = pickPool(Math.max(oppPlayerIds.length, 1));
      players.forEach((pl, i) => {
        heroPickRows.push([teamId, gameId, rosterId, matchId, pl.id, null, usPool[i], null, i]);
        heroPicksCount++;
      });
      oppPlayerIds.forEach((oppPid, i) => {
        heroPickRows.push([teamId, gameId, rosterId, matchId, null, oppPid, oppPool[i], null, i]);
        heroPicksCount++;
      });
    }
    await bulkInsertChunked(
      "game_heroes",
      ["team_id", "game_id", "roster_id", "match_id", "player_id", "opponent_player_id", "hero_id", "round_number", "sort_order"],
      heroPickRows,
    );
  }

  // ---------- Bulk insert: player_game_stats (us) ----------
  phase(`Inserting player stats for ${gameIds.length} games…`);
  const statRows: any[][] = [];
  for (let gi = 0; gi < gamePlans.length; gi++) {
    const matchId = gameIds[gi];
    for (const pl of players) {
      for (const f of gamePlans[gi].fields) {
        statRows.push([teamId, gameId, matchId, pl.id, f.id, randInt(0, 25).toString()]);
      }
    }
  }
  await bulkInsertChunked(
    "player_game_stats",
    ["team_id", "game_id", "match_id", "player_id", "stat_field_id", "value"],
    statRows,
  );

  // ---------- Bulk insert: opponent_player_game_stats ----------
  phase(`Inserting opponent stats for ${gameIds.length} games…`);
  const oppStatRows: any[][] = [];
  for (let gi = 0; gi < gamePlans.length; gi++) {
    const matchId = gameIds[gi];
    const oppIdx = oppSeeds.findIndex((_, idx) => opponentIds[idx] === gamePlans[gi].opponentId);
    const oppPlayerIds = oppIdx >= 0 ? opponentPlayerIdsByOpp[oppIdx] : [];
    for (const oppPid of oppPlayerIds) {
      for (const f of gamePlans[gi].fields) {
        oppStatRows.push([teamId, gameId, matchId, oppPid, f.id, randInt(0, 25).toString()]);
      }
    }
  }
  await bulkInsertChunked(
    "opponent_player_game_stats",
    ["team_id", "game_id", "match_id", "opponent_player_id", "stat_field_id", "value"],
    oppStatRows,
  );

  // ---------- Bulk insert: hero ban actions (~40% of games, only if heroes seeded) ----------
  let heroBanActionsCount = 0;
  if (heroIds.length >= 4) {
    const banRows: any[][] = [];
    for (let gi = 0; gi < gamePlans.length; gi++) {
      if (Math.random() > 0.4) continue;
      const matchId = gameIds[gi];
      // 4 alternating bans (a,b,a,b) using random heroes (no repeats per match).
      const pool = [...heroIds].sort(() => Math.random() - 0.5).slice(0, 4);
      pool.forEach((hid, step) => {
        banRows.push([teamId, gameId, rosterId, matchId, step + 1, "ban", step % 2 === 0 ? "a" : "b", hid, null]);
      });
      heroBanActionsCount += pool.length;
    }
    phase(`Inserting ${heroBanActionsCount} hero-ban actions across ~${Math.round(heroBanActionsCount / 4)} games…`);
    await bulkInsertChunked(
      "game_hero_ban_actions",
      ["team_id", "game_id", "roster_id", "match_id", "step_number", "action_type", "acting_team", "hero_id", "notes"],
      banRows,
    );
  }

  // ---------- Bulk insert: map veto rows (~40% of games) ----------
  const allMaps = Object.values(mapsByMode).flat();
  let mapVetoRowsCount = 0;
  if (allMaps.length >= 5) {
    const vetoRows: any[][] = [];
    for (let gi = 0; gi < gamePlans.length; gi++) {
      if (Math.random() > 0.4) continue;
      const matchId = gameIds[gi];
      // Standard 5-step veto: ban, ban, pick, pick, decider.
      const pool = [...allMaps].sort(() => Math.random() - 0.5).slice(0, 5);
      const seq = ["ban", "ban", "pick", "pick", "decider"] as const;
      seq.forEach((act, step) => {
        const m = pool[step];
        // Decider step gets a real side pick so Map Insights side-WR fills
        // up; ban/pick steps leave side_id NULL (the side is locked in by
        // the decider, per standard veto convention).
        const sideId = act === "decider" ? sideIds[step % sideIds.length] : null;
        vetoRows.push([teamId, gameId, rosterId, matchId, step + 1, act, step % 2 === 0 ? "a" : "b", m.id, sideId, null]);
      });
      mapVetoRowsCount += seq.length;
    }
    phase(`Inserting ${mapVetoRowsCount} map-veto rows across ~${Math.round(mapVetoRowsCount / 5)} games…`);
    await bulkInsertChunked(
      "game_map_veto_rows",
      ["team_id", "game_id", "roster_id", "match_id", "step_number", "action_type", "acting_team", "map_id", "side_id", "notes"],
      vetoRows,
    );
  }

  return {
    events: planned.length,
    games: gameIds.length,
    players: players.length,
    staff: staffCount,
    users: players.length + staffCount,
    // Extended metadata so the API/UI can report what was actually seeded.
    ...(({} as any)),
    opponents: opponentIds.length,
    opponentPlayers: oppPlayerSeeds.length,
    heroes: heroIds.length,
    heroPicks: heroPicksCount,
    heroBanActions: heroBanActionsCount,
    mapVetoRows: mapVetoRowsCount,
    sides: sideIds.length,
    rounds: roundRows.length,
    usedTemplate,
    templateName,
  } as any;
}
