// Real high-level competitive teams used to seed Opponents per supported game.
// Sourced from active circuits (OWCS for Overwatch, Marvel Rivals Ignition / Championship,
// VCT for Valorant, etc.). Names only — no logos / no fabricated player rosters.

export interface RealOpponent {
  name: string;
  shortName?: string;
  region: string; // e.g. "EMEA", "NA", "APAC", "World"
}

// Overwatch (OWCS / Esports World Cup era).
export const OVERWATCH_REAL_OPPONENTS: RealOpponent[] = [
  { name: "Team Peps", shortName: "PEPS", region: "EMEA" },
  { name: "Twisted Minds", shortName: "TM", region: "EMEA" },
  { name: "Virtus.pro", shortName: "VP", region: "EMEA" },
  { name: "Geekay Esports", shortName: "GK", region: "EMEA" },
  { name: "Al Qadsiah", shortName: "QDS", region: "EMEA" },
  { name: "ENCE", shortName: "ENCE", region: "EMEA" },
  { name: "Karmine Corp", shortName: "KC", region: "EMEA" },
  { name: "Team Falcons", shortName: "FLCN", region: "EMEA" },
  { name: "Toronto Defiant", shortName: "TOR", region: "NA" },
  { name: "NRG Esports", shortName: "NRG", region: "NA" },
  { name: "Spacestation Gaming", shortName: "SSG", region: "NA" },
  { name: "M80", shortName: "M80", region: "NA" },
  { name: "FaZe Clan", shortName: "FAZE", region: "NA" },
  { name: "Crazy Raccoon", shortName: "CR", region: "APAC" },
  { name: "ZETA DIVISION", shortName: "ZETA", region: "APAC" },
  { name: "T1", shortName: "T1", region: "APAC" },
  { name: "Team CC", shortName: "CC", region: "APAC" },
];

// Marvel Rivals (Ignition / Championship Series teams in 2025).
export const MARVEL_RIVALS_REAL_OPPONENTS: RealOpponent[] = [
  { name: "Sentinels", shortName: "SEN", region: "NA" },
  { name: "Luminosity Gaming", shortName: "LG", region: "NA" },
  { name: "NRG Esports", shortName: "NRG", region: "NA" },
  { name: "Cloud9", shortName: "C9", region: "NA" },
  { name: "Team Liquid", shortName: "TL", region: "NA" },
  { name: "100 Thieves", shortName: "100T", region: "NA" },
  { name: "FaZe Clan", shortName: "FAZE", region: "NA" },
  { name: "Karmine Corp", shortName: "KC", region: "EMEA" },
  { name: "Team Falcons", shortName: "FLCN", region: "EMEA" },
  { name: "Twisted Minds", shortName: "TM", region: "EMEA" },
  { name: "Heretics", shortName: "TH", region: "EMEA" },
  { name: "T1", shortName: "T1", region: "APAC" },
  { name: "ZETA DIVISION", shortName: "ZETA", region: "APAC" },
  { name: "Crazy Raccoon", shortName: "CR", region: "APAC" },
  { name: "DRX", shortName: "DRX", region: "APAC" },
];

// Valorant (VCT 2025 partnered teams, well-known names only).
export const VALORANT_REAL_OPPONENTS: RealOpponent[] = [
  { name: "Sentinels", shortName: "SEN", region: "Americas" },
  { name: "100 Thieves", shortName: "100T", region: "Americas" },
  { name: "Cloud9", shortName: "C9", region: "Americas" },
  { name: "NRG Esports", shortName: "NRG", region: "Americas" },
  { name: "Evil Geniuses", shortName: "EG", region: "Americas" },
  { name: "LOUD", shortName: "LOUD", region: "Americas" },
  { name: "MIBR", shortName: "MIBR", region: "Americas" },
  { name: "Fnatic", shortName: "FNC", region: "EMEA" },
  { name: "Team Liquid", shortName: "TL", region: "EMEA" },
  { name: "Team Heretics", shortName: "TH", region: "EMEA" },
  { name: "Karmine Corp", shortName: "KC", region: "EMEA" },
  { name: "FUT Esports", shortName: "FUT", region: "EMEA" },
  { name: "Team Vitality", shortName: "VIT", region: "EMEA" },
  { name: "Paper Rex", shortName: "PRX", region: "Pacific" },
  { name: "DRX", shortName: "DRX", region: "Pacific" },
  { name: "T1", shortName: "T1", region: "Pacific" },
  { name: "Gen.G", shortName: "GENG", region: "Pacific" },
  { name: "ZETA DIVISION", shortName: "ZETA", region: "Pacific" },
  { name: "EDward Gaming", shortName: "EDG", region: "China" },
  { name: "FunPlus Phoenix", shortName: "FPX", region: "China" },
];

// League of Legends (LCS / LEC / LCK / LPL well-known orgs).
export const LEAGUE_OF_LEGENDS_REAL_OPPONENTS: RealOpponent[] = [
  { name: "Cloud9", shortName: "C9", region: "Americas" },
  { name: "Team Liquid", shortName: "TL", region: "Americas" },
  { name: "FlyQuest", shortName: "FLY", region: "Americas" },
  { name: "100 Thieves", shortName: "100T", region: "Americas" },
  { name: "G2 Esports", shortName: "G2", region: "EMEA" },
  { name: "Fnatic", shortName: "FNC", region: "EMEA" },
  { name: "MAD Lions KOI", shortName: "MDK", region: "EMEA" },
  { name: "Karmine Corp", shortName: "KC", region: "EMEA" },
  { name: "T1", shortName: "T1", region: "Korea" },
  { name: "Gen.G", shortName: "GENG", region: "Korea" },
  { name: "DRX", shortName: "DRX", region: "Korea" },
  { name: "Hanwha Life Esports", shortName: "HLE", region: "Korea" },
  { name: "BLG", shortName: "BLG", region: "China" },
  { name: "JD Gaming", shortName: "JDG", region: "China" },
  { name: "Top Esports", shortName: "TES", region: "China" },
];

// CS2 (well-known orgs across regions).
export const COUNTER_STRIKE_2_REAL_OPPONENTS: RealOpponent[] = [
  { name: "FaZe Clan", shortName: "FAZE", region: "EMEA" },
  { name: "G2 Esports", shortName: "G2", region: "EMEA" },
  { name: "Vitality", shortName: "VIT", region: "EMEA" },
  { name: "NAVI", shortName: "NAVI", region: "EMEA" },
  { name: "Spirit", shortName: "SPR", region: "EMEA" },
  { name: "MOUZ", shortName: "MOUZ", region: "EMEA" },
  { name: "Heroic", shortName: "HER", region: "EMEA" },
  { name: "FURIA", shortName: "FUR", region: "Americas" },
  { name: "MIBR", shortName: "MIBR", region: "Americas" },
  { name: "Liquid", shortName: "LIQ", region: "Americas" },
];

// Map game slug -> opponents. Add more as supported_games grow.
export const OPPONENT_SEEDS_BY_GAME_SLUG: Record<string, RealOpponent[]> = {
  "overwatch": OVERWATCH_REAL_OPPONENTS,
  "marvel-rivals": MARVEL_RIVALS_REAL_OPPONENTS,
  "valorant": VALORANT_REAL_OPPONENTS,
  "league-of-legends": LEAGUE_OF_LEGENDS_REAL_OPPONENTS,
  "lol": LEAGUE_OF_LEGENDS_REAL_OPPONENTS,
  "counter-strike-2": COUNTER_STRIKE_2_REAL_OPPONENTS,
  "cs2": COUNTER_STRIKE_2_REAL_OPPONENTS,
  "csgo": COUNTER_STRIKE_2_REAL_OPPONENTS,
};
