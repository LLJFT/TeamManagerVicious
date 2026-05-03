// Generates per-ratio storyboard SVG frames, rasterizes them to PNG via
// ImageMagick, and assembles the long (75s) and short (35s) animatic MP4s
// for 16:9, 9:16, and 1:1 using ffmpeg. The output is the on-brand
// storyboard reference for the Vicious explainer video.
//
//   node deliverables/explainer_video/scripts/build_video.mjs

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FRAMES = path.join(ROOT, "frames");
const EXPORTS = path.join(ROOT, "exports");
const STORYBOARD = path.join(ROOT, "storyboard");

const C = {
  onyx: "#0E1117",
  carbon: "#1A1F2A",
  carbon2: "#222836",
  bone: "#F5F6F8",
  steel: "#5B6573",
  steelDim: "#3A4150",
  crimson: "#E11D2E",
  crimsonDim: "#7A1018",
  signal: "#F59E0B",
  success: "#16A34A",
  chart2: "#5B7FB1",
  violet: "#8B5CF6",
  rule: "#2A3140",
};

const RATIOS = {
  "16x9": { w: 1920, h: 1080 },
  "9x16": { w: 1080, h: 1920 },
  "1x1":  { w: 1080, h: 1080 },
};

// Long cut scene durations (seconds) -> sum 75
const LONG = [
  ["01", 5], ["02", 5], ["03", 4], ["04", 8], ["05", 8], ["06", 6],
  ["07", 6], ["08", 6], ["09", 8], ["10", 6], ["11", 6], ["12", 7],
];
// Short cut keeps scenes 01,04,05,07,09,11,12 -> sum 35
const SHORT = [
  ["01", 3], ["04", 4], ["05", 6], ["07", 5], ["09", 6], ["11", 4], ["12", 7],
];

const FPS = 30;

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svgOpen(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
}
function svgClose() { return `</svg>`; }
function bg(w, h, fill = C.onyx) { return `<rect width="${w}" height="${h}" fill="${fill}"/>`; }

function eyebrow(x, y, text, fill = C.steel, size = 14, anchor = "start") {
  return `<text x="${x}" y="${y}" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="500" font-size="${size}" letter-spacing="3" fill="${fill}" text-anchor="${anchor}">${esc(text.toUpperCase())}</text>`;
}
function display(x, y, text, opts = {}) {
  const { size = 72, fill = C.bone, anchor = "start", track = 4 } = opts;
  return `<text x="${x}" y="${y}" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="900" font-size="${size}" letter-spacing="${track}" fill="${fill}" text-anchor="${anchor}">${esc(text.toUpperCase())}</text>`;
}
function body(x, y, text, opts = {}) {
  const { size = 16, fill = C.bone, weight = 400, anchor = "start" } = opts;
  return `<text x="${x}" y="${y}" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${esc(text)}</text>`;
}
function rule(x1, y1, x2, y2, stroke = C.rule, sw = 1) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;
}
function rect(x, y, w, h, fill, opts = {}) {
  const { rx = 0, stroke, sw = 1 } = opts;
  const s = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${s}/>`;
}
function vGlyph(cx, cy, size, fill = C.crimson, accent = "#FFFFFF", accentOp = 0.18) {
  // outer V path scaled. base path on 64x64 viewBox: M10 12 L22 12 L32 40 L42 12 L54 12 L36 56 L28 56 Z
  const k = size / 64;
  const tx = cx - size / 2;
  const ty = cy - size / 2;
  const outer = [[10,12],[22,12],[32,40],[42,12],[54,12],[36,56],[28,56]]
    .map(([x,y]) => `${tx + x * k} ${ty + y * k}`).join(" L ");
  const inner = [[24,12],[27,12],[32,26],[37,12],[40,12],[34,30],[30,30]]
    .map(([x,y]) => `${tx + x * k} ${ty + y * k}`).join(" L ");
  return `<g><path d="M ${outer} Z" fill="${fill}"/><path d="M ${inner} Z" fill="${accent}" fill-opacity="${accentOp}"/></g>`;
}
function chip(x, y, w, h, label, fill = C.carbon2, txt = C.bone, border = C.rule) {
  return `${rect(x, y, w, h, fill, { rx: 6, stroke: border, sw: 1 })}` +
    body(x + w / 2, y + h / 2 + 4, label, { size: 11, fill: txt, weight: 600, anchor: "middle" });
}
function watermark(w, h) {
  return body(w - 28, h - 28, "VICIOUS  ·  vicious.gg", { size: 11, fill: C.steel, weight: 500, anchor: "end" });
}
function safeBox(w, h, margin) {
  return `<rect x="${margin}" y="${margin}" width="${w - margin * 2}" height="${h - margin * 2}" fill="none" stroke="none"/>`;
}

// ---------- per-scene composers ----------
// Each composer takes (w, h, layout) where layout is "wide" | "tall" | "square"
// and returns the inner SVG markup to be wrapped.

function scene01(w, h, layout) {
  const cx = w / 2, cy = h / 2;
  const glyph = Math.round(Math.min(w, h) * 0.22);
  const rl = Math.round(Math.min(w, h) * 0.4);
  return [
    bg(w, h),
    // hairline
    layout === "tall"
      ? rule(cx, cy + glyph * 0.7, cx, cy + glyph * 0.7 + rl, C.crimson, 2)
      : rule(cx - rl / 2, cy + glyph * 0.65, cx + rl / 2, cy + glyph * 0.65, C.crimson, 2),
    vGlyph(cx, cy - glyph * 0.05, glyph),
    eyebrow(cx, cy + glyph * 0.95, "Vicious  ·  Tactical Esports Platform", C.steel, layout === "tall" ? 18 : 14, "middle"),
    watermark(w, h),
  ].join("\n");
}

function scene02(w, h, layout) {
  // chaos: ghost browser tabs + kinetic line
  const tabs = [];
  const tabRows = layout === "tall" ? 3 : 2;
  const perRow = layout === "tall" ? 3 : 6;
  const tabW = Math.floor((w - 160) / perRow);
  const tabH = 36;
  let i = 0;
  for (let r = 0; r < tabRows; r++) {
    for (let c = 0; c < perRow; c++, i++) {
      const x = 80 + c * tabW + 4;
      const y = 90 + r * (tabH + 12);
      tabs.push(rect(x, y, tabW - 8, tabH, C.carbon, { rx: 6, stroke: C.rule, sw: 1 }));
      tabs.push(body(x + 12, y + 22, ["sheets", "discord", "vlr.gg", "scrim doc", "calendar", "twitch", "vods", "notes"][(i) % 8], { size: 11, fill: C.steel }));
    }
  }
  const ds = layout === "tall" ? 64 : 88;
  return [
    bg(w, h),
    ...tabs,
    display(w / 2, h / 2 - 20, "TWELVE TABS.", { size: ds, anchor: "middle", fill: C.bone }),
    display(w / 2, h / 2 + ds, "THREE GROUP CHATS.", { size: Math.round(ds * 0.7), anchor: "middle", fill: C.steel }),
    display(w / 2, h / 2 + ds * 1.9, "ONE SCRIM IN 40 MIN.", { size: Math.round(ds * 0.6), anchor: "middle", fill: C.crimson }),
    watermark(w, h),
  ].join("\n");
}

function scene03(w, h, layout) {
  const cx = w / 2, cy = h / 2;
  const cardW = Math.min(w - 160, layout === "tall" ? 880 : 760);
  const cardH = layout === "tall" ? 180 : 140;
  const score = "L · L · L · L · W · L";
  return [
    bg(w, h),
    body(cx, cy - cardH / 2 - 28, score, { size: layout === "tall" ? 36 : 32, fill: C.steel, weight: 700, anchor: "middle" }),
    rect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, C.carbon, { rx: 10, stroke: C.signal, sw: 2 }),
    rect(cx - cardW / 2 + 24, cy - 12, 14, 14, C.signal, { rx: 3 }),
    body(cx - cardW / 2 + 50, cy + 0, "ROSTER UNCONFIRMED  ·  12 MIN TO SCRIM", { size: layout === "tall" ? 22 : 18, weight: 700, fill: C.bone }),
    eyebrow(cx, cy + cardH / 2 + 56, "This is how seasons quietly fall apart", C.bone, layout === "tall" ? 22 : 18, "middle"),
    watermark(w, h),
  ].join("\n");
}

function dashboardMockup(x, y, w, h) {
  const sbw = Math.min(160, w * 0.18);
  const headerH = 48;
  const pad = 16;
  const inner = [];
  // panel
  inner.push(rect(x, y, w, h, C.carbon, { rx: 12, stroke: C.rule, sw: 1 }));
  // sidebar
  inner.push(rect(x, y, sbw, h, C.carbon2, { rx: 12 }));
  inner.push(rect(x + sbw - 12, y, 12, h, C.carbon2));
  inner.push(vGlyph(x + sbw / 2, y + 36, 28));
  const navItems = ["Today", "Roster", "Scrims", "Opponents", "Analytics", "Org"];
  navItems.forEach((n, i) => {
    const ny = y + 84 + i * 36;
    if (i === 0) inner.push(rect(x + 14, ny - 16, sbw - 28, 28, "#2A3140", { rx: 6 }));
    inner.push(body(x + 28, ny + 4, n, { size: 13, fill: i === 0 ? C.bone : C.steel, weight: i === 0 ? 600 : 500 }));
  });
  // header
  inner.push(rect(x + sbw, y, w - sbw, headerH, C.carbon));
  inner.push(rule(x + sbw, y + headerH, x + w, y + headerH, C.rule));
  inner.push(eyebrow(x + sbw + 20, y + 30, "Today  ·  Tue 14 May", C.steel, 11));
  inner.push(chip(x + w - 130, y + 12, 110, 24, "Roster ready", C.carbon2, C.success, C.success));
  // KPIs
  const kx = x + sbw + pad, ky = y + headerH + pad;
  const kw = (w - sbw - pad * 4) / 3;
  const kpis = [["Win rate", "64%", C.crimson], ["Scrims this week", "11", C.bone], ["Avg KD", "1.18", C.bone]];
  kpis.forEach((k, i) => {
    const kxi = kx + i * (kw + pad);
    inner.push(rect(kxi, ky, kw, 110, C.carbon2, { rx: 9, stroke: C.rule }));
    inner.push(eyebrow(kxi + 16, ky + 24, k[0], C.steel, 11));
    inner.push(body(kxi + 16, ky + 78, k[1], { size: 44, fill: k[2], weight: 800 }));
  });
  // schedule
  const sy = ky + 130;
  const sh = h - (sy - y) - pad;
  inner.push(rect(kx, sy, w - sbw - pad * 2, sh, C.carbon2, { rx: 9, stroke: C.rule }));
  inner.push(eyebrow(kx + 16, sy + 24, "Schedule  ·  next 7 days", C.steel, 11));
  const days = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];
  const slotW = (w - sbw - pad * 4) / 7;
  days.forEach((d, i) => {
    const dx = kx + 12 + i * slotW;
    inner.push(rect(dx, sy + 40, slotW - 8, sh - 56, C.carbon, { rx: 6, stroke: C.rule }));
    inner.push(body(dx + 10, sy + 58, d, { size: 11, fill: C.steel, weight: 600 }));
    if (i === 0 || i === 2 || i === 4) {
      inner.push(rect(dx + 8, sy + 72, slotW - 24, 22, C.crimson, { rx: 4 }));
      inner.push(body(dx + 14, sy + 87, "Scrim", { size: 10, fill: C.bone, weight: 700 }));
    }
    if (i === 5) {
      inner.push(rect(dx + 8, sy + 100, slotW - 24, 22, C.chart2, { rx: 4 }));
      inner.push(body(dx + 14, sy + 115, "VOD review", { size: 10, fill: C.bone, weight: 700 }));
    }
  });
  return inner.join("\n");
}

function scene04(w, h, layout) {
  const margin = layout === "tall" ? 60 : 80;
  const headerH = layout === "tall" ? 200 : 160;
  const dx = margin, dy = headerH;
  const dw = w - margin * 2;
  const dh = h - headerH - margin - 48;
  return [
    bg(w, h),
    eyebrow(margin, 70, "The solution", C.crimson, layout === "tall" ? 16 : 14),
    display(margin, layout === "tall" ? 130 : 118, "ONE COMMAND CENTER.", { size: layout === "tall" ? 60 : 56 }),
    body(margin, layout === "tall" ? 170 : 152, "for serious esports orgs.", { size: layout === "tall" ? 22 : 18, fill: C.steel, weight: 500 }),
    dashboardMockup(dx, dy, dw, dh),
    watermark(w, h),
  ].join("\n");
}

function rosterMockup(x, y, w, h) {
  const colW = Math.floor(w * 0.36);
  const inner = [];
  inner.push(rect(x, y, w, h, C.carbon, { rx: 12, stroke: C.rule }));
  // left list
  inner.push(rect(x, y, colW, h, C.carbon2, { rx: 12 }));
  inner.push(rect(x + colW - 12, y, 12, h, C.carbon2));
  inner.push(eyebrow(x + 20, y + 30, "Roster  ·  Valorant A", C.steel, 11));
  const players = [
    ["KT", "Vortex", "Duelist", true],
    ["MR", "Mira", "Controller", false],
    ["AS", "Asher", "Sentinel", false],
    ["JN", "Juno", "Initiator", false],
    ["RV", "Rave", "IGL", false],
  ];
  players.forEach((p, i) => {
    const py = y + 60 + i * 56;
    if (p[3]) inner.push(rect(x + 12, py - 8, colW - 24, 48, "#2A3140", { rx: 8 }));
    inner.push(rect(x + 24, py, 32, 32, C.crimson, { rx: 16 }));
    inner.push(body(x + 40, py + 22, p[0], { size: 13, fill: C.bone, weight: 800, anchor: "middle" }));
    inner.push(body(x + 68, py + 14, p[1], { size: 14, fill: C.bone, weight: 700 }));
    inner.push(body(x + 68, py + 30, p[2].toUpperCase(), { size: 10, fill: C.steel, weight: 600 }));
  });
  // right pane
  const rx = x + colW + 16;
  const rw = w - colW - 32;
  inner.push(eyebrow(rx, y + 30, "Player profile", C.steel, 11));
  inner.push(display(rx, y + 70, "K. ‘VORTEX’ TANAKA", { size: 28, fill: C.bone }));
  inner.push(body(rx, y + 96, "Duelist  ·  3yr  ·  JST", { size: 13, fill: C.steel, weight: 500 }));
  // KPI strip
  const stats = [["KD", "1.34", C.crimson], ["HS%", "29", C.bone], ["ACS", "248", C.bone], ["Avail/wk", "22h", C.bone]];
  stats.forEach((s, i) => {
    const sx = rx + i * 130;
    inner.push(rect(sx, y + 120, 116, 64, C.carbon2, { rx: 8, stroke: C.rule }));
    inner.push(eyebrow(sx + 12, y + 138, s[0], C.steel, 10));
    inner.push(body(sx + 12, y + 174, s[1], { size: 24, fill: s[2], weight: 800 }));
  });
  // calendar
  const calY = y + 204;
  inner.push(eyebrow(rx, calY, "Availability  ·  next 7 days", C.steel, 11));
  const cellW = (rw - 12) / 7;
  for (let i = 0; i < 7; i++) {
    const cx = rx + i * cellW;
    inner.push(rect(cx, calY + 14, cellW - 8, 56, C.carbon2, { rx: 6, stroke: C.rule }));
    if (i !== 1 && i !== 5) inner.push(rect(cx + 4, calY + 18, cellW - 16, 48, C.success, { rx: 4 }));
    else inner.push(rect(cx + 4, calY + 18, cellW - 16, 48, C.steelDim, { rx: 4 }));
    inner.push(body(cx + 8, calY + 32, ["T","W","T","F","S","S","M"][i], { size: 11, fill: C.bone, weight: 700 }));
  }
  return inner.join("\n");
}

function scene05(w, h, layout) {
  const margin = 80;
  return [
    bg(w, h),
    eyebrow(margin, 70, "How it works  ·  01", C.crimson, 14),
    display(margin, 124, "ROSTER. SCRIMS. AVAILABILITY.", { size: layout === "tall" ? 48 : 52 }),
    rosterMockup(margin, 170, w - margin * 2, h - 170 - 60),
    watermark(w, h),
  ].join("\n");
}

function opponentMockup(x, y, w, h) {
  const inner = [];
  inner.push(rect(x, y, w, h, C.carbon, { rx: 12, stroke: C.rule }));
  // header
  inner.push(rect(x + 24, y + 24, 48, 48, C.steelDim, { rx: 6 }));
  inner.push(display(x + 88, y + 60, "TEAM PHANTOM", { size: 24 }));
  inner.push(body(x + 88, y + 80, "Record 18-6  ·  EU  ·  Last meeting: W 13-9", { size: 12, fill: C.steel, weight: 500 }));
  // map heatmap
  const mhY = y + 110;
  inner.push(eyebrow(x + 24, mhY, "Map pool  ·  pick rate", C.steel, 11));
  const maps = [["Haven", 0.31], ["Bind", 0.22], ["Lotus", 0.19], ["Ascent", 0.14], ["Sunset", 0.14]];
  const barAreaW = w - 48;
  maps.forEach((m, i) => {
    const by = mhY + 24 + i * 36;
    inner.push(body(x + 24, by + 14, m[0], { size: 12, fill: C.bone, weight: 600 }));
    inner.push(rect(x + 110, by, barAreaW - 110 - 60, 22, C.carbon2, { rx: 4 }));
    inner.push(rect(x + 110, by, (barAreaW - 110 - 60) * m[1], 22, C.crimson, { rx: 4 }));
    inner.push(body(x + w - 28, by + 16, Math.round(m[1] * 100) + "%", { size: 12, fill: C.bone, weight: 700, anchor: "end" }));
  });
  // side: top comps
  const compY = mhY + 24 + maps.length * 36 + 12;
  inner.push(eyebrow(x + 24, compY, "Top comps faced", C.steel, 11));
  const comps = [["Jett · Sova · KAY/O · Killjoy · Omen", "62%"], ["Raze · Skye · Breach · Cypher · Brim", "55%"]];
  comps.forEach((c, i) => {
    const cy = compY + 18 + i * 38;
    inner.push(rect(x + 24, cy, w - 48, 30, C.carbon2, { rx: 6, stroke: C.rule }));
    inner.push(body(x + 36, cy + 20, c[0], { size: 12, fill: C.bone, weight: 500 }));
    inner.push(body(x + w - 36, cy + 20, c[1], { size: 12, fill: C.crimson, weight: 800, anchor: "end" }));
  });
  return inner.join("\n");
}

function scene06(w, h, layout) {
  const margin = 80;
  return [
    bg(w, h),
    eyebrow(margin, 70, "How it works  ·  02", C.crimson, 14),
    display(margin, 124, "SCOUT THE OPPONENT.", { size: layout === "tall" ? 48 : 56 }),
    body(margin, 156, "Map pool. Comp tendencies. Star players.", { size: 16, fill: C.steel, weight: 500 }),
    opponentMockup(margin, 190, w - margin * 2, h - 190 - 60),
    watermark(w, h),
  ].join("\n");
}

function pickerMockup(x, y, w, h) {
  const inner = [];
  inner.push(rect(x, y, w, h, C.carbon, { rx: 12, stroke: C.rule }));
  inner.push(eyebrow(x + 24, y + 30, "Map pool  ·  6 selected", C.steel, 11));
  // map row
  const mapTileW = (w - 48 - 5 * 12) / 6;
  const mapTileH = 80;
  const mapNames = ["Haven", "Bind", "Lotus", "Ascent", "Sunset", "Split"];
  mapNames.forEach((m, i) => {
    const tx = x + 24 + i * (mapTileW + 12);
    inner.push(rect(tx, y + 50, mapTileW, mapTileH, C.carbon2, { rx: 8, stroke: i === 2 ? C.crimson : C.rule, sw: i === 2 ? 2 : 1 }));
    inner.push(body(tx + 10, y + 50 + mapTileH - 12, m, { size: 12, fill: C.bone, weight: 700 }));
  });
  // agent grid
  inner.push(eyebrow(x + 24, y + 156, "Agents  ·  pick your comp  ·  5/5", C.steel, 11));
  const cols = 6;
  const aW = (w - 48 - (cols - 1) * 12) / cols;
  const aH = 84;
  const agents = ["JETT","RAZE","SOVA","KAY/O","KILLJOY","OMEN","CYPHER","SKYE","BREACH","BRIM","REYNA","NEON"];
  const picked = [0, 2, 3, 4, 5];
  agents.forEach((a, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const ax = x + 24 + c * (aW + 12);
    const ay = y + 180 + r * (aH + 12);
    const isPicked = picked.includes(i);
    inner.push(rect(ax, ay, aW, aH, C.carbon2, { rx: 8, stroke: isPicked ? C.crimson : C.rule, sw: isPicked ? 2 : 1 }));
    inner.push(rect(ax + aW / 2 - 18, ay + 14, 36, 36, C.steelDim, { rx: 6 }));
    inner.push(body(ax + aW / 2, ay + aH - 14, a, { size: 11, fill: isPicked ? C.bone : C.steel, weight: 700, anchor: "middle" }));
  });
  return inner.join("\n");
}

function scene07(w, h, layout) {
  const margin = 80;
  return [
    bg(w, h),
    eyebrow(margin, 70, "How it works  ·  03", C.crimson, 14),
    display(margin, 124, "PICK YOUR COMP.", { size: layout === "tall" ? 48 : 56 }),
    body(margin, 156, "Maps, heroes, agents — every game you compete in.", { size: 16, fill: C.steel, weight: 500 }),
    pickerMockup(margin, 190, w - margin * 2, h - 190 - 60),
    watermark(w, h),
  ].join("\n");
}

function draftMockup(x, y, w, h) {
  const inner = [];
  inner.push(rect(x, y, w, h, C.carbon, { rx: 12, stroke: C.rule }));
  // two columns
  const colW = (w - 72) / 2;
  const colH = 240;
  const cols = [["US", C.crimson, ["Jett", "Sova", "KAY/O", "Killjoy", "Omen"]], ["OPP", C.steel, ["Raze", "Skye", "Breach", "Cypher", "Brim"]]];
  cols.forEach((co, ci) => {
    const cx = x + 24 + ci * (colW + 24);
    inner.push(eyebrow(cx, y + 36, co[0], co[1], 13));
    co[2].forEach((a, i) => {
      const ay = y + 56 + i * 38;
      inner.push(rect(cx, ay, colW, 30, C.carbon2, { rx: 6, stroke: C.rule }));
      inner.push(rect(cx + 8, ay + 5, 20, 20, C.steelDim, { rx: 4 }));
      inner.push(body(cx + 38, ay + 20, a, { size: 13, fill: C.bone, weight: 600 }));
    });
  });
  // bars
  const by = y + 56 + 5 * 38 + 16;
  const stats = [["First-blood rate", 0.58, 0.41], ["Plant rate", 0.72, 0.64], ["Retake win", 0.51, 0.47]];
  stats.forEach((s, i) => {
    const ry = by + i * 36;
    inner.push(body(x + 24, ry + 18, s[0], { size: 12, fill: C.steel, weight: 600 }));
    const barX = x + 24 + 200;
    const barW = w - 200 - 48 - 100;
    inner.push(rect(barX, ry + 4, barW * s[1], 12, C.crimson, { rx: 3 }));
    inner.push(rect(barX, ry + 20, barW * s[2], 12, C.steel, { rx: 3 }));
    inner.push(body(x + w - 36, ry + 18, Math.round(s[1] * 100) + "% / " + Math.round(s[2] * 100) + "%", { size: 12, fill: C.bone, weight: 700, anchor: "end" }));
  });
  // win prob
  const wpY = by + stats.length * 36 + 20;
  inner.push(rect(x + 24, wpY, w - 48, 56, C.carbon2, { rx: 8, stroke: C.crimson, sw: 2 }));
  inner.push(eyebrow(x + 40, wpY + 22, "Projected win probability", C.steel, 11));
  inner.push(body(x + w - 40, wpY + 38, "64%", { size: 28, fill: C.crimson, weight: 800, anchor: "end" }));
  return inner.join("\n");
}

function scene08(w, h, layout) {
  const margin = 80;
  return [
    bg(w, h),
    eyebrow(margin, 70, "How it works  ·  04", C.crimson, 14),
    display(margin, 124, "DRAFT. STATS. EDGE.", { size: layout === "tall" ? 48 : 56 }),
    draftMockup(margin, 170, w - margin * 2, h - 170 - 60),
    watermark(w, h),
  ].join("\n");
}

function analyticsMockup(x, y, w, h) {
  const inner = [];
  inner.push(rect(x, y, w, h, C.carbon, { rx: 12, stroke: C.rule }));
  // chart area
  const chartW = Math.floor(w * 0.62) - 24;
  const chartH = h - 64;
  const cx0 = x + 24, cy0 = y + 32;
  inner.push(eyebrow(cx0, y + 28, "Win rate  ·  last 12 weeks", C.steel, 11));
  inner.push(rect(cx0, cy0 + 12, chartW, chartH - 12, C.carbon2, { rx: 9, stroke: C.rule }));
  // grid
  for (let i = 1; i < 5; i++) {
    const gy = cy0 + 12 + (chartH - 12) * (i / 5);
    inner.push(rule(cx0 + 12, gy, cx0 + chartW - 12, gy, C.rule, 1));
  }
  // line points
  const pts = [0.42, 0.48, 0.45, 0.52, 0.5, 0.55, 0.6, 0.58, 0.61, 0.62, 0.63, 0.64];
  const lx = cx0 + 24, lw = chartW - 48;
  const ltop = cy0 + 30, lh = chartH - 60;
  let path = "";
  pts.forEach((p, i) => {
    const px = lx + (lw / (pts.length - 1)) * i;
    const py = ltop + lh - lh * (p - 0.3) / 0.4;
    path += (i ? " L " : "M ") + px + " " + py;
    inner.push(`<circle cx="${px}" cy="${py}" r="3" fill="${C.crimson}"/>`);
  });
  inner.push(`<path d="${path}" stroke="${C.crimson}" stroke-width="2.5" fill="none"/>`);
  // endpoint badge
  const epx = lx + lw, epy = ltop + lh - lh * (0.64 - 0.3) / 0.4;
  inner.push(rect(epx - 60, epy - 32, 60, 22, C.crimson, { rx: 4 }));
  inner.push(body(epx - 30, epy - 17, "64% WR", { size: 11, fill: C.bone, weight: 800, anchor: "middle" }));

  // right side: top comps
  const rx = x + chartW + 48;
  const rw = w - (chartW + 48 + 24);
  inner.push(eyebrow(rx, y + 28, "Top winning comps", C.steel, 11));
  const comps = [
    ["Jett·Sova·KAY/O·Killjoy·Omen", 0.71],
    ["Raze·Skye·Breach·Cypher·Brim", 0.66],
    ["Neon·Sova·Fade·Killjoy·Brim", 0.62],
  ];
  comps.forEach((c, i) => {
    const cy = y + 56 + i * 64;
    inner.push(rect(rx, cy, rw, 52, C.carbon2, { rx: 8, stroke: C.rule }));
    inner.push(body(rx + 14, cy + 20, c[0], { size: 11, fill: C.bone, weight: 600 }));
    inner.push(rect(rx + 14, cy + 30, rw - 80, 8, C.steelDim, { rx: 2 }));
    inner.push(rect(rx + 14, cy + 30, (rw - 80) * c[1], 8, C.crimson, { rx: 2 }));
    inner.push(body(rx + rw - 14, cy + 38, Math.round(c[1] * 100) + "%", { size: 13, fill: C.crimson, weight: 800, anchor: "end" }));
  });
  return inner.join("\n");
}

function scene09(w, h, layout) {
  const margin = 80;
  return [
    bg(w, h),
    eyebrow(margin, 70, "Feature spotlight", C.crimson, 14),
    display(margin, 124, "WHAT YOUR TEAM ACTUALLY DOES.", { size: layout === "tall" ? 44 : 48 }),
    body(margin, 156, "Not what you think they do.", { size: 18, fill: C.steel, weight: 500 }),
    analyticsMockup(margin, 190, w - margin * 2, h - 190 - 60),
    watermark(w, h),
  ].join("\n");
}

function orgMockup(x, y, w, h) {
  const inner = [];
  inner.push(rect(x, y, w, h, C.carbon, { rx: 12, stroke: C.rule }));
  // grid 2x2
  const gx = x + 24, gy = y + 32;
  const gw = Math.floor(w * 0.62) - 24;
  const gh = h - 64;
  const cw = (gw - 16) / 2, ch = (gh - 16) / 2;
  const teams = [
    ["CS2", "Roster 5  ·  Next: vs Eclipse Sat", C.crimson],
    ["VALORANT", "Roster 5  ·  Next: vs Phantom Tue", C.bone],
    ["LEAGUE", "Roster 5  ·  Next: vs Argent Wed", C.bone],
    ["ROCKET LEAGUE", "Roster 3  ·  Next: vs Volt Fri", C.bone],
  ];
  teams.forEach((t, i) => {
    const r = Math.floor(i / 2), c = i % 2;
    const tx = gx + c * (cw + 16);
    const ty = gy + r * (ch + 16);
    inner.push(rect(tx, ty, cw, ch, C.carbon2, { rx: 9, stroke: C.rule }));
    inner.push(eyebrow(tx + 16, ty + 28, t[0], t[2], 12));
    inner.push(body(tx + 16, ty + 56, t[1], { size: 12, fill: C.steel, weight: 500 }));
    inner.push(chip(tx + 16, ty + ch - 36, 90, 22, "Active", C.carbon, C.success, C.success));
  });
  // subscription
  const sx = gx + gw + 24;
  const sw_ = w - (gw + 24 + 48);
  inner.push(rect(sx, gy, sw_, gh, C.carbon2, { rx: 9, stroke: C.crimson, sw: 2 }));
  inner.push(eyebrow(sx + 16, gy + 28, "Subscription  ·  Pro", C.crimson, 11));
  inner.push(display(sx + 16, gy + 80, "$29", { size: 56, fill: C.bone }));
  inner.push(body(sx + 16, gy + 104, "per seat / mo, billed annually", { size: 12, fill: C.steel, weight: 500 }));
  inner.push(rect(sx + 16, gy + 132, sw_ - 32, 1, C.rule));
  inner.push(body(sx + 16, gy + 162, "Seats", { size: 12, fill: C.steel, weight: 500 }));
  inner.push(body(sx + sw_ - 16, gy + 162, "12  →  18", { size: 16, fill: C.bone, weight: 800, anchor: "end" }));
  inner.push(rect(sx + 16, gy + 184, sw_ - 32, 1, C.rule));
  inner.push(body(sx + 16, gy + 214, "Total / yr", { size: 12, fill: C.steel, weight: 500 }));
  inner.push(body(sx + sw_ - 16, gy + 214, "$6,264", { size: 16, fill: C.crimson, weight: 800, anchor: "end" }));
  inner.push(rect(sx + 16, gy + gh - 60, sw_ - 32, 40, C.crimson, { rx: 6 }));
  inner.push(body(sx + sw_ / 2, gy + gh - 34, "ADD SEATS", { size: 12, fill: C.bone, weight: 800, anchor: "middle" }));
  return inner.join("\n");
}

function scene10(w, h, layout) {
  const margin = 80;
  return [
    bg(w, h),
    eyebrow(margin, 70, "Built to scale", C.crimson, 14),
    display(margin, 124, "TEAMS · TITLES · STAFF.", { size: layout === "tall" ? 48 : 52 }),
    body(margin, 156, "One subscription. One source of truth.", { size: 16, fill: C.steel, weight: 500 }),
    orgMockup(margin, 190, w - margin * 2, h - 190 - 60),
    watermark(w, h),
  ].join("\n");
}

function scene11(w, h, layout) {
  // Single kinetic type card (compositing of 3 happens at edit; we represent the dominant beat)
  const cx = w / 2, cy = h / 2;
  return [
    bg(w, h),
    display(cx, cy - 40, "LESS SPREADSHEET.", { size: layout === "tall" ? 64 : 84, anchor: "middle", fill: C.bone }),
    rule(cx - 220, cy + 10, cx + 220, cy + 10, C.crimson, 3),
    display(cx, cy + 90, "MORE WINNING.", { size: layout === "tall" ? 64 : 84, anchor: "middle", fill: C.crimson }),
    eyebrow(cx, cy + 160, "In control", C.steel, 16, "middle"),
    watermark(w, h),
  ].join("\n");
}

function scene12(w, h, layout) {
  const cx = w / 2, cy = h / 2;
  const glyph = Math.round(Math.min(w, h) * 0.16);
  // pattern grid (subtle)
  const gridLines = [];
  const step = 60;
  for (let i = step; i < w; i += step) gridLines.push(rule(i, 0, i, h, C.rule, 1));
  for (let i = step; i < h; i += step) gridLines.push(rule(0, i, w, i, C.rule, 1));
  return [
    bg(w, h),
    `<g opacity="0.18">${gridLines.join("")}</g>`,
    vGlyph(cx, cy - glyph * 0.7, glyph),
    display(cx, cy + glyph * 0.6, "VICIOUS", { size: layout === "tall" ? 80 : 92, anchor: "middle", track: 8 }),
    eyebrow(cx, cy + glyph * 1.05, "Run your roster like a pro", C.steel, layout === "tall" ? 18 : 14, "middle"),
    body(cx, cy + glyph * 1.6, "vicious.gg", { size: layout === "tall" ? 28 : 22, fill: C.bone, weight: 700, anchor: "middle" }),
  ].join("\n");
}

const COMPOSERS = {
  "01": scene01, "02": scene02, "03": scene03, "04": scene04,
  "05": scene05, "06": scene06, "07": scene07, "08": scene08,
  "09": scene09, "10": scene10, "11": scene11, "12": scene12,
};

// ---------- generation ----------
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function layoutFor(ratio) {
  if (ratio === "9x16") return "tall";
  if (ratio === "1x1") return "square";
  return "wide";
}

function buildSvg(ratio, sceneId) {
  const { w, h } = RATIOS[ratio];
  const inner = COMPOSERS[sceneId](w, h, layoutFor(ratio));
  return svgOpen(w, h) + inner + svgClose();
}

function writeFrames() {
  for (const ratio of Object.keys(RATIOS)) {
    const dir = path.join(FRAMES, ratio);
    ensureDir(dir);
    for (const id of Object.keys(COMPOSERS)) {
      const svg = buildSvg(ratio, id);
      fs.writeFileSync(path.join(dir, `scene-${id}.svg`), svg);
    }
  }
}

function rasterize() {
  for (const ratio of Object.keys(RATIOS)) {
    const dir = path.join(FRAMES, ratio);
    const { w, h } = RATIOS[ratio];
    for (const id of Object.keys(COMPOSERS)) {
      const inSvg = path.join(dir, `scene-${id}.svg`);
      const outPng = path.join(dir, `scene-${id}.png`);
      execSync(`convert -density 96 -background "${C.onyx}" -resize ${w}x${h}! "${inSvg}" "${outPng}"`, { stdio: "pipe" });
    }
  }
}

function buildContactSheet() {
  ensureDir(STORYBOARD);
  const tileW = 480, tileH = 270, gap = 24;
  const cols = 4, rows = 3;
  const W = cols * tileW + (cols + 1) * gap;
  const H = rows * tileH + (rows + 1) * gap + 80;
  const ids = Object.keys(COMPOSERS).sort();
  let parts = [];
  parts.push(svgOpen(W, H));
  parts.push(bg(W, H, C.onyx));
  parts.push(eyebrow(gap, 44, "Vicious Explainer  ·  storyboard contact sheet  ·  16:9", C.steel, 12));
  for (let i = 0; i < ids.length; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const x = gap + c * (tileW + gap);
    const y = 80 + r * (tileH + gap);
    // embed: scale wide composition into tile via viewBox group
    const inner = COMPOSERS[ids[i]](1920, 1080, "wide");
    const sx = tileW / 1920, sy = tileH / 1080;
    parts.push(`<g transform="translate(${x} ${y}) scale(${sx} ${sy})">${inner}</g>`);
    // label
    parts.push(rect(x, y + tileH - 24, tileW, 24, "rgba(14,17,23,0.7)"));
    parts.push(body(x + 10, y + tileH - 8, `Scene ${ids[i]}`, { size: 11, fill: C.bone, weight: 700 }));
  }
  parts.push(svgClose());
  fs.writeFileSync(path.join(STORYBOARD, "storyboard-contact-sheet.svg"), parts.join(""));
  // Rasterize the sheet too
  execSync(`convert -density 96 -background "${C.onyx}" "${path.join(STORYBOARD, "storyboard-contact-sheet.svg")}" "${path.join(STORYBOARD, "storyboard-contact-sheet.png")}"`, { stdio: "pipe" });
}

function buildMp4(ratio, cut, scenesWithDur, outName) {
  const dir = path.join(FRAMES, ratio);
  // Build concat list
  const tmpList = path.join(EXPORTS, `_concat-${ratio}-${cut}.txt`);
  const lines = [];
  for (const [id, dur] of scenesWithDur) {
    const png = path.join(dir, `scene-${id}.png`);
    lines.push(`file '${png.replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${dur}`);
  }
  // ffmpeg concat demuxer needs the last image repeated without duration
  const lastPng = path.join(dir, `scene-${scenesWithDur[scenesWithDur.length - 1][0]}.png`);
  lines.push(`file '${lastPng.replace(/'/g, "'\\''")}'`);
  fs.writeFileSync(tmpList, lines.join("\n"));
  const out = path.join(EXPORTS, outName);
  // Slow zoom + crossfade-ish via fps/scale only (concat demuxer keeps it simple/cinematic)
  const { w, h } = RATIOS[ratio];
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${tmpList}" -vf "fps=${FPS},scale=${w}:${h}:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "${out}"`,
    { stdio: "pipe" }
  );
  fs.unlinkSync(tmpList);
}

function buildAllVideos() {
  ensureDir(EXPORTS);
  for (const ratio of Object.keys(RATIOS)) {
    buildMp4(ratio, "long", LONG, `vicious-explainer-long-${ratio}.mp4`);
    buildMp4(ratio, "short", SHORT, `vicious-explainer-short-${ratio}.mp4`);
  }
}

console.log("→ writing SVG frames");
writeFrames();
console.log("→ rasterizing to PNG");
rasterize();
console.log("→ building contact sheet");
buildContactSheet();
console.log("→ rendering MP4 animatics (6 cuts × ratios)");
buildAllVideos();
console.log("✓ done. See deliverables/explainer_video/exports/");
