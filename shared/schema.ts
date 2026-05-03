import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, index, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const availabilityOptions = [
  "unknown",
  "18:00-20:00 CEST",
  "20:00-22:00 CEST",
  "All blocks",
  "cannot"
] as const;

export const roleTypes = ["Tank", "DPS", "Support", "Flex", "Manager", "Analyst", "Coach"] as const;

export const orgRoles = ["super_admin", "org_admin", "game_manager", "coach_analyst", "player"] as const;
export type OrgRole = typeof orgRoles[number];

export const orgRoleLabels: Record<OrgRole, string> = {
  super_admin: "Super Admin",
  org_admin: "Management",
  game_manager: "Game Manager",
  coach_analyst: "Staff",
  player: "Player",
};

export const allPermissions = [
  "view_schedule",
  "edit_own_availability",
  "edit_all_availability",
  "manage_schedule_players",
  "view_events",
  "create_events",
  "edit_events",
  "delete_events",
  "view_results",
  "add_results",
  "edit_results",
  "delete_results",
  "view_players",
  "manage_players_tab",
  "view_statistics",
  "view_player_stats",
  "view_history",
  "view_compare",
  "view_opponents",
  "view_chat",
  "send_messages",
  "delete_own_messages",
  "delete_any_message",
  "manage_channels",
  "view_staff",
  "manage_staff",
  "view_dashboard",
  "manage_users",
  "manage_roles",
  "manage_game_config",
  "manage_stat_fields",
  "view_activity_log",
  "view_calendar",
  "view_upcoming_events",
  "view_users_tab",
  "view_roles_tab",
  "view_game_access",
  "view_settings",
  "manage_settings",
] as const;

export type Permission = typeof allPermissions[number];

export const permissionCategories: { category: string; label: string; permissions: Permission[] }[] = [
  {
    category: "schedule",
    label: "Schedule",
    permissions: ["view_schedule", "edit_own_availability", "edit_all_availability", "manage_schedule_players"],
  },
  {
    category: "events",
    label: "Events",
    permissions: ["view_events", "create_events", "edit_events", "delete_events"],
  },
  {
    category: "results",
    label: "Results",
    permissions: ["view_results", "add_results", "edit_results", "delete_results"],
  },
  {
    category: "players",
    label: "Players",
    permissions: ["view_players", "manage_players_tab"],
  },
  {
    category: "statistics",
    label: "Statistics",
    permissions: ["view_statistics", "view_player_stats", "view_history", "view_compare", "view_opponents"],
  },
  {
    category: "chat",
    label: "Chat",
    permissions: ["view_chat", "send_messages", "delete_own_messages", "delete_any_message", "manage_channels"],
  },
  {
    category: "staff",
    label: "Staff",
    permissions: ["view_staff", "manage_staff"],
  },
  {
    category: "dashboard",
    label: "Dashboard",
    permissions: ["view_dashboard", "manage_users", "manage_roles", "manage_game_config", "manage_stat_fields", "view_activity_log"],
  },
  {
    category: "home",
    label: "Home",
    permissions: ["view_calendar", "view_upcoming_events", "view_users_tab", "view_roles_tab", "view_game_access", "view_settings", "manage_settings"],
  },
];

export const userStatuses = ["pending", "active", "banned"] as const;
export type UserStatus = typeof userStatuses[number];

export const gameResultOptions = ["win", "loss", "draw"] as const;

export const dayOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
] as const;

export const eventTypes = ["Tournament", "Scrim", "VOD Review"] as const;

export const eventResults = ["win", "loss", "draw", "pending"] as const;

export const attendanceStatuses = ["attended", "late", "absent"] as const;

export const assignmentStatuses = ["pending", "approved", "rejected"] as const;
export type AssignmentStatus = typeof assignmentStatuses[number];

export const supportedGames = pgTable("supported_games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  iconUrl: text("icon_url"),
});

export const rosters = pgTable("rosters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id").notNull().references(() => supportedGames.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").default(0),
  code: varchar("code"),
  customName: text("custom_name"),
}, (table) => [
  index("rosters_team_id_idx").on(table.teamId),
  index("rosters_game_id_idx").on(table.gameId),
]);

export const SUPPORTED_GAMES_LIST = [
  { slug: "dota2", name: "Dota 2", sortOrder: 0 },
  { slug: "cs", name: "Counter-Strike", sortOrder: 1 },
  { slug: "valorant", name: "VALORANT", sortOrder: 2 },
  { slug: "mlbb", name: "Mobile Legends", sortOrder: 3 },
  { slug: "lol", name: "League of Legends", sortOrder: 4 },
  { slug: "rocket-league", name: "Rocket League", sortOrder: 5 },
  { slug: "pubg-mobile", name: "PUBG Mobile", sortOrder: 6 },
  { slug: "overwatch", name: "Overwatch", sortOrder: 7 },
  { slug: "r6", name: "Rainbow Six", sortOrder: 8 },
  { slug: "apex", name: "Apex Legends", sortOrder: 9 },
  { slug: "fighting-games", name: "Fighting Games", sortOrder: 10 },
  { slug: "pubg", name: "PUBG", sortOrder: 11 },
  { slug: "hok", name: "Honor of Kings", sortOrder: 12 },
  { slug: "brawl-stars", name: "Brawl Stars", sortOrder: 13 },
  { slug: "cod", name: "Call of Duty", sortOrder: 14 },
  { slug: "marvel-rivals", name: "Marvel Rivals", sortOrder: 15 },
  { slug: "ea-fc", name: "EA Sports FC", sortOrder: 16 },
  { slug: "free-fire", name: "Free Fire", sortOrder: 17 },
  { slug: "fortnite", name: "Fortnite", sortOrder: 18 },
  { slug: "tft", name: "Teamfight Tactics", sortOrder: 19 },
  { slug: "crossfire", name: "CrossFire", sortOrder: 20 },
  { slug: "deadlock", name: "Deadlock", sortOrder: 21 },
  { slug: "trackmania", name: "Trackmania", sortOrder: 22 },
  { slug: "the-finals", name: "The Finals", sortOrder: 23 },
  { slug: "warzone", name: "Warzone", sortOrder: 24 },
  { slug: "efootball", name: "eFootball", sortOrder: 25 },
  { slug: "free-fire-mobile", name: "Free Fire Mobile", sortOrder: 26 },
  { slug: "hok-mobile", name: "Honor of Kings Mobile", sortOrder: 27 },
  { slug: "cod-mobile", name: "Call of Duty Mobile", sortOrder: 28 },
] as const;

export const GAME_ABBREVIATIONS: Record<string, string> = {
  "dota2": "D2",
  "cs": "CS",
  "valorant": "VALO",
  "mlbb": "MLBB",
  "lol": "LoL",
  "rocket-league": "RL",
  "pubg-mobile": "PUBGM",
  "overwatch": "OW",
  "r6": "R6",
  "apex": "APEX",
  "fighting-games": "FG",
  "pubg": "PUBG",
  "hok": "HOK",
  "brawl-stars": "BS",
  "cod": "COD",
  "marvel-rivals": "MR",
  "ea-fc": "FC",
  "free-fire": "FF",
  "fortnite": "FN",
  "tft": "TFT",
  "crossfire": "CF",
  "deadlock": "DL",
  "trackmania": "TM",
  "the-finals": "TF",
  "warzone": "WZ",
  "efootball": "EF",
  "free-fire-mobile": "FFM",
  "hok-mobile": "HOKM",
  "cod-mobile": "CDM",
};

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  fullName: text("full_name"),
  phone: text("phone"),
  snapchat: text("snapchat"),
}, (table) => [
  index("players_team_id_idx").on(table.teamId),
  index("players_game_id_idx").on(table.gameId),
  index("players_roster_id_idx").on(table.rosterId),
]);

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  playerId: varchar("player_id").references(() => players.id, { onDelete: "set null" }),
  staffId: varchar("staff_id").references(() => staff.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  eventId: varchar("event_id").references(() => events.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  notes: text("notes"),
  ringer: text("ringer"),
}, (table) => [
  index("attendance_team_id_idx").on(table.teamId),
  index("attendance_game_id_idx").on(table.gameId),
  index("attendance_roster_id_idx").on(table.rosterId),
  index("attendance_event_id_idx").on(table.eventId),
  index("attendance_player_id_idx").on(table.playerId),
  index("attendance_date_idx").on(table.date),
]);

export const teamNotes = pgTable("team_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  timestamp: text("timestamp").notNull(),
}, (table) => [
  index("team_notes_team_id_idx").on(table.teamId),
  index("team_notes_game_id_idx").on(table.gameId),
]);

export const schedules = pgTable("schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  weekStartDate: text("week_start_date").notNull(),
  weekEndDate: text("week_end_date").notNull(),
  scheduleData: jsonb("schedule_data").notNull(),
  googleSheetId: text("google_sheet_id"),
}, (table) => [
  index("schedules_team_id_idx").on(table.teamId),
  index("schedules_game_id_idx").on(table.gameId),
  index("schedules_roster_id_idx").on(table.rosterId),
  index("schedules_week_start_idx").on(table.weekStartDate),
]);

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (table) => [
  index("settings_team_id_idx").on(table.teamId),
  index("settings_game_id_idx").on(table.gameId),
  index("settings_roster_id_idx").on(table.rosterId),
  index("settings_key_idx").on(table.key),
]);

export const eventCategories = pgTable("event_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  color: text("color").default("#3b82f6"),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("event_categories_team_id_idx").on(table.teamId),
  index("event_categories_game_id_idx").on(table.gameId),
]);

export const eventSubTypes = pgTable("event_sub_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  categoryId: varchar("category_id").notNull().references(() => eventCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("event_sub_types_team_id_idx").on(table.teamId),
  index("event_sub_types_game_id_idx").on(table.gameId),
]);

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(),
  eventSubType: text("event_sub_type"),
  date: text("date").notNull(),
  time: text("time"),
  timezone: text("timezone"),
  description: text("description"),
  result: text("result"),
  opponentName: text("opponent_name"),
  opponentId: varchar("opponent_id").references(() => opponents.id, { onDelete: "set null" }),
  notes: text("notes"),
  seasonId: varchar("season_id"),
}, (table) => [
  index("events_team_id_idx").on(table.teamId),
  index("events_game_id_idx").on(table.gameId),
  index("events_roster_id_idx").on(table.rosterId),
  index("events_date_idx").on(table.date),
  index("events_event_type_idx").on(table.eventType),
  index("events_season_id_idx").on(table.seasonId),
  index("events_opponent_id_idx").on(table.opponentId),
]);

export const seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
}, (table) => [
  index("seasons_team_id_idx").on(table.teamId),
  index("seasons_game_id_idx").on(table.gameId),
]);

export const gameModes = pgTable("game_modes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  sortOrder: text("sort_order").default("0"),
  scoreType: text("score_type").default("numeric").notNull(),
  maxScore: integer("max_score"),
  maxRoundWins: integer("max_round_wins"),
  maxRoundsPerGame: integer("max_rounds_per_game"),
  maxScorePerRoundPerSide: integer("max_score_per_round_per_side"),
}, (table) => [
  index("game_modes_team_id_idx").on(table.teamId),
  index("game_modes_game_id_idx").on(table.gameId),
]);

export const maps = pgTable("maps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  gameModeId: varchar("game_mode_id").references(() => gameModes.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
  sortOrder: text("sort_order").default("0"),
}, (table) => [
  index("maps_team_id_idx").on(table.teamId),
  index("maps_game_id_idx").on(table.gameId),
]);

export const MARVEL_RIVALS_DEFAULT_ROLES = ["Duelist", "Vanguard", "Strategist"] as const;
export const heroRoles = MARVEL_RIVALS_DEFAULT_ROLES;
export type HeroRole = string;

export const heroRoleConfigs = pgTable("hero_role_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  gameId: varchar("game_id").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("hero_role_configs_team_id_idx").on(table.teamId),
  index("hero_role_configs_game_id_idx").on(table.gameId),
  uniqueIndex("hero_role_configs_team_game_name_uniq").on(table.teamId, table.gameId, table.name),
]);

export const heroes = pgTable("heroes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("heroes_team_id_idx").on(table.teamId),
  index("heroes_game_id_idx").on(table.gameId),
  index("heroes_roster_id_idx").on(table.rosterId),
  index("heroes_role_idx").on(table.role),
]);

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
  gameCode: text("game_code").notNull(),
  score: text("score").notNull(),
  imageUrl: text("image_url"),
  gameModeId: varchar("game_mode_id").references(() => gameModes.id, { onDelete: "set null" }),
  mapId: varchar("map_id").references(() => maps.id, { onDelete: "set null" }),
  result: text("result"),
  link: text("link"),
  opponentId: varchar("opponent_id").references(() => opponents.id, { onDelete: "set null" }),
  heroBanSystemId: varchar("hero_ban_system_id"),
  mapVetoSystemId: varchar("map_veto_system_id"),
}, (table) => [
  index("games_team_id_idx").on(table.teamId),
  index("games_game_id_idx").on(table.gameId),
  index("games_event_id_idx").on(table.eventId),
  index("games_roster_id_idx").on(table.rosterId),
  index("games_opponent_id_idx").on(table.opponentId),
]);

export const opponents = pgTable("opponents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  shortName: text("short_name"),
  logoUrl: text("logo_url"),
  region: text("region"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("opponents_team_id_idx").on(table.teamId),
  index("opponents_game_id_idx").on(table.gameId),
  index("opponents_roster_id_idx").on(table.rosterId),
  index("opponents_name_idx").on(table.name),
]);

export const opponentPlayers = pgTable("opponent_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  opponentId: varchar("opponent_id").notNull().references(() => opponents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  isStarter: boolean("is_starter").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
}, (table) => [
  index("opponent_players_team_id_idx").on(table.teamId),
  index("opponent_players_opponent_id_idx").on(table.opponentId),
  index("opponent_players_roster_id_idx").on(table.rosterId),
]);

export const matchSides = ["us", "opponent"] as const;
export type MatchSide = typeof matchSides[number];

export const matchParticipants = pgTable("match_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  matchId: varchar("match_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  side: text("side").notNull(),
  playerId: varchar("player_id").references(() => players.id, { onDelete: "set null" }),
  opponentPlayerId: varchar("opponent_player_id").references(() => opponentPlayers.id, { onDelete: "cascade" }),
  played: boolean("played").notNull().default(true),
}, (table) => [
  index("match_participants_team_id_idx").on(table.teamId),
  index("match_participants_match_id_idx").on(table.matchId),
  index("match_participants_player_id_idx").on(table.playerId),
  index("match_participants_opp_player_id_idx").on(table.opponentPlayerId),
]);

export const opponentPlayerGameStats = pgTable("opponent_player_game_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  matchId: varchar("match_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  opponentPlayerId: varchar("opponent_player_id").references(() => opponentPlayers.id, { onDelete: "cascade" }),
  statFieldId: varchar("stat_field_id").references(() => statFields.id, { onDelete: "set null" }),
  value: text("value").notNull().default("0"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("opp_player_game_stats_team_id_idx").on(table.teamId),
  index("opp_player_game_stats_match_id_idx").on(table.matchId),
  index("opp_player_game_stats_opp_player_id_idx").on(table.opponentPlayerId),
]);

export const sides = pgTable("sides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  sortOrder: text("sort_order").default("0"),
}, (table) => [
  index("sides_team_id_idx").on(table.teamId),
  index("sides_game_id_idx").on(table.gameId),
  index("sides_roster_id_idx").on(table.rosterId),
]);

export const gameRounds = pgTable("game_rounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  matchId: varchar("match_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  sideId: varchar("side_id").references(() => sides.id, { onDelete: "set null" }),
  teamScore: integer("team_score").default(0).notNull(),
  opponentScore: integer("opponent_score").default(0).notNull(),
}, (table) => [
  index("game_rounds_team_id_idx").on(table.teamId),
  index("game_rounds_game_id_idx").on(table.gameId),
  index("game_rounds_match_id_idx").on(table.matchId),
  index("game_rounds_roster_id_idx").on(table.rosterId),
]);

export const heroBanActionTypes = ["ban", "lock", "protect"] as const;
export type HeroBanActionType = typeof heroBanActionTypes[number];

export const mapVetoActionTypes = ["ban", "pick", "decider"] as const;
export type MapVetoActionType = typeof mapVetoActionTypes[number];

export const banVetoTeamSlots = ["a", "b", "auto"] as const;
export type BanVetoTeamSlot = typeof banVetoTeamSlots[number];

// Hero Ban System (roster-scoped reusable config)
export const heroBanSystems = pgTable("hero_ban_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  mode: text("mode").notNull().default("simple"),
  supportsLocks: boolean("supports_locks").notNull().default(false),
  bansPerTeam: integer("bans_per_team").notNull().default(0),
  locksPerTeam: integer("locks_per_team").notNull().default(0),
  bansTargetEnemy: boolean("bans_target_enemy").notNull().default(true),
  locksSecureOwn: boolean("locks_secure_own").notNull().default(false),
  actionSequence: jsonb("action_sequence"),
  bansPerRound: integer("bans_per_round"),
  bansEverySideSwitch: boolean("bans_every_side_switch").notNull().default(false),
  bansEveryTwoRounds: boolean("bans_every_two_rounds").notNull().default(false),
  bansResetOnHalftime: boolean("bans_reset_on_halftime").notNull().default(false),
  overtimeBehavior: text("overtime_behavior"),
  totalBansPerMap: integer("total_bans_per_map"),
  bansAccumulate: boolean("bans_accumulate").notNull().default(false),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("hero_ban_systems_team_id_idx").on(table.teamId),
  index("hero_ban_systems_game_id_idx").on(table.gameId),
  index("hero_ban_systems_roster_id_idx").on(table.rosterId),
]);

// Map Veto System (roster-scoped reusable config)
export const mapVetoSystems = pgTable("map_veto_systems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  supportsBan: boolean("supports_ban").notNull().default(true),
  supportsPick: boolean("supports_pick").notNull().default(true),
  supportsDecider: boolean("supports_decider").notNull().default(true),
  supportsSideChoice: boolean("supports_side_choice").notNull().default(true),
  defaultRowCount: integer("default_row_count").notNull().default(7),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("map_veto_systems_team_id_idx").on(table.teamId),
  index("map_veto_systems_game_id_idx").on(table.gameId),
  index("map_veto_systems_roster_id_idx").on(table.rosterId),
]);

// Per-match hero ban actions (replace-all)
export const gameHeroBanActions = pgTable("game_hero_ban_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  matchId: varchar("match_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  actionType: text("action_type").notNull(),
  actingTeam: text("acting_team").notNull(),
  heroId: varchar("hero_id").references(() => heroes.id, { onDelete: "set null" }),
  notes: text("notes"),
}, (table) => [
  index("game_hero_ban_actions_team_id_idx").on(table.teamId),
  index("game_hero_ban_actions_match_id_idx").on(table.matchId),
  index("game_hero_ban_actions_roster_id_idx").on(table.rosterId),
]);

// Per-match map veto rows (replace-all)
export const gameMapVetoRows = pgTable("game_map_veto_rows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  matchId: varchar("match_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  actionType: text("action_type").notNull(),
  actingTeam: text("acting_team").notNull(),
  mapId: varchar("map_id").references(() => maps.id, { onDelete: "set null" }),
  sideId: varchar("side_id").references(() => sides.id, { onDelete: "set null" }),
  notes: text("notes"),
}, (table) => [
  index("game_map_veto_rows_team_id_idx").on(table.teamId),
  index("game_map_veto_rows_match_id_idx").on(table.matchId),
  index("game_map_veto_rows_roster_id_idx").on(table.rosterId),
]);

export const gameHeroes = pgTable("game_heroes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  matchId: varchar("match_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").references(() => players.id, { onDelete: "set null" }),
  opponentPlayerId: varchar("opponent_player_id").references(() => opponentPlayers.id, { onDelete: "cascade" }),
  heroId: varchar("hero_id").notNull().references(() => heroes.id, { onDelete: "restrict" }),
  roundNumber: integer("round_number"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("game_heroes_team_id_idx").on(table.teamId),
  index("game_heroes_match_id_idx").on(table.matchId),
  index("game_heroes_player_id_idx").on(table.playerId),
  index("game_heroes_opp_player_id_idx").on(table.opponentPlayerId),
  index("game_heroes_hero_id_idx").on(table.heroId),
  index("game_heroes_roster_id_idx").on(table.rosterId),
]);

export const offDays = pgTable("off_days", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  date: text("date").notNull(),
}, (table) => [
  index("off_days_team_id_idx").on(table.teamId),
  index("off_days_game_id_idx").on(table.gameId),
  index("off_days_roster_id_idx").on(table.rosterId),
  index("off_days_date_idx").on(table.date),
]);

export const statFields = pgTable("stat_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  gameModeId: varchar("game_mode_id").references(() => gameModes.id, { onDelete: "set null" }),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("stat_fields_team_id_idx").on(table.teamId),
  index("stat_fields_game_id_idx").on(table.gameId),
]);

export const playerGameStats = pgTable("player_game_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  matchId: varchar("match_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").references(() => players.id, { onDelete: "set null" }),
  statFieldId: varchar("stat_field_id").references(() => statFields.id, { onDelete: "set null" }),
  value: text("value").notNull().default("0"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("player_game_stats_team_id_idx").on(table.teamId),
  index("player_game_stats_game_id_idx").on(table.gameId),
  index("player_game_stats_match_id_idx").on(table.matchId),
  index("player_game_stats_player_id_idx").on(table.playerId),
]);

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  isSystem: boolean("is_system").default(false),
  permissions: jsonb("permissions").notNull().default(sql`'[]'::jsonb`),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("roles_team_id_idx").on(table.teamId),
  index("roles_game_id_idx").on(table.gameId),
]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  username: text("username").notNull(),
  displayName: text("display_name"),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  orgRole: text("org_role").default("player"),
  roleId: varchar("role_id").references(() => roles.id),
  playerId: varchar("player_id").references(() => players.id),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").default(sql`now()`),
  lastSeen: text("last_seen"),
  lastUserAgent: text("last_user_agent"),
}, (table) => [
  index("users_team_id_idx").on(table.teamId),
]);

export const userGameAssignments = pgTable("user_game_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameId: varchar("game_id").notNull().references(() => supportedGames.id, { onDelete: "cascade" }),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  assignedRole: text("assigned_role").notNull().default("player"),
  status: text("status").notNull().default("pending"),
  approvalGameStatus: text("approval_game_status").notNull().default("pending"),
  approvalOrgStatus: text("approval_org_status").notNull().default("pending"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("user_game_assignments_team_id_idx").on(table.teamId),
  index("user_game_assignments_user_id_idx").on(table.userId),
  index("user_game_assignments_game_id_idx").on(table.gameId),
  index("user_game_assignments_roster_id_idx").on(table.rosterId),
]);

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("trial"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  manualActiveOverride: boolean("manual_active_override"),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`now()`),
  updatedAt: text("updated_at").default(sql`now()`),
}, (table) => [
  index("subscriptions_team_id_idx").on(table.teamId),
  index("subscriptions_user_id_idx").on(table.userId),
]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  read: boolean("read").notNull().default(false),
  relatedId: varchar("related_id"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("notifications_team_id_idx").on(table.teamId),
  index("notifications_user_id_idx").on(table.userId),
]);

export const gameTemplates = pgTable("game_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  gameId: varchar("game_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
  createdAt: text("created_at").default(sql`now()`),
  updatedAt: text("updated_at").default(sql`now()`),
}, (table) => [
  index("game_templates_team_id_idx").on(table.teamId),
  index("game_templates_game_id_idx").on(table.gameId),
  uniqueIndex("game_templates_code_uniq").on(table.code),
]);

export const mediaFolders = pgTable("media_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  // Nullable parent for unlimited nesting. When null, folder is a root.
  parentId: varchar("parent_id"),
  // Optional game scope: when set, this folder lives under a supportedGames
  // root (custom subfolders inside a game). When null, it lives under the
  // "Custom Folders" root.
  gameId: varchar("game_id"),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("media_folders_team_id_idx").on(table.teamId),
  index("media_folders_parent_id_idx").on(table.parentId),
  index("media_folders_game_id_idx").on(table.gameId),
]);

export const mediaItems = pgTable("media_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull(),
  folderId: varchar("folder_id").notNull().references(() => mediaFolders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("media_items_team_id_idx").on(table.teamId),
  index("media_items_folder_id_idx").on(table.folderId),
]);

export const insertMediaFolderSchema = createInsertSchema(mediaFolders).omit({ id: true, createdAt: true, teamId: true });
export type InsertMediaFolder = z.infer<typeof insertMediaFolderSchema>;
export type MediaFolder = typeof mediaFolders.$inferSelect;

export const insertMediaItemSchema = createInsertSchema(mediaItems).omit({ id: true, createdAt: true, teamId: true });
export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;
export type MediaItem = typeof mediaItems.$inferSelect;

export const availabilitySlots = pgTable("availability_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("availability_slots_team_id_idx").on(table.teamId),
  index("availability_slots_game_id_idx").on(table.gameId),
]);

export const rosterRoles = pgTable("roster_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("player"),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("roster_roles_team_id_idx").on(table.teamId),
  index("roster_roles_game_id_idx").on(table.gameId),
]);

export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  fullName: text("full_name"),
  phone: text("phone"),
  snapchat: text("snapchat"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
}, (table) => [
  index("staff_team_id_idx").on(table.teamId),
  index("staff_game_id_idx").on(table.gameId),
]);

export const chatChannels = pgTable("chat_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("chat_channels_team_id_idx").on(table.teamId),
  index("chat_channels_game_id_idx").on(table.gameId),
]);

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  channelId: varchar("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  message: text("message"),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  attachmentName: text("attachment_name"),
  attachmentSize: integer("attachment_size"),
  mentions: jsonb("mentions").default(sql`'[]'::jsonb`),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("chat_messages_team_id_idx").on(table.teamId),
  index("chat_messages_game_id_idx").on(table.gameId),
  index("chat_messages_channel_id_idx").on(table.channelId),
]);

export const chatChannelPermissions = pgTable("chat_channel_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  channelId: varchar("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  canView: boolean("can_view").notNull().default(true),
  canSend: boolean("can_send").notNull().default(true),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("chat_channel_permissions_team_id_idx").on(table.teamId),
  index("chat_channel_permissions_game_id_idx").on(table.gameId),
]);

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id"),
  userId: varchar("user_id"),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  logType: text("log_type").notNull().default("team"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("activity_logs_team_id_idx").on(table.teamId),
  index("activity_logs_game_id_idx").on(table.gameId),
  index("activity_logs_roster_id_idx").on(table.rosterId),
]);

export const playerAvailability = pgTable("player_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  playerId: varchar("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  availability: text("availability").notNull().default("unknown"),
}, (table) => [
  index("player_availability_team_id_idx").on(table.teamId),
  index("player_availability_game_id_idx").on(table.gameId),
  index("player_availability_player_id_idx").on(table.playerId),
]);

export const staffAvailability = pgTable("staff_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id"),
  rosterId: varchar("roster_id").references(() => rosters.id, { onDelete: "set null" }),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  availability: text("availability").notNull().default("unknown"),
}, (table) => [
  index("staff_availability_team_id_idx").on(table.teamId),
  index("staff_availability_game_id_idx").on(table.gameId),
  index("staff_availability_staff_id_idx").on(table.staffId),
]);

export const insertRosterSchema = createInsertSchema(rosters).omit({
  id: true,
  teamId: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  teamId: true,
  gameId: true,
  rosterId: true,
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertTeamNotesSchema = createInsertSchema(teamNotes).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertSeasonSchema = createInsertSchema(seasons).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertGameModeSchema = createInsertSchema(gameModes).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertMapSchema = createInsertSchema(maps).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertOffDaySchema = createInsertSchema(offDays).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertSideSchema = createInsertSchema(sides).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertHeroSchema = createInsertSchema(heroes).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertHeroRoleConfigSchema = createInsertSchema(heroRoleConfigs).omit({
  id: true,
  teamId: true,
  gameId: true,
}).extend({
  name: z.string().trim().min(1, "Role name is required").max(60, "Role name too long"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex like #aabbcc").optional().nullable(),
});

export const insertGameHeroSchema = createInsertSchema(gameHeroes).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertOpponentSchema = createInsertSchema(opponents).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertOpponentPlayerSchema = createInsertSchema(opponentPlayers).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertMatchParticipantSchema = createInsertSchema(matchParticipants).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertOpponentPlayerGameStatSchema = createInsertSchema(opponentPlayerGameStats).omit({
  id: true,
  teamId: true,
  gameId: true,
  createdAt: true,
});

export const insertGameRoundSchema = createInsertSchema(gameRounds).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertHeroBanSystemSchema = createInsertSchema(heroBanSystems).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertMapVetoSystemSchema = createInsertSchema(mapVetoSystems).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertGameHeroBanActionSchema = createInsertSchema(gameHeroBanActions).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertGameMapVetoRowSchema = createInsertSchema(gameMapVetoRows).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertStatFieldSchema = createInsertSchema(statFields).omit({
  id: true,
  teamId: true,
  gameId: true,
  createdAt: true,
});

export const insertPlayerGameStatSchema = createInsertSchema(playerGameStats).omit({
  id: true,
  teamId: true,
  gameId: true,
  createdAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  teamId: true,
  gameId: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  teamId: true,
  createdAt: true,
});

export const insertAvailabilitySlotSchema = createInsertSchema(availabilitySlots).omit({
  id: true,
  teamId: true,
  gameId: true,
  createdAt: true,
});

export const insertRosterRoleSchema = createInsertSchema(rosterRoles).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertEventCategorySchema = createInsertSchema(eventCategories).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertEventSubTypeSchema = createInsertSchema(eventSubTypes).omit({
  id: true,
  teamId: true,
  gameId: true,
});

export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({
  id: true,
  teamId: true,
  gameId: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  teamId: true,
  gameId: true,
  createdAt: true,
});

export const insertSupportedGameSchema = createInsertSchema(supportedGames).omit({ id: true });
export const insertUserGameAssignmentSchema = createInsertSchema(userGameAssignments).omit({ id: true, teamId: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, teamId: true, createdAt: true });
export const insertChatChannelPermissionSchema = createInsertSchema(chatChannelPermissions).omit({ id: true, teamId: true, gameId: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, teamId: true, gameId: true, createdAt: true });
export const insertPlayerAvailabilitySchema = createInsertSchema(playerAvailability).omit({ id: true, teamId: true, gameId: true });
export const insertStaffAvailabilitySchema = createInsertSchema(staffAvailability).omit({ id: true, teamId: true, gameId: true });

export type AvailabilityOption = typeof availabilityOptions[number];
export type GameResult = typeof gameResultOptions[number];
export type RoleType = typeof roleTypes[number];
export type DayOfWeek = typeof dayOfWeek[number];
export type EventType = typeof eventTypes[number];
export type EventResult = typeof eventResults[number];
export type AttendanceStatus = typeof attendanceStatuses[number];

export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type TeamNotes = typeof teamNotes.$inferSelect;
export type InsertTeamNotes = z.infer<typeof insertTeamNotesSchema>;

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export type Season = typeof seasons.$inferSelect;
export type InsertSeason = z.infer<typeof insertSeasonSchema>;

export type GameMode = typeof gameModes.$inferSelect;
export type InsertGameMode = z.infer<typeof insertGameModeSchema>;

export type Map = typeof maps.$inferSelect;
export type InsertMap = z.infer<typeof insertMapSchema>;

export type OffDay = typeof offDays.$inferSelect;
export type InsertOffDay = z.infer<typeof insertOffDaySchema>;

export type Side = typeof sides.$inferSelect;
export type InsertSide = z.infer<typeof insertSideSchema>;

export type GameRound = typeof gameRounds.$inferSelect;
export type InsertGameRound = z.infer<typeof insertGameRoundSchema>;

export type HeroBanSystem = typeof heroBanSystems.$inferSelect;
export type InsertHeroBanSystem = z.infer<typeof insertHeroBanSystemSchema>;

export type MapVetoSystem = typeof mapVetoSystems.$inferSelect;
export type InsertMapVetoSystem = z.infer<typeof insertMapVetoSystemSchema>;

export type GameHeroBanAction = typeof gameHeroBanActions.$inferSelect;
export type InsertGameHeroBanAction = z.infer<typeof insertGameHeroBanActionSchema>;

export type GameMapVetoRow = typeof gameMapVetoRows.$inferSelect;
export type InsertGameMapVetoRow = z.infer<typeof insertGameMapVetoRowSchema>;

export type Hero = typeof heroes.$inferSelect;
export type InsertHero = z.infer<typeof insertHeroSchema>;

export type HeroRoleConfig = typeof heroRoleConfigs.$inferSelect;
export type InsertHeroRoleConfig = z.infer<typeof insertHeroRoleConfigSchema>;

export type GameHero = typeof gameHeroes.$inferSelect;
export type InsertGameHero = z.infer<typeof insertGameHeroSchema>;

export type Opponent = typeof opponents.$inferSelect;
export type InsertOpponent = z.infer<typeof insertOpponentSchema>;

export type OpponentPlayer = typeof opponentPlayers.$inferSelect;
export type InsertOpponentPlayer = z.infer<typeof insertOpponentPlayerSchema>;

export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type InsertMatchParticipant = z.infer<typeof insertMatchParticipantSchema>;

export type OpponentPlayerGameStat = typeof opponentPlayerGameStats.$inferSelect;
export type InsertOpponentPlayerGameStat = z.infer<typeof insertOpponentPlayerGameStatSchema>;

export type StatField = typeof statFields.$inferSelect;
export type InsertStatField = z.infer<typeof insertStatFieldSchema>;

export type PlayerGameStat = typeof playerGameStats.$inferSelect;
export type InsertPlayerGameStat = z.infer<typeof insertPlayerGameStatSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type AvailabilitySlot = typeof availabilitySlots.$inferSelect;
export type InsertAvailabilitySlot = z.infer<typeof insertAvailabilitySlotSchema>;

export type RosterRole = typeof rosterRoles.$inferSelect;
export type InsertRosterRole = z.infer<typeof insertRosterRoleSchema>;

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = z.infer<typeof insertStaffSchema>;

export type ChatChannel = typeof chatChannels.$inferSelect;
export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type ChatChannelPermission = typeof chatChannelPermissions.$inferSelect;
export type InsertChatChannelPermission = z.infer<typeof insertChatChannelPermissionSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type PlayerAvailabilityRecord = typeof playerAvailability.$inferSelect;
export type InsertPlayerAvailability = z.infer<typeof insertPlayerAvailabilitySchema>;
export type StaffAvailabilityRecord = typeof staffAvailability.$inferSelect;
export type InsertStaffAvailability = z.infer<typeof insertStaffAvailabilitySchema>;

export type EventCategory = typeof eventCategories.$inferSelect;
export type InsertEventCategory = z.infer<typeof insertEventCategorySchema>;

export type EventSubType = typeof eventSubTypes.$inferSelect;
export type InsertEventSubType = z.infer<typeof insertEventSubTypeSchema>;

export type Roster = typeof rosters.$inferSelect;
export type InsertRoster = z.infer<typeof insertRosterSchema>;

export type SupportedGame = typeof supportedGames.$inferSelect;
export type InsertSupportedGame = z.infer<typeof insertSupportedGameSchema>;

export type UserGameAssignment = typeof userGameAssignments.$inferSelect;
export type InsertUserGameAssignment = z.infer<typeof insertUserGameAssignmentSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const insertGameTemplateSchema = createInsertSchema(gameTemplates).omit({
  id: true,
  code: true,
  createdAt: true,
  updatedAt: true,
});
export type GameTemplate = typeof gameTemplates.$inferSelect;
export type InsertGameTemplate = z.infer<typeof insertGameTemplateSchema>;

export interface GameTemplateConfig {
  singleModeGame?: boolean;
  gameModes?: Array<{
    tempId: string;
    name: string;
    sortOrder?: string | null;
    scoreType?: string;
    maxScore?: number | null;
    maxRoundWins?: number | null;
    maxRoundsPerGame?: number | null;
    maxScorePerRoundPerSide?: number | null;
  }>;
  maps?: Array<{
    tempId: string;
    name: string;
    gameModeTempId: string | null;
    imageUrl?: string | null;
    sortOrder?: string | null;
  }>;
  heroes?: Array<{
    tempId: string;
    name: string;
    role: string;
    imageUrl?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }>;
  statFields?: Array<{
    tempId: string;
    name: string;
    gameModeTempId: string | null;
  }>;
  eventCategories?: Array<{
    tempId: string;
    name: string;
    color?: string | null;
  }>;
  availabilitySlots?: Array<{
    tempId: string;
    label: string;
    sortOrder?: number;
  }>;
  opponents?: Array<{
    tempId: string;
    name: string;
    shortName?: string | null;
    logoUrl?: string | null;
    region?: string | null;
    notes?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }>;
  // Template-scoped opponent rosters. Each player belongs to an opponent
  // by tempId (re-linked to the new opponent uuid on apply). When the
  // template is applied, these are inserted into `opponent_players`.
  players?: Array<{
    tempId: string;
    opponentTempId: string;
    name: string;
    ign?: string | null;
    role?: string | null;
    notes?: string | null;
    isStarter?: boolean;
    sortOrder?: number;
  }>;
  // ── Added in extended editor: full Dashboard-config parity ──
  sides?: Array<{
    tempId: string;
    name: string;
    sortOrder?: string | null;
  }>;
  rosterRoles?: Array<{
    tempId: string;
    name: string;
    type?: string;
    sortOrder?: number;
  }>;
  heroRoles?: Array<{
    tempId: string;
    name: string;
    color?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }>;
  eventSubTypes?: Array<{
    tempId: string;
    categoryTempId: string;
    name: string;
    color?: string | null;
    sortOrder?: number;
  }>;
  heroBanSystems?: Array<{
    tempId: string;
    name: string;
    enabled?: boolean;
    mode?: string;
    supportsLocks?: boolean;
    bansPerTeam?: number;
    locksPerTeam?: number;
    bansTargetEnemy?: boolean;
    locksSecureOwn?: boolean;
    bansPerRound?: number | null;
    bansEverySideSwitch?: boolean;
    bansEveryTwoRounds?: boolean;
    bansResetOnHalftime?: boolean;
    overtimeBehavior?: string | null;
    totalBansPerMap?: number | null;
    bansAccumulate?: boolean;
    notes?: string | null;
    sortOrder?: number;
  }>;
  mapVetoSystems?: Array<{
    tempId: string;
    name: string;
    enabled?: boolean;
    supportsBan?: boolean;
    supportsPick?: boolean;
    supportsDecider?: boolean;
    supportsSideChoice?: boolean;
    defaultRowCount?: number;
    notes?: string | null;
    sortOrder?: number;
  }>;
}

export interface PlayerAvailability {
  playerId: string;
  playerName: string;
  role: RoleType;
  availability: {
    [key in DayOfWeek]: AvailabilityOption;
  };
}

export interface ScheduleData {
  players: PlayerAvailability[];
}

export interface UserWithRole extends Omit<User, 'passwordHash'> {
  role: Role | null;
  gameAssignments?: UserGameAssignment[];
  subscription?: SubscriptionStatus;
}

export type SubscriptionType = "trial" | "paid";

export interface SubscriptionStatus {
  hasSubscription: boolean;
  status: "active" | "inactive";
  type: SubscriptionType | null;
  startDate: string | null;
  endDate: string | null;
  manualActiveOverride: boolean | null;
  daysRemaining: number | null;
  bypass: boolean;
}

export const subscriptionTypes = ["trial", "paid"] as const;

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  teamId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  type: z.enum(subscriptionTypes),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  manualActiveOverride: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
