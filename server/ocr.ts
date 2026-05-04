import type { Player, Hero, OpponentPlayer, StatField, Map as MapType, Side, OcrParsedCandidate, OcrPlayerRow } from "@shared/schema";
import { buildVisionPrompt, VISION_USER_INSTRUCTION } from "./ocr-prompts";

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

export function fuzzyMatch<T extends { id: string; name: string }>(
  raw: string,
  candidates: T[],
  threshold = 0.6,
): { match: T | null; score: number } {
  let best: T | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const s = similarity(raw, c.name);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return { match: bestScore >= threshold ? best : null, score: bestScore };
}

export interface OcrInputs {
  players: Player[];
  opponentPlayers: OpponentPlayer[];
  heroes: Hero[];
  statFields: StatField[];
  maps: MapType[];
  sides: Side[];
}

/**
 * Parse raw OCR text into a candidate scoreboard. The heuristic walks lines,
 * skipping headers and blanks. A line that contains a recognizable IGN +
 * numeric tokens is treated as a player row. The first half of recognized
 * rows are mapped to "us"; the rest to "opponent" (a typical scoreboard has
 * the user's team on top). Coaches can flip rows on the review screen.
 */
export function parseScoreboardText(rawText: string, inputs: OcrInputs): OcrParsedCandidate {
  const text = rawText || "";
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // Try to find scores: e.g. "3 - 2", "3:2", "3 vs 2"
  let ourScore: number | null = null;
  let opponentScore: number | null = null;
  for (const line of lines) {
    const m = line.match(/(\d{1,2})\s*[-:vs/]+\s*(\d{1,2})/i);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (a <= 50 && b <= 50) {
        ourScore = a;
        opponentScore = b;
        break;
      }
    }
  }

  // Try to find a map name on its own line.
  let rawMap: string | null = null;
  let matchedMapId: string | null = null;
  for (const line of lines.slice(0, 6)) {
    const { match, score } = fuzzyMatch(line, inputs.maps, 0.7);
    if (match && score > 0.7) {
      rawMap = line;
      matchedMapId = match.id;
      break;
    }
  }

  // Try to find a side label.
  let rawSide: string | null = null;
  let matchedSideId: string | null = null;
  for (const line of lines.slice(0, 8)) {
    const { match, score } = fuzzyMatch(line, inputs.sides, 0.75);
    if (match && score > 0.75) {
      rawSide = line;
      matchedSideId = match.id;
      break;
    }
  }

  // Identify candidate player rows by scanning each line and trying to
  // match its leftmost token against player/opponent IGNs and any later
  // token against heroes. Numeric tokens become positional stats.
  const rows: OcrPlayerRow[] = [];
  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;

    // Try to find player IGN match somewhere in the first 2 tokens.
    let nameToken: string | null = null;
    let matchedPlayerId: string | null = null;
    let matchedOpponentPlayerId: string | null = null;
    let nameIdx = -1;
    for (let i = 0; i < Math.min(2, tokens.length); i++) {
      const tk = tokens[i];
      if (/^\d+$/.test(tk)) continue;
      const our = fuzzyMatch(tk, inputs.players, 0.6);
      const opp = fuzzyMatch(tk, inputs.opponentPlayers as any, 0.6);
      if (our.match && our.score >= opp.score) {
        nameToken = tk;
        matchedPlayerId = our.match.id;
        nameIdx = i;
        break;
      } else if (opp.match) {
        nameToken = tk;
        matchedOpponentPlayerId = opp.match.id;
        nameIdx = i;
        break;
      }
    }

    // Fall back: treat the first non-numeric token as a name candidate.
    if (!nameToken) {
      for (let i = 0; i < tokens.length; i++) {
        if (!/^\d+$/.test(tokens[i]) && tokens[i].length >= 2) {
          nameToken = tokens[i];
          nameIdx = i;
          break;
        }
      }
    }
    if (!nameToken) continue;

    // Find a hero match anywhere after the name token.
    let rawHero: string | null = null;
    let matchedHeroId: string | null = null;
    for (let i = nameIdx + 1; i < tokens.length; i++) {
      const tk = tokens[i];
      if (/^\d+$/.test(tk)) continue;
      const { match, score } = fuzzyMatch(tk, inputs.heroes, 0.65);
      if (match && score >= 0.65) {
        rawHero = tk;
        matchedHeroId = match.id;
        break;
      }
    }

    // Collect numeric tokens to map onto stat fields by order. The review
    // pane lets the user remap, so we just preserve order here.
    const nums = tokens.filter((t) => /^-?\d+$/.test(t)).map((t) => t);
    const stats: Record<string, string> = {};
    inputs.statFields.forEach((sf, i) => {
      if (i < nums.length) stats[sf.id] = nums[i];
    });

    // Skip lines that look like a header noise: only one numeric token and
    // no hero/player match.
    if (!matchedPlayerId && !matchedOpponentPlayerId && !matchedHeroId && nums.length < 2) {
      continue;
    }

    // Per-row confidence: average of name + hero match scores. A row whose
    // player and hero were both fuzzy-matched scores ~1.0; an unmatched row
    // (header noise that survived the filter) scores low and gets badged in
    // the review UI so coaches know to look harder.
    let nameScore = 0;
    if (matchedPlayerId) nameScore = fuzzyMatch(nameToken, inputs.players, 0.6).score;
    else if (matchedOpponentPlayerId) nameScore = fuzzyMatch(nameToken, inputs.opponentPlayers as any, 0.6).score;
    const heroScore = matchedHeroId && rawHero ? fuzzyMatch(rawHero, inputs.heroes, 0.65).score : 0;
    const denom = (matchedPlayerId || matchedOpponentPlayerId ? 1 : 0) + (matchedHeroId ? 1 : 0);
    const confidence = denom === 0 ? 0 : Number(((nameScore + heroScore) / denom).toFixed(2));

    // Side assignment is EXTRACT-FIRST / MAP-LATER: only commit a side
    // when we actually matched the IGN against our roster or against an
    // opponent player. Unmatched rows are parked as "unknown" so the
    // review UI can prompt the coach to assign them manually instead of
    // us guessing wrong (the previous half-split heuristic mis-labelled
    // our players as opponents and silently dropped their stats on
    // confirm).
    const detectedSide: "us" | "opponent" | "unknown" =
      matchedPlayerId ? "us" : matchedOpponentPlayerId ? "opponent" : "unknown";

    rows.push({
      rawName: nameToken,
      matchedPlayerId,
      matchedOpponentPlayerId,
      rawHero,
      matchedHeroId,
      side: detectedSide,
      stats,
      confidence,
    });
  }

  return {
    ourScore,
    opponentScore,
    rawMap,
    matchedMapId,
    rawSide,
    matchedSideId,
    rows,
  };
}

/**
 * Run Tesseract.js on an image buffer and return the extracted text plus
 * the structured words array. Tesseract.js downloads models on first use,
 * so we lazy-load and cache the worker per process.
 */
let workerPromise: Promise<any> | null = null;
async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const tess: any = await import("tesseract.js");
      const worker = await tess.createWorker("eng");
      return worker;
    })();
  }
  return workerPromise;
}

export async function runOcr(buffer: Buffer): Promise<{ text: string; words: any[] }> {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(buffer);
    return { text: data.text || "", words: data.words || [] };
  } catch (err: any) {
    console.error("[ocr] Tesseract failed:", err?.message || err);
    return { text: "", words: [] };
  }
}

export interface ScoreboardSignal {
  isScoreboard: boolean;
  confidence: number; // 0..1
  reason: string;
  // True when the image was accepted but signal is incomplete (cropped
  // scoreboard, missing columns, low resolution, partial OCR). The scan is
  // still saved — the review UI surfaces a banner explaining the blanks.
  partial: boolean;
  signals: {
    wordCount: number;
    numericTokens: number;
    hasScorePattern: boolean;
    matchedPlayers: number;
    matchedOpponents: number;
    matchedHeroes: number;
    matchedMap: boolean;
    matchedSide: boolean;
    rowCount: number;
  };
}

/**
 * Decide whether the OCR output looks like a scoreboard. The contract is
 * EXTRACT-WHAT-EXISTS / NEVER-INVENT:
 *
 *   - Hard reject ONLY when the image clearly isn't a scoreboard at all
 *     (empty OCR, no numbers anywhere, zero domain anchors). This catches
 *     logos, posters, and random photos.
 *   - Otherwise accept the scan even if it's incomplete (cropped, low-res,
 *     missing stat columns, only one row visible) and flag `partial=true`
 *     so the review UI shows a soft banner. Missing fields stay blank for
 *     the coach to fill in manually — we never invent values.
 */
export function evaluateScoreboardSignal(
  rawText: string,
  parsed: OcrParsedCandidate,
  inputs: OcrInputs,
): ScoreboardSignal {
  const text = rawText || "";
  const tokens = text.split(/\s+/).filter(Boolean);
  const wordCount = tokens.length;
  const numericTokens = tokens.filter((t) => /^-?\d+$/.test(t)).length;
  const hasScorePattern = typeof parsed.ourScore === "number" && typeof parsed.opponentScore === "number";
  const matchedPlayers = parsed.rows.filter((r) => r.matchedPlayerId).length;
  const matchedOpponents = parsed.rows.filter((r) => r.matchedOpponentPlayerId).length;
  const matchedHeroes = parsed.rows.filter((r) => r.matchedHeroId).length;
  const matchedMap = !!parsed.matchedMapId;
  const matchedSide = !!parsed.matchedSideId;
  const rowCount = parsed.rows.length;
  const totalAnchors =
    (hasScorePattern ? 1 : 0) + matchedPlayers + matchedOpponents +
    matchedHeroes + (matchedMap ? 1 : 0) + (matchedSide ? 1 : 0);

  const signals = {
    wordCount, numericTokens, hasScorePattern,
    matchedPlayers, matchedOpponents, matchedHeroes,
    matchedMap, matchedSide, rowCount,
  };

  // Hard reject only when the image has essentially no scoreboard signal.
  // This is intentionally permissive — partial / cropped / low-res
  // scoreboards still pass and are flagged `partial=true`.
  if (wordCount < 3) {
    return { isScoreboard: false, confidence: 0, reason: "ocr_no_text", partial: false, signals };
  }
  if (numericTokens === 0 && rowCount === 0 && totalAnchors === 0) {
    return { isScoreboard: false, confidence: 0, reason: "no_scoreboard_signal", partial: false, signals };
  }

  // Soft confidence score (informational only — does not gate acceptance).
  const anchorScore =
    (hasScorePattern ? 1.0 : 0) +
    (matchedPlayers >= 2 ? 0.8 : matchedPlayers === 1 ? 0.3 : 0) +
    (matchedOpponents >= 2 ? 0.5 : matchedOpponents === 1 ? 0.2 : 0) +
    (matchedHeroes >= 2 ? 0.7 : matchedHeroes === 1 ? 0.3 : 0) +
    (matchedMap ? 0.4 : 0) +
    (matchedSide ? 0.2 : 0) +
    (rowCount >= 3 ? 0.4 : rowCount >= 2 ? 0.2 : 0);
  const numericDensity = wordCount > 0 ? numericTokens / wordCount : 0;
  const densityBoost = Math.min(0.4, numericDensity * 0.8);
  const confidence = Math.min(1, Number((anchorScore * 0.55 + densityBoost).toFixed(2)));

  // Anything with at least one row OR one strong anchor is treated as a
  // scoreboard. Below the old 0.45 threshold we mark it partial so the
  // review UI prompts the coach to verify, but the scan still saves and
  // every visible field is preserved.
  const looksLikeScoreboard = rowCount >= 1 || totalAnchors >= 1;
  if (!looksLikeScoreboard) {
    return { isScoreboard: false, confidence, reason: "no_scoreboard_signal", partial: false, signals };
  }
  // Heroes are manual-only post-Vision (Part 5 of the OCR fix), so we no
  // longer require matched heroes to call a scan "complete". A scoreboard
  // is partial when overall confidence is low, very few rows were
  // recovered, or fewer than 2 players matched on either side.
  const partial =
    confidence < 0.55 ||
    rowCount < 2 ||
    (matchedPlayers + matchedOpponents) < 2;
  return {
    isScoreboard: true,
    confidence,
    reason: partial ? "partial_extraction" : "ok",
    partial,
    signals,
  };
}

// ---------------------------------------------------------------------------
// GPT-4o Vision-based scoreboard extraction.
// ---------------------------------------------------------------------------
// Replaces Tesseract as the PRIMARY engine. Tesseract above is kept as a
// fallback for when OPENAI_API_KEY is missing or the API call throws. The
// model is asked to return a strict JSON object (see ocr-prompts.ts) which
// we then post-process by fuzzy-matching IGNs against the configured roster
// / opponent / map / side lists. Heroes are NEVER returned by the model and
// always end up null — coaches pick heroes manually after import.

const FUZZY_HIGH = 0.7;   // >=0.7 → commit (clean auto-match)
const FUZZY_MED = 0.5;    // 0.5..0.7 → tentative; commit but flag medium
                          // <0.5    → leave null

interface VisionRawRow {
  name?: string;
  side?: "us" | "opponent" | "unknown" | string;
  stats?: Record<string, string | number>;
}
interface VisionRawResponse {
  ourScore?: number | null;
  opponentScore?: number | null;
  map?: string | null;
  side?: string | null;
  rows?: VisionRawRow[];
}

function fuzzyMatchByName<T extends { id: string; name: string }>(
  raw: string,
  candidates: T[],
): { match: T | null; score: number } {
  let best: T | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const s = similarity(raw, c.name);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return { match: best, score: bestScore };
}

/**
 * Map raw stat keys returned by GPT-4o (which were instructed to use the
 * exact configured stat field names) onto stat field IDs. We do an exact
 * case-insensitive match first, then fall back to fuzzy match >= 0.7.
 */
function mapStatsToFieldIds(
  rawStats: Record<string, string | number> | undefined,
  statFields: StatField[],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!rawStats) return out;
  const lowerIndex = new Map(statFields.map((sf) => [sf.name.toLowerCase().trim(), sf]));
  for (const [key, value] of Object.entries(rawStats)) {
    if (value === null || value === undefined || value === "") continue;
    const normalizedValue = String(value).replace(/[^\d.\-]/g, "");
    if (!normalizedValue) continue;
    const exact = lowerIndex.get(key.toLowerCase().trim());
    if (exact) {
      out[exact.id] = normalizedValue;
      continue;
    }
    const { match, score } = fuzzyMatchByName(key, statFields);
    if (match && score >= FUZZY_HIGH) {
      out[match.id] = normalizedValue;
    }
  }
  return out;
}

/**
 * Call OpenAI's gpt-4o Vision endpoint with the supplied scoreboard image
 * and a game-specific extraction prompt. Throws if the API key is missing
 * or the call fails — the caller is expected to catch and fall back to
 * Tesseract so the user still gets a (lower-quality) result.
 */
async function callVisionApi(opts: {
  buffer: Buffer;
  mime: string;
  systemPrompt: string;
}): Promise<{ raw: string; parsed: VisionRawResponse }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const b64 = opts.buffer.toString("base64");
  const dataUrl = `data:${opts.mime || "image/png"};base64,${b64}`;

  const body = {
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 2048,
    messages: [
      { role: "system", content: opts.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: VISION_USER_INSTRUCTION },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI Vision API error ${res.status}: ${errText.slice(0, 500)}`);
  }
  const json: any = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content || "";
  if (!raw) throw new Error("OpenAI Vision returned empty content");
  let parsed: VisionRawResponse;
  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    // Some responses still wrap JSON in ```json fences despite response_format.
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    parsed = JSON.parse(stripped);
  }
  return { raw, parsed };
}

/**
 * Run GPT-4o Vision on a scoreboard image and post-process its response into
 * the same OcrParsedCandidate shape Tesseract produces, so the rest of the
 * upload + review pipeline is unchanged.
 */
export async function runVisionOcr(opts: {
  buffer: Buffer;
  mime: string;
  gameSlug: string | null;
  inputs: OcrInputs;
}): Promise<{ parsed: OcrParsedCandidate; raw: string }> {
  const { buffer, mime, gameSlug, inputs } = opts;
  const systemPrompt = buildVisionPrompt({
    gameSlug,
    allowedStatFieldNames: inputs.statFields.map((sf) => sf.name),
    allowedMapNames: inputs.maps.map((m) => m.name),
    allowedSideNames: inputs.sides.map((s) => s.name),
  });
  const { raw, parsed: vision } = await callVisionApi({ buffer, mime, systemPrompt });

  // ----- map / side fuzzy match -----
  let matchedMapId: string | null = null;
  let rawMap: string | null = vision.map ?? null;
  if (vision.map) {
    const m = fuzzyMatchByName(vision.map, inputs.maps);
    if (m.match && m.score >= FUZZY_HIGH) matchedMapId = m.match.id;
    else if (m.match && m.score >= FUZZY_MED) matchedMapId = m.match.id;
  }
  let matchedSideId: string | null = null;
  let rawSide: string | null = vision.side ?? null;
  if (vision.side) {
    const s = fuzzyMatchByName(vision.side, inputs.sides);
    if (s.match && s.score >= FUZZY_MED) matchedSideId = s.match.id;
  }

  // ----- per-row name + stats -----
  const rows: OcrPlayerRow[] = [];
  for (const r of vision.rows || []) {
    if (!r?.name) continue;
    const reportedSide: "us" | "opponent" | "unknown" =
      r.side === "us" || r.side === "opponent" ? r.side : "unknown";

    // Scope candidates to whichever side the model reported. If unknown,
    // try both and take the higher-scoring match (this also catches model
    // mistakes where it labelled an opponent player as ours).
    let matchedPlayerId: string | null = null;
    let matchedOpponentPlayerId: string | null = null;
    let nameScore = 0;
    let finalSide: "us" | "opponent" | "unknown" = reportedSide;

    const ourMatch = fuzzyMatchByName(r.name, inputs.players);
    const oppMatch = fuzzyMatchByName(r.name, inputs.opponentPlayers as any);

    if (reportedSide === "us") {
      if (ourMatch.match && ourMatch.score >= FUZZY_MED) {
        matchedPlayerId = ourMatch.match.id;
        nameScore = ourMatch.score;
      } else if (oppMatch.match && oppMatch.score >= FUZZY_HIGH && oppMatch.score > ourMatch.score + 0.15) {
        // Strong opponent match against a "us" label → trust the data, flip side.
        matchedOpponentPlayerId = oppMatch.match.id;
        nameScore = oppMatch.score;
        finalSide = "opponent";
      }
    } else if (reportedSide === "opponent") {
      if (oppMatch.match && oppMatch.score >= FUZZY_MED) {
        matchedOpponentPlayerId = oppMatch.match.id;
        nameScore = oppMatch.score;
      } else if (ourMatch.match && ourMatch.score >= FUZZY_HIGH && ourMatch.score > oppMatch.score + 0.15) {
        matchedPlayerId = ourMatch.match.id;
        nameScore = ourMatch.score;
        finalSide = "us";
      }
    } else {
      // unknown: take whichever side has the higher-scoring fuzzy match.
      if (ourMatch.score >= oppMatch.score && ourMatch.match && ourMatch.score >= FUZZY_MED) {
        matchedPlayerId = ourMatch.match.id;
        nameScore = ourMatch.score;
        finalSide = "us";
      } else if (oppMatch.match && oppMatch.score >= FUZZY_MED) {
        matchedOpponentPlayerId = oppMatch.match.id;
        nameScore = oppMatch.score;
        finalSide = "opponent";
      }
    }

    const stats = mapStatsToFieldIds(r.stats, inputs.statFields);

    rows.push({
      rawName: r.name,
      matchedPlayerId,
      matchedOpponentPlayerId,
      // Heroes are MANUAL-ONLY per Part 5 of the OCR fix.
      rawHero: null,
      matchedHeroId: null,
      side: finalSide,
      stats,
      confidence: Number(nameScore.toFixed(2)),
    });
  }

  return {
    parsed: {
      ourScore: typeof vision.ourScore === "number" ? vision.ourScore : null,
      opponentScore: typeof vision.opponentScore === "number" ? vision.opponentScore : null,
      rawMap,
      matchedMapId,
      rawSide,
      matchedSideId,
      rows,
    },
    raw,
  };
}

export const VISION_THRESHOLDS = { FUZZY_HIGH, FUZZY_MED };
