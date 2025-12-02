import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, index } from "drizzle-orm/pg-core";
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
