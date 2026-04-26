import type { HeroRole } from "@shared/schema";

export interface DefaultHero {
  name: string;
  role: HeroRole;
  sortOrder: number;
}

const damage = [
  "Anran", "Ashe", "Bastion", "Cassidy", "Echo", "Emre", "Freja", "Genji",
  "Hanzo", "Junkrat", "Mei", "Pharah", "Reaper", "Sierra", "Sojourn",
  "Soldier: 76", "Sombra", "Symmetra", "Torbjörn", "Tracer", "Vendetta",
  "Venture", "Widowmaker",
];

const support = [
  "Ana", "Baptiste", "Brigitte", "Illari", "Jetpack Cat", "Juno", "Kiriko",
  "Lifeweaver", "Lúcio", "Mercy", "Mizuki", "Moira", "Wuyang", "Zenyatta",
];

const tank = [
  "D.Va", "Domina", "Doomfist", "Hazard", "Junker Queen", "Mauga", "Orisa",
  "Ramattra", "Reinhardt", "Roadhog", "Sigma", "Winston", "Wrecking Ball",
  "Zarya",
];

export const OVERWATCH_DEFAULT_HEROES: DefaultHero[] = [
  ...damage.map((name, i) => ({ name, role: "Damage" as HeroRole, sortOrder: i })),
  ...tank.map((name, i) => ({ name, role: "Tank" as HeroRole, sortOrder: 1000 + i })),
  ...support.map((name, i) => ({ name, role: "Support" as HeroRole, sortOrder: 2000 + i })),
];

export const OVERWATCH_DEFAULT_ROLES = ["Damage", "Tank", "Support"] as const;

export const OVERWATCH_GAME_SLUG = "overwatch";
