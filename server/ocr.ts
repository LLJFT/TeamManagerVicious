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

    rows.push({
      rawName: nameToken,
      matchedPlayerId,
      matchedOpponentPlayerId,
      rawHero,
      matchedHeroId,
      side: matchedPlayerId ? "us" : matchedOpponentPlayerId ? "opponent" : "us",
      stats,
    });
  }

  // If we couldn't classify any opponent rows, split the rows in half so
  // the reviewer at least sees both sides populated.
  const ourCount = rows.filter((r) => r.side === "us").length;
  const oppCount = rows.filter((r) => r.side === "opponent").length;
  if (rows.length >= 2 && (ourCount === 0 || oppCount === 0)) {
    const half = Math.ceil(rows.length / 2);
    rows.forEach((r, i) => {
      r.side = i < half ? "us" : "opponent";
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
