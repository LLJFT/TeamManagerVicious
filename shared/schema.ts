import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, index, boolean, integer } from "drizzle-orm/pg-core";
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
  notes: text("notes"),
  seasonId: varchar("season_id"),
}, (table) => [
  index("events_team_id_idx").on(table.teamId),
  index("events_game_id_idx").on(table.gameId),
  index("events_roster_id_idx").on(table.rosterId),
  index("events_date_idx").on(table.date),
  index("events_event_type_idx").on(table.eventType),
  index("events_season_id_idx").on(table.seasonId),
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
  gameModeId: varchar("game_mode_id").notNull().references(() => gameModes.id, { onDelete: "restrict" }),
  sortOrder: text("sort_order").default("0"),
}, (table) => [
  index("maps_team_id_idx").on(table.teamId),
  index("maps_game_id_idx").on(table.gameId),
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
}, (table) => [
  index("games_team_id_idx").on(table.teamId),
  index("games_game_id_idx").on(table.gameId),
  index("games_event_id_idx").on(table.eventId),
  index("games_roster_id_idx").on(table.rosterId),
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
  gameModeId: varchar("game_mode_id").notNull().references(() => gameModes.id, { onDelete: "restrict" }),
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
}
