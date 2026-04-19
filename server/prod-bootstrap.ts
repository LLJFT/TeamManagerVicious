import { db } from "./db";
import { sql } from "drizzle-orm";

const CANONICAL_TEAM_ID = "9ae96acf-6ae9-40b4-945b-86651991bfc3";
const SENTINEL_KEY = "prod_bootstrap_v2_done";
const WINDOW_START = "2026-03-28";
const WINDOW_END = "2026-05-28";

type LogFn = (line: string) => void;
let _activeLogger: LogFn | null = null;
export function setBootstrapLogger(fn: LogFn | null): void {
  _activeLogger = fn;
}
function _log(line: string): void {
  console.log(line);
  if (_activeLogger) {
    try { _activeLogger(line); } catch {}
  }
}
function _warn(line: string): void {
  console.warn(line);
  if (_activeLogger) {
    try { _activeLogger("WARN " + line); } catch {}
  }
}

const TEAM_SCOPED_TABLES_BOTTOM_UP = [
  "player_game_stats",
  "attendance",
  "games",
  "chat_messages",
  "chat_channel_permissions",
  "chat_channels",
  "notifications",
  "activity_logs",
  "user_game_assignments",
  "staff_availability",
  "player_availability",
  "event_sub_types",
  "event_categories",
  "maps",
  "stat_fields",
  "game_modes",
  "seasons",
  "off_days",
  "team_notes",
  "schedules",
  "roster_roles",
  "availability_slots",
  "settings",
  "events",
  "players",
  "staff",
  "users",
  "roles",
  "rosters",
  "password_reset_requests",
];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function pickWeighted<T>(items: T[], weights: number[], r: number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  const t = r * total;
  for (let i = 0; i < items.length; i++) {
    acc += weights[i];
    if (t < acc) return items[i];
  }
  return items[items.length - 1];
}

function* dateRange(start: string, end: string): Generator<string> {
  const d = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  while (d <= e) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function dayOfWeekUTC(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay(); // 0=Sun..6=Sat
}

async function isAlreadyDone(): Promise<boolean> {
  const r: any = await db.execute(sql`
    SELECT 1 FROM settings WHERE team_id = ${CANONICAL_TEAM_ID} AND key = ${SENTINEL_KEY} LIMIT 1
  `);
  return (r.rows?.length ?? 0) > 0;
}

async function markDone(): Promise<void> {
  await db.execute(sql`
    INSERT INTO settings (team_id, key, value)
    VALUES (${CANONICAL_TEAM_ID}, ${SENTINEL_KEY}, ${new Date().toISOString()})
  `);
}

const CLEANUP_CHUNK_SIZE = 500;

async function chunkedDeleteByPredicate(table: string, predicateSql: string): Promise<number> {
  let total = 0;
  let pass = 0;
  while (true) {
    pass++;
    const t0 = Date.now();
    const q = `WITH del AS (
        SELECT ctid FROM ${table} WHERE ${predicateSql} LIMIT ${CLEANUP_CHUNK_SIZE}
      )
      DELETE FROM ${table} WHERE ctid IN (SELECT ctid FROM del)`;
    const r: any = await db.execute(sql.raw(q));
    const n = r.rowCount ?? 0;
    total += n;
    _log(`[prod-bootstrap]   chunk ${table} pass#${pass}: deleted ${n} in ${Date.now() - t0}ms (total=${total})`);
    if (n < CLEANUP_CHUNK_SIZE) break;
    if (pass > 10000) {
      _warn(`[prod-bootstrap]   chunk ${table} aborting after ${pass} passes (safety limit)`);
      break;
    }
  }
  return total;
}

async function cleanupOrphans(): Promise<Record<string, number>> {
  const summary: Record<string, number> = {};
  for (let i = 0; i < TEAM_SCOPED_TABLES_BOTTOM_UP.length; i++) {
    const table = TEAM_SCOPED_TABLES_BOTTOM_UP[i];
    const t0 = Date.now();
    _log(`[prod-bootstrap] cleanup START [${i + 1}/${TEAM_SCOPED_TABLES_BOTTOM_UP.length}] ${table}`);
    try {
      const cntRow: any = await db.execute(sql.raw(
        `SELECT COUNT(*)::bigint AS c FROM ${table} WHERE team_id IS NOT NULL AND team_id <> '${CANONICAL_TEAM_ID}'`
      ));
      const expected = Number(cntRow.rows?.[0]?.c ?? 0);
      _log(`[prod-bootstrap]   ${table}: ${expected} candidate rows to delete`);

      const deleted = await chunkedDeleteByPredicate(
        table,
        `team_id IS NOT NULL AND team_id <> '${CANONICAL_TEAM_ID}'`,
      );
      summary[table] = deleted;
      _log(`[prod-bootstrap] cleanup END   [${i + 1}/${TEAM_SCOPED_TABLES_BOTTOM_UP.length}] ${table}: deleted ${deleted} in ${Date.now() - t0}ms`);
    } catch (err: any) {
      const dt = Date.now() - t0;
      _warn(`[prod-bootstrap] cleanup ${table} FAILED after ${dt}ms: ${err.message}`);
      summary[table] = -1;
    }
  }
  return summary;
}

async function cleanupWindow(): Promise<Record<string, number>> {
  const summary: Record<string, number> = {};
  const eventIdsSub = `SELECT id FROM events WHERE team_id = '${CANONICAL_TEAM_ID}' AND date BETWEEN '${WINDOW_START}' AND '${WINDOW_END}'`;
  const gameIdsSub = `SELECT id FROM games WHERE team_id = '${CANONICAL_TEAM_ID}' AND event_id IN (${eventIdsSub})`;

  const stmts: Array<[string, string, string]> = [
    ["player_game_stats(window)", "player_game_stats", `match_id IN (${gameIdsSub})`],
    ["attendance(window)",        "attendance",        `event_id IN (${eventIdsSub})`],
    ["games(window)",             "games",             `team_id = '${CANONICAL_TEAM_ID}' AND event_id IN (${eventIdsSub})`],
    ["off_days(window)",          "off_days",          `team_id = '${CANONICAL_TEAM_ID}' AND date BETWEEN '${WINDOW_START}' AND '${WINDOW_END}'`],
    ["events(window)",            "events",            `team_id = '${CANONICAL_TEAM_ID}' AND date BETWEEN '${WINDOW_START}' AND '${WINDOW_END}'`],
  ];

  for (let i = 0; i < stmts.length; i++) {
    const [label, table, predicate] = stmts[i];
    const t0 = Date.now();
    _log(`[prod-bootstrap] window START [${i + 1}/${stmts.length}] ${label}`);
    try {
      const cntRow: any = await db.execute(sql.raw(
        `SELECT COUNT(*)::bigint AS c FROM ${table} WHERE ${predicate}`
      ));
      const expected = Number(cntRow.rows?.[0]?.c ?? 0);
      _log(`[prod-bootstrap]   ${label}: ${expected} candidate rows to delete`);

      const deleted = await chunkedDeleteByPredicate(table, predicate);
      summary[label] = deleted;
      _log(`[prod-bootstrap] window END   [${i + 1}/${stmts.length}] ${label}: deleted ${deleted} in ${Date.now() - t0}ms`);
    } catch (err: any) {
      _warn(`[prod-bootstrap] window ${label} FAILED after ${Date.now() - t0}ms: ${err.message}`);
      summary[label] = -1;
    }
  }
  return summary;
}

interface RosterCtx {
  rosterId: string;
  gameId: string;
  seasonId: string | null;
  subTypes: { practice: string | null; warmup: string | null; tournament: string | null; meeting: string | null };
  modes: Array<{ id: string; mapIds: string[]; statFieldIds: string[] }>;
  playerIds: string[];
  staffIds: string[];
}

async function loadRosterContexts(): Promise<RosterCtx[]> {
  const rosters: any = await db.execute(sql`
    SELECT id, game_id FROM rosters WHERE team_id = ${CANONICAL_TEAM_ID}
  `);
  const out: RosterCtx[] = [];
  for (const row of rosters.rows as any[]) {
    const rosterId = row.id as string;
    const gameId = row.game_id as string;

    const season: any = await db.execute(sql`
      SELECT id FROM seasons WHERE team_id = ${CANONICAL_TEAM_ID} AND roster_id = ${rosterId} LIMIT 1
    `);
    let seasonId: string | null = season.rows?.[0]?.id ?? null;
    if (!seasonId) {
      const ins: any = await db.execute(sql`
        INSERT INTO seasons (team_id, game_id, roster_id, name, description)
        VALUES (${CANONICAL_TEAM_ID}, ${gameId}, ${rosterId}, 'Season 2026', 'Spring 2026')
        RETURNING id
      `);
      seasonId = ins.rows?.[0]?.id ?? null;
    }

    const subTypes: any = await db.execute(sql`
      SELECT est.id, est.name, ec.name AS category_name
      FROM event_sub_types est
      JOIN event_categories ec ON ec.id = est.category_id
      WHERE est.team_id = ${CANONICAL_TEAM_ID} AND est.roster_id = ${rosterId}
    `);
    const stMap: any = { practice: null, warmup: null, tournament: null, meeting: null };
    for (const s of subTypes.rows as any[]) {
      const n = String(s.name).toLowerCase();
      const c = String(s.category_name || "").toLowerCase();
      if (!stMap.practice && (n.includes("practice") || n.includes("scrim"))) stMap.practice = s.id;
      if (!stMap.warmup && n.includes("warm")) stMap.warmup = s.id;
      if (!stMap.tournament && (c.includes("tournament") || c.includes("league") || n.includes("cup") || n.includes("league") || n.includes("stage"))) stMap.tournament = s.id;
      if (!stMap.meeting && (c.includes("meeting") || n.includes("vod") || n.includes("review") || n.includes("brief"))) stMap.meeting = s.id;
    }

    const modesRows: any = await db.execute(sql`
      SELECT id FROM game_modes WHERE team_id = ${CANONICAL_TEAM_ID} AND roster_id = ${rosterId}
    `);
    const modes: RosterCtx["modes"] = [];
    for (const m of modesRows.rows as any[]) {
      const mapsRows: any = await db.execute(sql`
        SELECT id FROM maps WHERE team_id = ${CANONICAL_TEAM_ID} AND game_mode_id = ${m.id}
      `);
      const sfRows: any = await db.execute(sql`
        SELECT id FROM stat_fields WHERE team_id = ${CANONICAL_TEAM_ID} AND game_mode_id = ${m.id}
      `);
      modes.push({
        id: m.id,
        mapIds: (mapsRows.rows as any[]).map((x) => x.id),
        statFieldIds: (sfRows.rows as any[]).map((x) => x.id),
      });
    }

    const playersRows: any = await db.execute(sql`
      SELECT id FROM players WHERE team_id = ${CANONICAL_TEAM_ID} AND roster_id = ${rosterId}
    `);
    const staffRows: any = await db.execute(sql`
      SELECT id FROM staff WHERE team_id = ${CANONICAL_TEAM_ID} AND roster_id = ${rosterId}
    `);

    out.push({
      rosterId,
      gameId,
      seasonId,
      subTypes: stMap,
      modes,
      playerIds: (playersRows.rows as any[]).map((x) => x.id),
      staffIds: (staffRows.rows as any[]).map((x) => x.id),
    });
  }
  return out;
}

async function reseedWindow(ctxs: RosterCtx[]): Promise<{ events: number; games: number; stats: number; attendance: number; offDays: number }> {
  let evCount = 0, gameCount = 0, statCount = 0, attCount = 0, offCount = 0;

  for (let ci = 0; ci < ctxs.length; ci++) {
    const ctx = ctxs[ci];
    const ctxT0 = Date.now();
    _log(`[prod-bootstrap] reseed START roster [${ci + 1}/${ctxs.length}] ${ctx.rosterId} (players=${ctx.playerIds.length}, staff=${ctx.staffIds.length}, modes=${ctx.modes.length})`);
    let ctxEv = 0, ctxGames = 0;
    for (const date of dateRange(WINDOW_START, WINDOW_END)) {
      const dow = dayOfWeekUTC(date);
      if (dow === 4 || dow === 5) {
        await db.execute(sql`
          INSERT INTO off_days (team_id, game_id, roster_id, date)
          VALUES (${CANONICAL_TEAM_ID}, ${ctx.gameId}, ${ctx.rosterId}, ${date})
        `);
        offCount++;
        continue;
      }

      const r1 = hash(`${ctx.rosterId}|${date}|plan`);
      const plan = pickWeighted(
        ["none", "practice", "tournament_with_warmup", "meeting_only", "practice_plus_meeting"],
        [20, 50, 15, 10, 5],
        r1,
      );
      if (plan === "none") continue;

      const eventsToCreate: Array<{ kind: "scrim" | "tournament" | "meeting"; subTypeId: string | null; title: string; time: string }> = [];
      if (plan === "practice") {
        eventsToCreate.push({ kind: "scrim", subTypeId: ctx.subTypes.practice, title: "Practice", time: "20:00" });
      } else if (plan === "tournament_with_warmup") {
        eventsToCreate.push({ kind: "scrim", subTypeId: ctx.subTypes.warmup ?? ctx.subTypes.practice, title: "Warm-up", time: "18:00" });
        eventsToCreate.push({ kind: "tournament", subTypeId: ctx.subTypes.tournament ?? ctx.subTypes.practice, title: "Tournament Match", time: "21:00" });
      } else if (plan === "meeting_only") {
        eventsToCreate.push({ kind: "meeting", subTypeId: ctx.subTypes.meeting, title: "Vod Review", time: "19:00" });
      } else if (plan === "practice_plus_meeting") {
        eventsToCreate.push({ kind: "meeting", subTypeId: ctx.subTypes.meeting, title: "Briefing", time: "17:00" });
        eventsToCreate.push({ kind: "scrim", subTypeId: ctx.subTypes.practice, title: "Practice", time: "20:00" });
      }

      for (let ei = 0; ei < eventsToCreate.length; ei++) {
        const ev = eventsToCreate[ei];
        const eventTypeStr = ev.kind === "tournament" ? "tournament" : ev.kind === "meeting" ? "meeting" : "scrim";
        const ins: any = await db.execute(sql`
          INSERT INTO events (team_id, game_id, roster_id, title, event_type, event_sub_type, date, time, season_id)
          VALUES (
            ${CANONICAL_TEAM_ID}, ${ctx.gameId}, ${ctx.rosterId},
            ${ev.title}, ${eventTypeStr}, ${ev.subTypeId},
            ${date}, ${ev.time}, ${ctx.seasonId}
          )
          RETURNING id
        `);
        const eventId = ins.rows?.[0]?.id as string;
        evCount++;
        ctxEv++;

        if (ev.kind !== "meeting" && ctx.modes.length > 0) {
          for (let g = 1; g <= 5; g++) {
            const rMode = hash(`${ctx.rosterId}|${date}|${ei}|m${g}`);
            const mode = ctx.modes[Math.floor(rMode * ctx.modes.length)];
            const mapId = mode.mapIds.length > 0
              ? mode.mapIds[Math.floor(hash(`${eventId}|${g}|map`) * mode.mapIds.length)]
              : null;
            const rScore = hash(`${eventId}|${g}|score`);
            const won = rScore > 0.45;
            const score = won ? "13-9" : "9-13";
            const result = won ? "win" : "loss";
            const gins: any = await db.execute(sql`
              INSERT INTO games (team_id, game_id, roster_id, event_id, game_code, score, game_mode_id, map_id, result)
              VALUES (
                ${CANONICAL_TEAM_ID}, ${ctx.gameId}, ${ctx.rosterId}, ${eventId},
                ${`G${g}`}, ${score}, ${mode.id}, ${mapId}, ${result}
              )
              RETURNING id
            `);
            const matchId = gins.rows?.[0]?.id as string;
            gameCount++;
            ctxGames++;

            const statRows: string[] = [];
            for (const playerId of ctx.playerIds) {
              for (const sfId of mode.statFieldIds) {
                const rv = hash(`${matchId}|${playerId}|${sfId}`);
                const value = Math.floor(rv * 25);
                statRows.push(`('${CANONICAL_TEAM_ID}','${ctx.gameId}','${matchId}','${playerId}','${sfId}','${value}')`);
              }
            }
            if (statRows.length > 0) {
              await db.execute(sql.raw(
                `INSERT INTO player_game_stats (team_id, game_id, match_id, player_id, stat_field_id, value) VALUES ${statRows.join(",")}`
              ));
              statCount += statRows.length;
            }
          }
        }

        const attRows: string[] = [];
        for (const playerId of ctx.playerIds) {
          const rA = hash(`${eventId}|${playerId}|att`);
          const status = rA < 0.85 ? "present" : rA < 0.93 ? "late" : "absent";
          attRows.push(`('${CANONICAL_TEAM_ID}','${ctx.gameId}','${ctx.rosterId}','${playerId}',NULL,'${date}','${eventId}','${status}')`);
        }
        for (const staffId of ctx.staffIds) {
          const rA = hash(`${eventId}|${staffId}|att`);
          const status = rA < 0.9 ? "present" : "absent";
          attRows.push(`('${CANONICAL_TEAM_ID}','${ctx.gameId}','${ctx.rosterId}',NULL,'${staffId}','${date}','${eventId}','${status}')`);
        }
        if (attRows.length > 0) {
          await db.execute(sql.raw(
            `INSERT INTO attendance (team_id, game_id, roster_id, player_id, staff_id, date, event_id, status) VALUES ${attRows.join(",")}`
          ));
          attCount += attRows.length;
        }
      }
    }
    _log(`[prod-bootstrap] reseed END   roster [${ci + 1}/${ctxs.length}] ${ctx.rosterId}: events=${ctxEv} games=${ctxGames} in ${Date.now() - ctxT0}ms`);
  }
  return { events: evCount, games: gameCount, stats: statCount, attendance: attCount, offDays: offCount };
}

const ADVISORY_LOCK_KEY = 7345291004981234;

async function tryAcquireLock(): Promise<boolean> {
  const r: any = await db.execute(sql`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS got`);
  return Boolean(r.rows?.[0]?.got);
}

async function releaseLock(): Promise<void> {
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`);
  } catch {}
}

async function runCorePhases(): Promise<{ ok: boolean; summary: any }> {
  const t0 = Date.now();
  _log("[prod-bootstrap] STARTING (lock acquired) — orphan cleanup + Mar 28-May 28 reseed...");

  _log("[prod-bootstrap] Phase A: orphan cleanup...");
  const orphanSummary = await cleanupOrphans();
  _log(`[prod-bootstrap] Phase A complete. Per-table totals: ${JSON.stringify(orphanSummary)}`);

  _log("[prod-bootstrap] Phase B: window cleanup (Mar 28 - May 28)...");
  const windowSummary = await cleanupWindow();
  _log(`[prod-bootstrap] Phase B complete: ${JSON.stringify(windowSummary)}`);

  _log("[prod-bootstrap] Phase C: loading roster contexts...");
  const ctxs = await loadRosterContexts();
  _log(`[prod-bootstrap] Phase C complete. Loaded ${ctxs.length} roster contexts.`);

  _log("[prod-bootstrap] Phase D: reseeding events with Thu/Fri off-days...");
  const reseedSummary = await reseedWindow(ctxs);
  _log(`[prod-bootstrap] Phase D complete: ${JSON.stringify(reseedSummary)}`);

  await markDone();
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  _log(`[prod-bootstrap] DONE in ${dt}s. Sentinel marked.`);
  return { ok: true, summary: { orphanSummary, windowSummary, reseedSummary, durationSec: dt } };
}

export async function runProdBootstrap(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log("[prod-bootstrap] Skipped (NODE_ENV is not production).");
    return;
  }
  if (process.env.TEAM_ID !== CANONICAL_TEAM_ID) {
    console.log(`[prod-bootstrap] Skipped (TEAM_ID=${process.env.TEAM_ID} != canonical).`);
    return;
  }
  if (await isAlreadyDone()) {
    console.log("[prod-bootstrap] Sentinel found, skipping (already complete).");
    return;
  }

  const gotLock = await tryAcquireLock();
  if (!gotLock) {
    console.log("[prod-bootstrap] Another instance holds the bootstrap lock; skipping this replica.");
    return;
  }

  try {
    await runCorePhases();
  } catch (err: any) {
    console.error("[prod-bootstrap] FATAL:", err?.message || err, err?.stack);
  } finally {
    await releaseLock();
  }
}

export async function runProdBootstrapNow(): Promise<{ status: string; summary?: any; error?: string }> {
  if (process.env.TEAM_ID !== CANONICAL_TEAM_ID) {
    return { status: "skipped", error: `TEAM_ID=${process.env.TEAM_ID} != canonical` };
  }
  if (await isAlreadyDone()) {
    return { status: "already_done" };
  }
  const gotLock = await tryAcquireLock();
  if (!gotLock) {
    return { status: "locked", error: "Another instance is already running the bootstrap" };
  }
  try {
    const r = await runCorePhases();
    return { status: "completed", summary: r.summary };
  } catch (err: any) {
    _warn(`[prod-bootstrap] FATAL: ${err?.message || err}`);
    return { status: "error", error: err?.message || String(err) };
  } finally {
    await releaseLock();
  }
}
