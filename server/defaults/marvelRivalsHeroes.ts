import type { HeroRole } from "@shared/schema";

export interface DefaultHero {
  name: string;
  role: HeroRole;
  sortOrder: number;
}

const duelists = [
  "Black Panther", "Black Widow", "Blade", "Daredevil", "Elsa Bloodstone",
  "Hawkeye", "Hela", "Human Torch", "Iron Fist", "Iron Man", "Magik",
  "Mister Fantastic", "Moon Knight", "Namor", "Phoenix", "Psylocke",
  "Scarlet Witch", "Spider-Man", "Squirrel Girl", "Star-Lord", "Storm",
  "The Punisher", "Winter Soldier", "Wolverine", "Deadpool",
];

const vanguards = [
  "Angela", "Captain America", "Doctor Strange", "Emma Frost", "Groot",
  "Hulk", "Magneto", "Peni Parker", "Rogue", "The Thing", "Thor",
  "Venom", "Deadpool",
];

const strategists = [
  "Adam Warlock", "Cloak & Dagger", "Gambit", "Invisible Woman",
  "Jeff the Land Shark", "Loki", "Luna Snow", "Mantis", "Rocket Raccoon",
  "Ultron", "White Fox", "Deadpool",
];

export const MARVEL_RIVALS_DEFAULT_HEROES: DefaultHero[] = [
  ...duelists.map((name, i) => ({ name, role: "Duelist" as HeroRole, sortOrder: i })),
  ...vanguards.map((name, i) => ({ name, role: "Vanguard" as HeroRole, sortOrder: 1000 + i })),
  ...strategists.map((name, i) => ({ name, role: "Strategist" as HeroRole, sortOrder: 2000 + i })),
];

export const MARVEL_RIVALS_GAME_SLUG = "marvel-rivals";
export const HEROES_SEEDED_SETTING_KEY = "heroes_defaults_seeded";
