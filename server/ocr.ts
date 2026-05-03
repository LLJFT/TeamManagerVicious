import type { Player, Hero, OpponentPlayer, StatField, Map as MapType, Side, OcrParsedCandidate, OcrPlayerRow } from "@shared/schema";

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
 * Decide whether the OCR output looks like a scoreboard at all. We require
 * a minimum amount of textual signal AND at least one strong domain anchor
 * (matched player IGN, matched hero, matched map/side, or a score pattern).
 * Logos, posters, plain UI screenshots and random photos fail this gate
 * because they yield few words and zero domain matches. The result is also
 * stored on the scan so the review UI can surface "low confidence" warnings.
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

  const signals = {
    wordCount, numericTokens, hasScorePattern,
    matchedPlayers, matchedOpponents, matchedHeroes,
    matchedMap, matchedSide, rowCount,
  };

  // Hard rejects. These are the patterns we see for non-scoreboard images:
  // empty OCR (logo / opaque image), almost no text (posters), no numbers
  // at all (text-only graphics).
  if (wordCount < 8) {
    return { isScoreboard: false, confidence: 0, reason: "ocr_too_little_text", signals };
  }
  if (numericTokens < 4) {
    return { isScoreboard: false, confidence: 0.1, reason: "ocr_no_numeric_grid", signals };
  }

  // Domain anchors. We weight them so a single matched IGN + a few numbers
  // is not enough on its own — we want either a score pattern, or two
  // independent domain hits, before we accept.
  const anchorScore =
    (hasScorePattern ? 1.0 : 0) +
    (matchedPlayers >= 2 ? 0.8 : matchedPlayers === 1 ? 0.3 : 0) +
    (matchedOpponents >= 2 ? 0.5 : matchedOpponents === 1 ? 0.2 : 0) +
    (matchedHeroes >= 2 ? 0.7 : matchedHeroes === 1 ? 0.3 : 0) +
    (matchedMap ? 0.4 : 0) +
    (matchedSide ? 0.2 : 0) +
    (rowCount >= 3 ? 0.4 : rowCount >= 2 ? 0.2 : 0);

  // Density boost: scoreboards are number-heavy.
  const numericDensity = wordCount > 0 ? numericTokens / wordCount : 0;
  const densityBoost = Math.min(0.4, numericDensity * 0.8);

  const confidence = Math.min(1, Number((anchorScore * 0.55 + densityBoost).toFixed(2)));

  // Threshold: we require BOTH some confidence AND at least one anchor that
  // is unmistakably scoreboard-shaped (score, ≥2 players matched, ≥2 heroes
  // matched, or matched map name).
  const hasStrongAnchor =
    hasScorePattern || matchedPlayers >= 2 || matchedHeroes >= 2 || matchedMap;
  if (!hasStrongAnchor || confidence < 0.45) {
    return {
      isScoreboard: false,
      confidence,
      reason: !hasStrongAnchor ? "no_scoreboard_anchors" : "low_confidence",
      signals,
    };
  }
  return { isScoreboard: true, confidence, reason: "ok", signals };
}
