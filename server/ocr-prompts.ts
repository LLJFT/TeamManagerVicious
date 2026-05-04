/**
 * Game-specific GPT-4o Vision prompts for the scoreboard OCR review feature.
 *
 * Each prompt instructs the model to extract a strictly-shaped JSON object
 * from a screenshot of the post-game scoreboard. The contract is the same
 * across every game so the route handler can post-process the response
 * uniformly:
 *
 *   {
 *     "ourScore":      number | null,
 *     "opponentScore": number | null,
 *     "map":           string | null,   // human map name, fuzzy-matched server-side
 *     "side":          string | null,   // human side label, fuzzy-matched server-side
 *     "rows": [
 *       {
 *         "name":  string,                  // raw IGN as it appears in the image
 *         "side":  "us" | "opponent" | "unknown",
 *         "stats": { "<stat field name>": "<value>" }
 *       }
 *     ]
 *   }
 *
 * Heroes / champions / agents are EXPLICITLY forbidden — the user picks them
 * manually after import (Part 5 of the OCR fix). Any value the model is not
 * confident about must be returned as null / omitted; the model must NEVER
 * invent values.
 */

const COMMON_RULES = `
General rules (apply to every game):
- Return ONLY valid JSON matching the schema. No prose, no markdown, no code fences.
- "ourScore" is the score of the team labelled "us"; "opponentScore" is the other team's score. If the screenshot doesn't make it clear which side is "us", set both to null and set every row's side to "unknown" — the coach will reassign.
- "map" must be the human-readable map name printed in the screenshot (e.g. "Ascent", "Mirage"). If no map is visible, return null.
- "side" must be the human-readable side / faction label printed in the screenshot (e.g. "Attackers", "Counter-Terrorists", "Order"). If no side is visible, return null.
- For each scoreboard row, "name" must be the player's in-game name EXACTLY as printed (preserve case, suffix tags, special characters).
- Heroes / champions / agents / operators / characters MUST be omitted from every row. Do NOT include them in stats. Do NOT add a "hero" or "agent" or "champion" key. The coach picks them manually after import.
- "stats" keys MUST be drawn from the EXACT list of allowed stat field names provided to you below. If a column you see in the screenshot does not match any allowed name, omit that column. Do not rename, abbreviate, or invent stat field names.
- "stats" values must be strings of digits (e.g. "12", "0", "1500"). Strip commas, percent signs, and any non-numeric suffix. If a value is unreadable, omit the key — never guess.
- If the image is not a scoreboard at all (logo, menu, lobby, victory screen with no per-player numbers), return: { "ourScore": null, "opponentScore": null, "map": null, "side": null, "rows": [] }.
- It is better to return an incomplete row (just a name and one stat) than to invent values.
`.trim();

const GAME_NOTES: Record<string, string> = {
  valorant: `
Game: VALORANT.
- The two teams are typically separated visually with one above the other (Attackers / Defenders, Allies / Enemies, or coloured red vs green).
- Common stat columns: ACS, K, D, A, KAST, ADR, HS%, FK, FD, +/-. Map keys to the allowed list below verbatim if a match exists; otherwise drop them.
- Map names are printed at the top: Ascent, Bind, Haven, Split, Icebox, Breeze, Fracture, Pearl, Lotus, Sunset, Abyss, Corrode.
`,
  cs: `
Game: Counter-Strike (CS2 / CSGO).
- Teams are split as Counter-Terrorists (CT) vs Terrorists (T). The "side" label should be one of: "CT", "Counter-Terrorists", "T", "Terrorists".
- Common stat columns: K, A, D, ADR, KAST, HLTV, +/-, MVP, HS, 2K, 3K, 4K, 5K. Map keys to the allowed list verbatim.
- Map names: Mirage, Inferno, Dust2, Nuke, Overpass, Vertigo, Anubis, Ancient, Train, Cache.
`,
  dota2: `
Game: Dota 2.
- Teams are Radiant vs Dire. Side label: "Radiant" or "Dire".
- Common stat columns: K, D, A, LH, DN, NW, GPM, XPM, HD, HH, TD. Map keys to the allowed list verbatim.
- There is no map name — Dota always plays on the same map. Return "map": null.
`,
  lol: `
Game: League of Legends.
- Teams are Blue Side vs Red Side. Side label: "Blue" or "Red".
- Common stat columns: K, D, A, KDA, CS, CS/M, GOLD, GPM, DMG, DPM, VS, WP, WC. Map keys to the allowed list verbatim.
- There is no map name — LoL always plays on Summoner's Rift. Return "map": null.
`,
  mlbb: `
Game: Mobile Legends: Bang Bang.
- Common stat columns: K, D, A, KDA, GOLD, DMG, DMG TAKEN, TURRET, TEAMFIGHT %, MVP. Map keys to the allowed list verbatim.
- There is no per-match map name in MLBB. Return "map": null.
`,
  overwatch: `
Game: Overwatch 2.
- Teams are Attack vs Defend (or Team 1 vs Team 2 on control / push). Side label: "Attack" or "Defend".
- Common stat columns: E (Eliminations), A (Assists), D (Deaths), DMG, HEAL, MIT (Mitigation). Map keys to the allowed list verbatim.
- Map names: Hanamura, King's Row, Numbani, Hollywood, Eichenwalde, Blizzard World, Ilios, Lijiang, Nepal, Oasis, Busan, Dorado, Watchpoint, Junkertown, Rialto, Havana, Circuit Royal, Esperança, Suravasa, Antarctic Peninsula, Colosseo, New Queen Street, Midtown, Paraíso.
`,
  r6: `
Game: Rainbow Six Siege.
- Teams are Attackers vs Defenders. Side label: "Attack" or "Defend".
- Common stat columns: K, D, A, KOST, +/-, OBJ, PLANT, DISABLE, HS%. Map keys to the allowed list verbatim.
- Map names: Bank, Border, Chalet, Clubhouse, Coastline, Consulate, Kafe, Oregon, Skyscraper, Theme Park, Villa, Kanal, Lair, Stadium.
`,
  apex: `
Game: Apex Legends.
- Squads of three. Side label is usually irrelevant; return null unless an explicit team label is shown.
- Common stat columns: K, A, DMG, REVIVES, RESPAWNS, PLACEMENT. Map keys to the allowed list verbatim.
- Map names: Kings Canyon, World's Edge, Olympus, Storm Point, Broken Moon, E-District.
`,
  "marvel-rivals": `
Game: Marvel Rivals.
- Teams are Attackers vs Defenders on Convoy / Domination, or just Team 1 vs Team 2 on Convergence. Side label: "Attack", "Defend", or null.
- Common stat columns: K (Final Hits / Eliminations), D (Deaths), A (Assists), DMG, HEAL, BLOCKED. Map keys to the allowed list verbatim.
- Map names: Tokyo 2099, Yggsgard, Klyntar, Hellfire Gala, Empire of Eternal Night, Spider-Islands.
`,
  "rocket-league": `
Game: Rocket League.
- Teams are Blue vs Orange. Side label: "Blue" or "Orange".
- Common stat columns: GOALS, ASSISTS, SAVES, SHOTS, SCORE, DEMOS. Map keys to the allowed list verbatim.
- Map names: DFH Stadium, Mannfield, Champions Field, Beckwith Park, Utopia Coliseum, Wasteland, Aquadome.
`,
};

function genericNotes(slug: string | null): string {
  return `
Game: ${slug || "unknown"}.
- Treat each row of per-player numbers as one row in the output.
- Pick whichever team is shown on top as "us" if no other signal exists; otherwise mark every row "unknown".
- "side" should mirror whatever faction / colour / role label the screenshot shows for the "us" team, or null if not shown.
`.trim();
}

/**
 * Build the system prompt for a given game slug. The list of allowed stat
 * field names is injected so the model can only return keys the team has
 * actually configured.
 */
export function buildVisionPrompt(opts: {
  gameSlug: string | null;
  allowedStatFieldNames: string[];
  allowedMapNames: string[];
  allowedSideNames: string[];
}): string {
  const { gameSlug, allowedStatFieldNames, allowedMapNames, allowedSideNames } = opts;
  const gameSection = (gameSlug && GAME_NOTES[gameSlug]) || genericNotes(gameSlug);

  const allowedStatBlock = allowedStatFieldNames.length
    ? `Allowed stat field names (use these EXACT keys, case-sensitive, in "stats"):\n${allowedStatFieldNames.map((n) => `  - ${n}`).join("\n")}`
    : `Allowed stat field names: (none configured — return rows with empty "stats" objects)`;

  const allowedMapBlock = allowedMapNames.length
    ? `Configured map names for this team (the "map" field should match one of these where possible):\n${allowedMapNames.map((n) => `  - ${n}`).join("\n")}`
    : `Configured map names: (none — return whatever the screenshot says)`;

  const allowedSideBlock = allowedSideNames.length
    ? `Configured side labels for this team (the "side" field should match one of these where possible):\n${allowedSideNames.map((n) => `  - ${n}`).join("\n")}`
    : `Configured side labels: (none — return whatever the screenshot says)`;

  return [
    `You are a strict scoreboard data extractor for an esports analytics platform. You receive a screenshot of a post-game scoreboard and must return a single JSON object with the schema described below.`,
    "",
    `JSON schema:`,
    `{`,
    `  "ourScore": number | null,`,
    `  "opponentScore": number | null,`,
    `  "map": string | null,`,
    `  "side": string | null,`,
    `  "rows": [ { "name": string, "side": "us" | "opponent" | "unknown", "stats": { "<allowed stat name>": "<digits>" } } ]`,
    `}`,
    "",
    COMMON_RULES,
    "",
    gameSection.trim(),
    "",
    allowedStatBlock,
    "",
    allowedMapBlock,
    "",
    allowedSideBlock,
  ].join("\n");
}

export const VISION_USER_INSTRUCTION =
  "Extract the scoreboard data from this image. Respond with ONLY the JSON object — no prose, no markdown.";
