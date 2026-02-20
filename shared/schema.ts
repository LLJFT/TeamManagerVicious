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

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  role: text("role").notNull(),
  fullName: text("full_name"),
  phone: text("phone"),
  snapchat: text("snapchat"),
}, (table) => [
  index("players_team_id_idx").on(table.teamId),
]);

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  playerId: varchar("player_id").notNull().references(() => players.id),
  date: text("date").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  ringer: text("ringer"),
}, (table) => [
  index("attendance_team_id_idx").on(table.teamId),
]);

export const teamNotes = pgTable("team_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  timestamp: text("timestamp").notNull(),
}, (table) => [
  index("team_notes_team_id_idx").on(table.teamId),
]);

export const schedules = pgTable("schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  weekStartDate: text("week_start_date").notNull(),
  weekEndDate: text("week_end_date").notNull(),
  scheduleData: jsonb("schedule_data").notNull(),
  googleSheetId: text("google_sheet_id"),
}, (table) => [
  index("schedules_team_id_idx").on(table.teamId),
]);

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (table) => [
  index("settings_team_id_idx").on(table.teamId),
]);

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(),
  date: text("date").notNull(),
  time: text("time"),
  description: text("description"),
  result: text("result"),
  opponentName: text("opponent_name"),
  notes: text("notes"),
  seasonId: varchar("season_id"),
}, (table) => [
  index("events_team_id_idx").on(table.teamId),
]);

export const seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  description: text("description"),
}, (table) => [
  index("seasons_team_id_idx").on(table.teamId),
]);

export const gameModes = pgTable("game_modes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  sortOrder: text("sort_order").default("0"),
}, (table) => [
  index("game_modes_team_id_idx").on(table.teamId),
]);

export const maps = pgTable("maps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  gameModeId: varchar("game_mode_id").notNull().references(() => gameModes.id, { onDelete: "cascade" }),
  sortOrder: text("sort_order").default("0"),
}, (table) => [
  index("maps_team_id_idx").on(table.teamId),
]);

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  gameCode: text("game_code").notNull(),
  score: text("score").notNull(),
  imageUrl: text("image_url"),
  gameModeId: varchar("game_mode_id").references(() => gameModes.id),
  mapId: varchar("map_id").references(() => maps.id),
  result: text("result"),
  link: text("link"),
}, (table) => [
  index("games_team_id_idx").on(table.teamId),
]);

export const offDays = pgTable("off_days", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  date: text("date").notNull(),
}, (table) => [
  index("off_days_team_id_idx").on(table.teamId),
]);

export const statFields = pgTable("stat_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  gameModeId: varchar("game_mode_id").notNull().references(() => gameModes.id, { onDelete: "cascade" }),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("stat_fields_team_id_idx").on(table.teamId),
]);

export const playerGameStats = pgTable("player_game_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  gameId: varchar("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  playerId: varchar("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  statFieldId: varchar("stat_field_id").notNull().references(() => statFields.id, { onDelete: "cascade" }),
  value: text("value").notNull().default("0"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("player_game_stats_team_id_idx").on(table.teamId),
]);

// Auth & Roles
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  isSystem: boolean("is_system").default(false),
  permissions: jsonb("permissions").notNull().default(sql`'[]'::jsonb`),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("roles_team_id_idx").on(table.teamId),
]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  roleId: varchar("role_id").references(() => roles.id),
  playerId: varchar("player_id").references(() => players.id),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").default(sql`now()`),
  lastSeen: text("last_seen"),
  lastUserAgent: text("last_user_agent"),
}, (table) => [
  index("users_team_id_idx").on(table.teamId),
]);

// Availability Slots
export const availabilitySlots = pgTable("availability_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("availability_slots_team_id_idx").on(table.teamId),
]);

// Player/Staff Role Types (for roster, not auth)
export const rosterRoles = pgTable("roster_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  type: text("type").notNull().default("player"),
  sortOrder: integer("sort_order").default(0),
}, (table) => [
  index("roster_roles_team_id_idx").on(table.teamId),
]);

// Staff members (separate from players)
export const staff = pgTable("staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  role: text("role").notNull(),
  fullName: text("full_name"),
  phone: text("phone"),
  snapchat: text("snapchat"),
}, (table) => [
  index("staff_team_id_idx").on(table.teamId),
]);

// Chat
export const chatChannels = pgTable("chat_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  name: text("name").notNull(),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("chat_channels_team_id_idx").on(table.teamId),
]);

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  channelId: varchar("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message"),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  mentions: jsonb("mentions").default(sql`'[]'::jsonb`),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("chat_messages_team_id_idx").on(table.teamId),
  index("chat_messages_channel_id_idx").on(table.channelId),
]);

export const chatChannelPermissions = pgTable("chat_channel_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  channelId: varchar("channel_id").notNull().references(() => chatChannels.id, { onDelete: "cascade" }),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  canView: boolean("can_view").notNull().default(true),
  canSend: boolean("can_send").notNull().default(true),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("chat_channel_permissions_team_id_idx").on(table.teamId),
]);

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  userId: varchar("user_id"),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at").default(sql`now()`),
}, (table) => [
  index("activity_logs_team_id_idx").on(table.teamId),
]);

export const playerAvailability = pgTable("player_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  playerId: varchar("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  availability: text("availability").notNull().default("unknown"),
}, (table) => [
  index("player_availability_team_id_idx").on(table.teamId),
  index("player_availability_player_id_idx").on(table.playerId),
]);

export const staffAvailability = pgTable("staff_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id"),
  staffId: varchar("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  day: text("day").notNull(),
  availability: text("availability").notNull().default("unknown"),
}, (table) => [
  index("staff_availability_team_id_idx").on(table.teamId),
  index("staff_availability_staff_id_idx").on(table.staffId),
]);

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  teamId: true,
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  teamId: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  teamId: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  teamId: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  teamId: true,
});

export const insertTeamNotesSchema = createInsertSchema(teamNotes).omit({
  id: true,
  teamId: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  teamId: true,
});

export const insertSeasonSchema = createInsertSchema(seasons).omit({
  id: true,
  teamId: true,
});

export const insertGameModeSchema = createInsertSchema(gameModes).omit({
  id: true,
  teamId: true,
});

export const insertMapSchema = createInsertSchema(maps).omit({
  id: true,
  teamId: true,
});

export const insertOffDaySchema = createInsertSchema(offDays).omit({
  id: true,
  teamId: true,
});

export const insertStatFieldSchema = createInsertSchema(statFields).omit({
  id: true,
  teamId: true,
  createdAt: true,
});

export const insertPlayerGameStatSchema = createInsertSchema(playerGameStats).omit({
  id: true,
  teamId: true,
  createdAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  teamId: true,
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
  createdAt: true,
});

export const insertRosterRoleSchema = createInsertSchema(rosterRoles).omit({
  id: true,
  teamId: true,
});

export const insertStaffSchema = createInsertSchema(staff).omit({
  id: true,
  teamId: true,
});

export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({
  id: true,
  teamId: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  teamId: true,
  createdAt: true,
});

export const insertChatChannelPermissionSchema = createInsertSchema(chatChannelPermissions).omit({ id: true, teamId: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, teamId: true, createdAt: true });
export const insertPlayerAvailabilitySchema = createInsertSchema(playerAvailability).omit({ id: true, teamId: true });
export const insertStaffAvailabilitySchema = createInsertSchema(staffAvailability).omit({ id: true, teamId: true });

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
}
