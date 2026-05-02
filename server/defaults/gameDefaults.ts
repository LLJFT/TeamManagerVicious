// ============================================================================
// Per-game default datasets used when seeding a brand-new roster that has no
// matching Game Template. Every roster created through the platform must end
// up with a complete, immediately-usable configuration; these defaults provide
// that for games that don't yet have a curated Game Template.
//
// Shape:
//   - rosterRoles: positions players can hold (player + staff types)
//   - heroRoles:   role names for the heroes/agents pool (idempotent into
//                  team-shared `hero_role_configs`)
//   - sides:       round sides (Attack/Defense, Blue/Red, etc.)
//   - eventCategories: event_categories rows + their event_sub_types children
//   - gameModes:   { name, statFields: string[], maps: string[] } — drives
//                  game_modes + maps + stat_fields together so the relations
//                  are coherent
//   - heroBanSystem / mapVetoSystem: ONE simple preset each, or null when the
//                  game doesn't need them
//   - defaultPlayersPerOpponent: how many template-style opponent players to
//                  generate per opponent (default 5)
// ============================================================================

import {
  OVERWATCH_DEFAULT_HEROES,
  OVERWATCH_DEFAULT_ROLES,
  type DefaultHero,
} from "./overwatchHeroes";
import { MARVEL_RIVALS_DEFAULT_HEROES } from "./marvelRivalsHeroes";
import { MARVEL_RIVALS_DEFAULT_ROLES } from "@shared/schema";

export interface DefaultRosterRole {
  name: string;
  type: "player" | "staff";
  sortOrder: number;
}

export interface DefaultEventCategory {
  name: string;
  color: string;
  subs: string[];
}

export interface DefaultGameMode {
  name: string;
  statFields: string[];
  maps: string[];
}

export interface DefaultHeroBanSystem {
  name: string;
  mode: string;
  bansPerTeam: number;
}

export interface DefaultMapVetoSystem {
  name: string;
  defaultRowCount: number;
}

export interface GameDefaults {
  rosterRoles: DefaultRosterRole[];
  heroRoles: string[];
  sides: string[];
  eventCategories: DefaultEventCategory[];
  gameModes: DefaultGameMode[];
  heroes: DefaultHero[]; // game-specific heroes (Overwatch / Marvel Rivals); empty for others
  heroBanSystem: DefaultHeroBanSystem | null;
  mapVetoSystem: DefaultMapVetoSystem | null;
  defaultPlayersPerOpponent: number;
}

const STAFF_ROLES: DefaultRosterRole[] = [
  { name: "Head Coach", type: "staff", sortOrder: 100 },
  { name: "Assistant Coach", type: "staff", sortOrder: 101 },
  { name: "Analyst", type: "staff", sortOrder: 102 },
  { name: "Manager", type: "staff", sortOrder: 103 },
];

const COMMON_EVENT_CATEGORIES: DefaultEventCategory[] = [
  { name: "Scrim", color: "#3b82f6", subs: ["Practice", "Warm-up"] },
  { name: "Tournament", color: "#ef4444", subs: ["Stage 1", "Saudi League", "Elite 3000$ Cup"] },
  { name: "Meetings", color: "#a855f7", subs: ["Vod Review", "Roster Meeting", "Organization Meeting"] },
];

// ── Per-game registry ────────────────────────────────────────────────────────

const VALORANT_DEFAULTS: GameDefaults = {
  rosterRoles: [
    { name: "Duelist", type: "player", sortOrder: 0 },
    { name: "Initiator", type: "player", sortOrder: 1 },
    { name: "Controller", type: "player", sortOrder: 2 },
    { name: "Sentinel", type: "player", sortOrder: 3 },
    { name: "Flex", type: "player", sortOrder: 4 },
    ...STAFF_ROLES,
  ],
  heroRoles: ["Duelist", "Initiator", "Controller", "Sentinel"],
  sides: ["Attack", "Defense"],
  eventCategories: COMMON_EVENT_CATEGORIES,
  gameModes: [
    {
      name: "Standard",
      statFields: ["Kill", "Death", "Assist", "ACS", "First Bloods", "Plants", "Defuses"],
      maps: ["Ascent", "Bind", "Haven", "Lotus", "Pearl", "Split", "Sunset", "Abyss"],
    },
  ],
  heroes: [],
  heroBanSystem: { name: "Standard Agent Ban", mode: "simple", bansPerTeam: 0 },
  mapVetoSystem: { name: "BO3 Map Veto", defaultRowCount: 7 },
  defaultPlayersPerOpponent: 5,
};

const OVERWATCH_DEFAULTS: GameDefaults = {
  rosterRoles: [
    { name: "Tank", type: "player", sortOrder: 0 },
    { name: "Damage", type: "player", sortOrder: 1 },
    { name: "Support", type: "player", sortOrder: 2 },
    { name: "Flex", type: "player", sortOrder: 3 },
    ...STAFF_ROLES,
  ],
  heroRoles: [...OVERWATCH_DEFAULT_ROLES],
  sides: ["Attack", "Defense"],
  eventCategories: COMMON_EVENT_CATEGORIES,
  gameModes: [
    {
      name: "Hybrid",
      statFields: ["Eliminations", "Deaths", "Assists", "Damage", "Healing"],
      maps: ["King's Row", "Eichenwalde", "Hollywood", "Numbani", "Midtown"],
    },
    {
      name: "Escort",
      statFields: ["Eliminations", "Deaths", "Assists", "Damage", "Healing"],
      maps: ["Dorado", "Havana", "Junkertown", "Rialto", "Watchpoint: Gibraltar"],
    },
    {
      name: "Control",
      statFields: ["Eliminations", "Deaths", "Assists", "Damage", "Healing"],
      maps: ["Busan", "Ilios", "Lijiang Tower", "Nepal", "Oasis"],
    },
    {
      name: "Push",
      statFields: ["Eliminations", "Deaths", "Assists", "Damage", "Healing"],
      maps: ["Colosseo", "Esperança", "New Queen Street", "Runasapi"],
    },
  ],
  heroes: OVERWATCH_DEFAULT_HEROES,
  heroBanSystem: { name: "Standard Hero Ban", mode: "simple", bansPerTeam: 2 },
  mapVetoSystem: { name: "BO5 Map Veto", defaultRowCount: 9 },
  defaultPlayersPerOpponent: 5,
};

const MARVEL_RIVALS_DEFAULTS: GameDefaults = {
  rosterRoles: [
    { name: "Vanguard", type: "player", sortOrder: 0 },
    { name: "Duelist", type: "player", sortOrder: 1 },
    { name: "Strategist", type: "player", sortOrder: 2 },
    { name: "Flex", type: "player", sortOrder: 3 },
    ...STAFF_ROLES,
  ],
  heroRoles: [...MARVEL_RIVALS_DEFAULT_ROLES],
  sides: ["Attack", "Defense"],
  eventCategories: COMMON_EVENT_CATEGORIES,
  gameModes: [
    {
      name: "Convoy",
      statFields: ["Eliminations", "Deaths", "Assists", "Damage", "Healing"],
      maps: ["Yggsgard: Royal Palace", "Tokyo 2099: Spider-Islands", "Klyntar: Symbiotic Surface"],
    },
    {
      name: "Convergence",
      statFields: ["Eliminations", "Deaths", "Assists", "Damage", "Healing"],
      maps: ["Yggsgard: Yggdrasill Path", "Hellfire Gala: Krakoa", "Tokyo 2099: Shin-Shibuya"],
    },
    {
      name: "Domination",
      statFields: ["Eliminations", "Deaths", "Assists", "Damage", "Healing"],
      maps: ["Hydra Charteris Base: Hell's Heaven", "Intergalactic Empire of Wakanda: Birnin T'Challa"],
    },
  ],
  heroes: MARVEL_RIVALS_DEFAULT_HEROES,
  heroBanSystem: { name: "Standard Hero Ban", mode: "simple", bansPerTeam: 2 },
  mapVetoSystem: { name: "BO5 Map Veto", defaultRowCount: 9 },
  defaultPlayersPerOpponent: 6,
};

const LOL_DEFAULTS: GameDefaults = {
  rosterRoles: [
    { name: "Top", type: "player", sortOrder: 0 },
    { name: "Jungle", type: "player", sortOrder: 1 },
    { name: "Mid", type: "player", sortOrder: 2 },
    { name: "ADC", type: "player", sortOrder: 3 },
    { name: "Support", type: "player", sortOrder: 4 },
    ...STAFF_ROLES,
  ],
  heroRoles: ["Top", "Jungle", "Mid", "ADC", "Support"],
  sides: ["Blue", "Red"],
  eventCategories: COMMON_EVENT_CATEGORIES,
  gameModes: [
    {
      name: "Summoner's Rift",
      statFields: ["Kills", "Deaths", "Assists", "CS", "Gold", "Vision Score"],
      maps: ["Summoner's Rift"],
    },
  ],
  heroes: [],
  heroBanSystem: { name: "Standard Champion Ban", mode: "simple", bansPerTeam: 5 },
  mapVetoSystem: null,
  defaultPlayersPerOpponent: 5,
};

const CS2_DEFAULTS: GameDefaults = {
  rosterRoles: [
    { name: "IGL", type: "player", sortOrder: 0 },
    { name: "AWPer", type: "player", sortOrder: 1 },
    { name: "Entry Fragger", type: "player", sortOrder: 2 },
    { name: "Support", type: "player", sortOrder: 3 },
    { name: "Lurker", type: "player", sortOrder: 4 },
    ...STAFF_ROLES,
  ],
  heroRoles: [],
  sides: ["CT", "T"],
  eventCategories: COMMON_EVENT_CATEGORIES,
  gameModes: [
    {
      name: "Competitive",
      statFields: ["Kills", "Deaths", "Assists", "ADR", "HS%", "Plants", "Defuses"],
      maps: ["Mirage", "Inferno", "Nuke", "Overpass", "Vertigo", "Anubis", "Ancient", "Dust2"],
    },
  ],
  heroes: [],
  heroBanSystem: null,
  mapVetoSystem: { name: "BO3 Map Veto", defaultRowCount: 7 },
  defaultPlayersPerOpponent: 5,
};

// Generic fallback for any game slug we don't have curated defaults for.
const GENERIC_DEFAULTS: GameDefaults = {
  rosterRoles: [
    { name: "Player 1", type: "player", sortOrder: 0 },
    { name: "Player 2", type: "player", sortOrder: 1 },
    { name: "Player 3", type: "player", sortOrder: 2 },
    { name: "Player 4", type: "player", sortOrder: 3 },
    { name: "Player 5", type: "player", sortOrder: 4 },
    ...STAFF_ROLES,
  ],
  heroRoles: [],
  sides: ["Side A", "Side B"],
  eventCategories: COMMON_EVENT_CATEGORIES,
  gameModes: [
    {
      name: "Standard",
      statFields: ["Kill", "Death", "Assist"],
      maps: ["Map 1", "Map 2", "Map 3", "Map 4", "Map 5"],
    },
  ],
  heroes: [],
  heroBanSystem: null,
  mapVetoSystem: { name: "Standard Map Veto", defaultRowCount: 5 },
  defaultPlayersPerOpponent: 5,
};

const DEFAULTS_BY_SLUG: Record<string, GameDefaults> = {
  "valorant": VALORANT_DEFAULTS,
  "overwatch": OVERWATCH_DEFAULTS,
  "marvel-rivals": MARVEL_RIVALS_DEFAULTS,
  "lol": LOL_DEFAULTS,
  "league-of-legends": LOL_DEFAULTS,
  "counter-strike-2": CS2_DEFAULTS,
  "cs2": CS2_DEFAULTS,
  "cs": CS2_DEFAULTS,
  "csgo": CS2_DEFAULTS,
};

export function getGameDefaults(gameSlug: string | null | undefined): GameDefaults {
  if (!gameSlug) return GENERIC_DEFAULTS;
  return DEFAULTS_BY_SLUG[gameSlug.toLowerCase()] ?? GENERIC_DEFAULTS;
}

// Generate a stable, lowercase IGN candidate from a name. Used when seeding
// default opponent players so each one has both a display name and an IGN.
export function defaultIgn(name: string, idx: number): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${base || "player"}${idx + 1}`;
}
