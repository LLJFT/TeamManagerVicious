import type { Player, InsertPlayer, Schedule, InsertSchedule, Setting, InsertSetting, Event, InsertEvent, Attendance, InsertAttendance, TeamNotes, InsertTeamNotes, Game, InsertGame, GameMode, InsertGameMode, Map, InsertMap, Season, InsertSeason, OffDay, InsertOffDay, StatField, InsertStatField, PlayerGameStat, InsertPlayerGameStat, PlayerAvailabilityRecord, InsertPlayerAvailability, StaffAvailabilityRecord, InsertStaffAvailability, Staff, InsertStaff, AvailabilitySlot, RosterRole, SupportedGame, UserGameAssignment, Notification } from "@shared/schema";
import { players, schedules, settings, events, attendance, teamNotes, games, gameModes, maps, seasons, offDays, statFields, playerGameStats, playerAvailability, staffAvailability, staff as staffTable, availabilitySlots, rosterRoles, supportedGames, userGameAssignments, notifications, users, rosters } from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, desc } from "drizzle-orm";

export function getTeamId(): string {
  const teamId = process.env.TEAM_ID || process.env.REPL_ID;
  if (!teamId) {
    throw new Error("TEAM_ID or REPL_ID environment variable must be set for data isolation");
  }
  return teamId;
}

function gameFilter(table: any, gameId: string | null | undefined) {
  if (gameId) {
    return eq(table.gameId, gameId);
  }
  return undefined;
}

function buildWhere(teamId: string, table: any, gameId?: string | null, rosterId?: string | null) {
  const conditions = [eq(table.teamId, teamId)];
  if (gameId) {
    conditions.push(eq(table.gameId, gameId));
  }
  if (rosterId && table.rosterId) {
    conditions.push(eq(table.rosterId, rosterId));
  }
  return and(...conditions);
}

export interface IStorage {
  getSchedule(weekStartDate: string, weekEndDate: string, gameId?: string | null, rosterId?: string | null): Promise<Schedule | undefined>;
  saveSchedule(schedule: InsertSchedule, gameId?: string | null, rosterId?: string | null): Promise<Schedule>;
  getAllPlayers(gameId?: string | null, rosterId?: string | null): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  addPlayer(player: InsertPlayer, gameId?: string | null, rosterId?: string | null): Promise<Player>;
  updatePlayer(id: string, player: Partial<InsertPlayer>): Promise<Player>;
  removePlayer(id: string): Promise<boolean>;
  getSetting(key: string, gameId?: string | null, rosterId?: string | null): Promise<string | null>;
  setSetting(key: string, value: string, gameId?: string | null, rosterId?: string | null): Promise<Setting>;
  getAllEvents(gameId?: string | null, rosterId?: string | null): Promise<Event[]>;
  addEvent(event: InsertEvent, gameId?: string | null, rosterId?: string | null): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event>;
  removeEvent(id: string): Promise<boolean>;
  getAllAttendance(gameId?: string | null, rosterId?: string | null): Promise<Attendance[]>;
  getAttendanceByPlayerId(playerId: string): Promise<Attendance[]>;
  addAttendance(attendance: InsertAttendance, gameId?: string | null, rosterId?: string | null): Promise<Attendance>;
  updateAttendance(id: string, attendance: Partial<InsertAttendance>): Promise<Attendance>;
  removeAttendance(id: string): Promise<boolean>;
  getTeamNotes(gameId?: string | null, rosterId?: string | null): Promise<TeamNotes[]>;
  addTeamNote(note: InsertTeamNotes, gameId?: string | null, rosterId?: string | null): Promise<TeamNotes>;
  deleteTeamNote(id: string): Promise<boolean>;
  getGamesByEventId(eventId: string): Promise<Game[]>;
  getAllGamesWithEventType(scope?: string, gameId?: string | null, rosterId?: string | null): Promise<(Game & { eventType: string })[]>;
  addGame(game: InsertGame, gameId?: string | null, rosterId?: string | null): Promise<Game>;
  updateGame(id: string, game: Partial<InsertGame>): Promise<Game>;
  removeGame(id: string): Promise<boolean>;
  getAllGameModes(gameId?: string | null, rosterId?: string | null): Promise<GameMode[]>;
  addGameMode(gameMode: InsertGameMode, gameId?: string | null, rosterId?: string | null): Promise<GameMode>;
  updateGameMode(id: string, gameMode: Partial<InsertGameMode>): Promise<GameMode>;
  removeGameMode(id: string): Promise<boolean>;
  getAllMaps(gameId?: string | null, rosterId?: string | null): Promise<Map[]>;
  getMapsByGameModeId(gameModeId: string): Promise<Map[]>;
  addMap(map: InsertMap, gameId?: string | null, rosterId?: string | null): Promise<Map>;
  updateMap(id: string, map: Partial<InsertMap>): Promise<Map>;
  removeMap(id: string): Promise<boolean>;
  getAllSeasons(gameId?: string | null, rosterId?: string | null): Promise<Season[]>;
  addSeason(season: InsertSeason, gameId?: string | null, rosterId?: string | null): Promise<Season>;
  updateSeason(id: string, season: Partial<InsertSeason>): Promise<Season>;
  removeSeason(id: string): Promise<boolean>;
  getAllOffDays(gameId?: string | null, rosterId?: string | null): Promise<OffDay[]>;
  addOffDay(offDay: InsertOffDay, gameId?: string | null, rosterId?: string | null): Promise<OffDay>;
  removeOffDay(date: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  removeOffDayById(id: string): Promise<boolean>;
  duplicateEvent(eventId: string, gameId?: string | null, rosterId?: string | null): Promise<Event>;
  getAllStatFields(gameId?: string | null, rosterId?: string | null): Promise<StatField[]>;
  getStatFieldsByGameModeId(gameModeId: string): Promise<StatField[]>;
  addStatField(statField: InsertStatField, gameId?: string | null, rosterId?: string | null): Promise<StatField>;
  updateStatField(id: string, statField: Partial<InsertStatField>): Promise<StatField>;
  removeStatField(id: string): Promise<boolean>;
  getPlayerGameStats(matchId: string): Promise<PlayerGameStat[]>;
  savePlayerGameStats(matchId: string, stats: InsertPlayerGameStat[], gameId?: string | null, rosterId?: string | null): Promise<PlayerGameStat[]>;
  getPlayerAvailabilities(gameId?: string | null, rosterId?: string | null): Promise<PlayerAvailabilityRecord[]>;
  savePlayerAvailability(playerId: string, day: string, availability: string, gameId?: string | null, rosterId?: string | null): Promise<PlayerAvailabilityRecord>;
  deletePlayerAvailabilities(playerId: string): Promise<boolean>;
  getStaffAvailabilities(gameId?: string | null, rosterId?: string | null): Promise<StaffAvailabilityRecord[]>;
  saveStaffAvailability(staffId: string, day: string, availability: string, gameId?: string | null, rosterId?: string | null): Promise<StaffAvailabilityRecord>;
  deleteStaffAvailabilities(staffId: string): Promise<boolean>;
  getAllAvailabilitySlots(gameId?: string | null, rosterId?: string | null): Promise<AvailabilitySlot[]>;
  getAllRosterRoles(gameId?: string | null, rosterId?: string | null): Promise<RosterRole[]>;
  getAllStaff(gameId?: string | null, rosterId?: string | null): Promise<Staff[]>;
  getSupportedGames(): Promise<SupportedGame[]>;
  getSupportedGameBySlug(slug: string): Promise<SupportedGame | undefined>;
  getUserGameAssignments(userId: string): Promise<UserGameAssignment[]>;
  getAllPendingAssignments(gameId?: string | null, rosterId?: string | null): Promise<(UserGameAssignment & { username: string; gameName: string; gameSlug: string; rosterName: string | null })[]>;
  createUserGameAssignment(teamId: string, userId: string, gameId: string, assignedRole: string, rosterId?: string): Promise<UserGameAssignment>;
  approveUserGameAssignment(id: string): Promise<UserGameAssignment>;
  rejectUserGameAssignment(id: string): Promise<UserGameAssignment>;
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(teamId: string, userId: string, message: string, type: string, relatedId?: string): Promise<Notification>;
  markNotificationRead(id: string, userId: string): Promise<Notification>;
  markAllNotificationsRead(userId: string): Promise<void>;
}

export class DbStorage implements IStorage {
  async getSchedule(weekStartDate: string, weekEndDate: string, gameId?: string | null, rosterId?: string | null): Promise<Schedule | undefined> {
    const teamId = getTeamId();
    const conditions = [
      eq(schedules.teamId, teamId),
      eq(schedules.weekStartDate, weekStartDate),
      eq(schedules.weekEndDate, weekEndDate),
    ];
    if (gameId) conditions.push(eq(schedules.gameId, gameId));
    if (rosterId) conditions.push(eq(schedules.rosterId, rosterId));
    const result = await db.select().from(schedules).where(and(...conditions)).limit(1);
    return result[0];
  }

  async saveSchedule(insertSchedule: InsertSchedule, gameId?: string | null, rosterId?: string | null): Promise<Schedule> {
    const teamId = getTeamId();
    const existing = await this.getSchedule(insertSchedule.weekStartDate, insertSchedule.weekEndDate, gameId, rosterId);

    if (existing) {
      const updated = await db
        .update(schedules)
        .set({ scheduleData: insertSchedule.scheduleData as any, googleSheetId: insertSchedule.googleSheetId })
        .where(and(eq(schedules.id, existing.id), eq(schedules.teamId, teamId)))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(schedules)
      .values({ ...insertSchedule, teamId, gameId, rosterId })
      .returning();
    return inserted[0];
  }

  async getAllPlayers(gameId?: string | null, rosterId?: string | null): Promise<Player[]> {
    const teamId = getTeamId();
    return await db.select().from(players).where(buildWhere(teamId, players, gameId, rosterId));
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const teamId = getTeamId();
    const result = await db.select().from(players).where(and(eq(players.id, id), eq(players.teamId, teamId))).limit(1);
    return result[0];
  }

  async addPlayer(insertPlayer: InsertPlayer, gameId?: string | null, rosterId?: string | null): Promise<Player> {
    const teamId = getTeamId();
    const inserted = await db.insert(players).values({ ...insertPlayer, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updatePlayer(id: string, updateData: Partial<InsertPlayer>): Promise<Player> {
    const teamId = getTeamId();
    const updated = await db.update(players).set(updateData).where(and(eq(players.id, id), eq(players.teamId, teamId))).returning();
    return updated[0];
  }

  async removePlayer(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(players).where(and(eq(players.id, id), eq(players.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getSetting(key: string, gameId?: string | null, rosterId?: string | null): Promise<string | null> {
    const teamId = getTeamId();
    const conditions = [eq(settings.key, key), eq(settings.teamId, teamId)];
    if (gameId) conditions.push(eq(settings.gameId, gameId));
    if (rosterId) conditions.push(eq(settings.rosterId, rosterId));
    const result = await db.select().from(settings).where(and(...conditions)).limit(1);
    return result[0]?.value ?? null;
  }

  async setSetting(key: string, value: string, gameId?: string | null, rosterId?: string | null): Promise<Setting> {
    const teamId = getTeamId();
    const conditions = [eq(settings.key, key), eq(settings.teamId, teamId)];
    if (gameId) conditions.push(eq(settings.gameId, gameId));
    if (rosterId) conditions.push(eq(settings.rosterId, rosterId));
    const existingResult = await db.select().from(settings).where(and(...conditions)).limit(1);

    if (existingResult.length > 0) {
      const updated = await db.update(settings).set({ value }).where(and(...conditions)).returning();
      return updated[0];
    }

    const inserted = await db.insert(settings).values({ key, value, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async getAllEvents(gameId?: string | null, rosterId?: string | null): Promise<Event[]> {
    const teamId = getTeamId();
    return await db.select().from(events).where(buildWhere(teamId, events, gameId, rosterId));
  }

  async addEvent(insertEvent: InsertEvent, gameId?: string | null, rosterId?: string | null): Promise<Event> {
    const teamId = getTeamId();
    const inserted = await db.insert(events).values({ ...insertEvent, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event> {
    const teamId = getTeamId();
    const updated = await db.update(events).set(updateData).where(and(eq(events.id, id), eq(events.teamId, teamId))).returning();
    return updated[0];
  }

  async removeEvent(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(events).where(and(eq(events.id, id), eq(events.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getAllAttendance(gameId?: string | null, rosterId?: string | null): Promise<Attendance[]> {
    const teamId = getTeamId();
    return await db.select().from(attendance).where(buildWhere(teamId, attendance, gameId, rosterId));
  }

  async getAttendanceByPlayerId(playerId: string): Promise<Attendance[]> {
    const teamId = getTeamId();
    return await db.select().from(attendance).where(and(eq(attendance.playerId, playerId), eq(attendance.teamId, teamId)));
  }

  async addAttendance(insertAttendance: InsertAttendance, gameId?: string | null, rosterId?: string | null): Promise<Attendance> {
    const teamId = getTeamId();
    const inserted = await db.insert(attendance).values({ ...insertAttendance, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateAttendance(id: string, updateData: Partial<InsertAttendance>): Promise<Attendance> {
    const teamId = getTeamId();
    const updated = await db.update(attendance).set(updateData).where(and(eq(attendance.id, id), eq(attendance.teamId, teamId))).returning();
    return updated[0];
  }

  async removeAttendance(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(attendance).where(and(eq(attendance.id, id), eq(attendance.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getTeamNotes(gameId?: string | null, rosterId?: string | null): Promise<TeamNotes[]> {
    const teamId = getTeamId();
    return await db.select().from(teamNotes).where(buildWhere(teamId, teamNotes, gameId, rosterId)).orderBy(teamNotes.timestamp);
  }

  async addTeamNote(insertTeamNote: InsertTeamNotes, gameId?: string | null, rosterId?: string | null): Promise<TeamNotes> {
    const teamId = getTeamId();
    const inserted = await db.insert(teamNotes).values({ ...insertTeamNote, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async deleteTeamNote(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(teamNotes).where(and(eq(teamNotes.id, id), eq(teamNotes.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getGamesByEventId(eventId: string): Promise<Game[]> {
    const teamId = getTeamId();
    return await db.select().from(games).where(and(eq(games.eventId, eventId), eq(games.teamId, teamId)));
  }

  async getAllGamesWithEventType(scope?: string, gameId?: string | null, rosterId?: string | null): Promise<(Game & { eventType: string })[]> {
    const teamId = getTeamId();
    const conditions = [eq(games.teamId, teamId)];
    if (gameId) conditions.push(eq(games.gameId, gameId));
    if (rosterId && games.rosterId) conditions.push(eq(games.rosterId, rosterId));
    const allGames = await db
      .select({
        id: games.id,
        teamId: games.teamId,
        gameId: games.gameId,
        eventId: games.eventId,
        gameCode: games.gameCode,
        score: games.score,
        imageUrl: games.imageUrl,
        gameModeId: games.gameModeId,
        mapId: games.mapId,
        result: games.result,
        link: games.link,
        matchId: games.matchId,
        eventType: events.eventType,
      })
      .from(games)
      .innerJoin(events, eq(games.eventId, events.id))
      .where(and(...conditions));

    if (scope === "scrim") return allGames.filter(g => g.eventType === "Scrim");
    if (scope === "tournament") return allGames.filter(g => g.eventType === "Tournament");
    return allGames;
  }

  async addGame(insertGame: InsertGame, gameId?: string | null, rosterId?: string | null): Promise<Game> {
    const teamId = getTeamId();
    const inserted = await db.insert(games).values({ ...insertGame, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateGame(id: string, updateData: Partial<InsertGame>): Promise<Game> {
    const teamId = getTeamId();
    const updated = await db.update(games).set(updateData).where(and(eq(games.id, id), eq(games.teamId, teamId))).returning();
    return updated[0];
  }

  async removeGame(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getAllGameModes(gameId?: string | null, rosterId?: string | null): Promise<GameMode[]> {
    const teamId = getTeamId();
    return await db.select().from(gameModes).where(buildWhere(teamId, gameModes, gameId, rosterId));
  }

  async addGameMode(insertGameMode: InsertGameMode, gameId?: string | null, rosterId?: string | null): Promise<GameMode> {
    const teamId = getTeamId();
    const inserted = await db.insert(gameModes).values({ ...insertGameMode, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateGameMode(id: string, updateData: Partial<InsertGameMode>): Promise<GameMode> {
    const teamId = getTeamId();
    const updated = await db.update(gameModes).set(updateData).where(and(eq(gameModes.id, id), eq(gameModes.teamId, teamId))).returning();
    return updated[0];
  }

  async removeGameMode(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(gameModes).where(and(eq(gameModes.id, id), eq(gameModes.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getAllMaps(gameId?: string | null, rosterId?: string | null): Promise<Map[]> {
    const teamId = getTeamId();
    return await db.select().from(maps).where(buildWhere(teamId, maps, gameId, rosterId));
  }

  async getMapsByGameModeId(gameModeId: string): Promise<Map[]> {
    const teamId = getTeamId();
    return await db.select().from(maps).where(and(eq(maps.gameModeId, gameModeId), eq(maps.teamId, teamId)));
  }

  async addMap(insertMap: InsertMap, gameId?: string | null, rosterId?: string | null): Promise<Map> {
    const teamId = getTeamId();
    const inserted = await db.insert(maps).values({ ...insertMap, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateMap(id: string, updateData: Partial<InsertMap>): Promise<Map> {
    const teamId = getTeamId();
    const updated = await db.update(maps).set(updateData).where(and(eq(maps.id, id), eq(maps.teamId, teamId))).returning();
    return updated[0];
  }

  async removeMap(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(maps).where(and(eq(maps.id, id), eq(maps.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getAllSeasons(gameId?: string | null, rosterId?: string | null): Promise<Season[]> {
    const teamId = getTeamId();
    return await db.select().from(seasons).where(buildWhere(teamId, seasons, gameId, rosterId));
  }

  async addSeason(insertSeason: InsertSeason, gameId?: string | null, rosterId?: string | null): Promise<Season> {
    const teamId = getTeamId();
    const inserted = await db.insert(seasons).values({ ...insertSeason, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateSeason(id: string, updateData: Partial<InsertSeason>): Promise<Season> {
    const teamId = getTeamId();
    const updated = await db.update(seasons).set(updateData).where(and(eq(seasons.id, id), eq(seasons.teamId, teamId))).returning();
    return updated[0];
  }

  async removeSeason(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(seasons).where(and(eq(seasons.id, id), eq(seasons.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getAllOffDays(gameId?: string | null, rosterId?: string | null): Promise<OffDay[]> {
    const teamId = getTeamId();
    return await db.select().from(offDays).where(buildWhere(teamId, offDays, gameId, rosterId));
  }

  async addOffDay(insertOffDay: InsertOffDay, gameId?: string | null, rosterId?: string | null): Promise<OffDay> {
    const teamId = getTeamId();
    const conditions = [eq(offDays.teamId, teamId), eq(offDays.date, insertOffDay.date)];
    if (gameId) conditions.push(eq(offDays.gameId, gameId));
    if (rosterId) conditions.push(eq(offDays.rosterId, rosterId));
    const existing = await db.select().from(offDays).where(and(...conditions)).limit(1);
    if (existing.length > 0) return existing[0];
    const inserted = await db.insert(offDays).values({ ...insertOffDay, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async removeOffDay(date: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions = [eq(offDays.date, date), eq(offDays.teamId, teamId)];
    if (gameId) conditions.push(eq(offDays.gameId, gameId));
    if (rosterId) conditions.push(eq(offDays.rosterId, rosterId));
    const deleted = await db.delete(offDays).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async removeOffDayById(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(offDays).where(and(eq(offDays.id, id), eq(offDays.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async duplicateEvent(eventId: string, gameId?: string | null, rosterId?: string | null): Promise<Event> {
    const teamId = getTeamId();
    const original = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.teamId, teamId))).limit(1);
    if (original.length === 0) throw new Error("Event not found");

    const event = original[0];
    const newEvent = await db
      .insert(events)
      .values({
        teamId,
        gameId: event.gameId || gameId,
        title: event.title + " (Copy)",
        eventType: event.eventType,
        date: event.date,
        time: event.time,
        description: event.description,
        seasonId: event.seasonId,
      })
      .returning();

    const originalGames = await db.select().from(games).where(and(eq(games.eventId, eventId), eq(games.teamId, teamId)));
    for (const game of originalGames) {
      await db.insert(games).values({
        teamId,
        gameId: game.gameId || gameId,
        eventId: newEvent[0].id,
        gameCode: game.gameCode,
        score: "",
        gameModeId: game.gameModeId,
        mapId: game.mapId,
      });
    }

    return newEvent[0];
  }

  async getAllStatFields(gameId?: string | null, rosterId?: string | null): Promise<StatField[]> {
    const teamId = getTeamId();
    return await db.select().from(statFields).where(buildWhere(teamId, statFields, gameId, rosterId));
  }

  async getStatFieldsByGameModeId(gameModeId: string): Promise<StatField[]> {
    const teamId = getTeamId();
    return await db.select().from(statFields).where(and(eq(statFields.gameModeId, gameModeId), eq(statFields.teamId, teamId)));
  }

  async addStatField(insertStatField: InsertStatField, gameId?: string | null, rosterId?: string | null): Promise<StatField> {
    const teamId = getTeamId();
    const inserted = await db.insert(statFields).values({ ...insertStatField, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateStatField(id: string, updateData: Partial<InsertStatField>): Promise<StatField> {
    const teamId = getTeamId();
    const updated = await db.update(statFields).set(updateData).where(and(eq(statFields.id, id), eq(statFields.teamId, teamId))).returning();
    return updated[0];
  }

  async removeStatField(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(statFields).where(and(eq(statFields.id, id), eq(statFields.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getPlayerGameStats(matchId: string): Promise<PlayerGameStat[]> {
    const teamId = getTeamId();
    return await db.select().from(playerGameStats).where(and(eq(playerGameStats.matchId, matchId), eq(playerGameStats.teamId, teamId)));
  }

  async savePlayerGameStats(matchId: string, stats: InsertPlayerGameStat[], gameId?: string | null, rosterId?: string | null): Promise<PlayerGameStat[]> {
    const teamId = getTeamId();
    await db.delete(playerGameStats).where(and(eq(playerGameStats.matchId, matchId), eq(playerGameStats.teamId, teamId)));
    if (stats.length === 0) return [];
    const inserted = await db.insert(playerGameStats).values(stats.map(s => ({ ...s, matchId, teamId, gameId }))).returning();
    return inserted;
  }

  async getPlayerAvailabilities(gameId?: string | null, rosterId?: string | null): Promise<PlayerAvailabilityRecord[]> {
    const teamId = getTeamId();
    return await db.select().from(playerAvailability).where(buildWhere(teamId, playerAvailability, gameId, rosterId));
  }

  async savePlayerAvailability(playerId: string, day: string, availability: string, gameId?: string | null, rosterId?: string | null): Promise<PlayerAvailabilityRecord> {
    const teamId = getTeamId();
    const existing = await db.select().from(playerAvailability)
      .where(and(eq(playerAvailability.teamId, teamId), eq(playerAvailability.playerId, playerId), eq(playerAvailability.day, day)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(playerAvailability).set({ availability }).where(eq(playerAvailability.id, existing[0].id)).returning();
      return updated;
    }

    const [inserted] = await db.insert(playerAvailability).values({ teamId, gameId, rosterId, playerId, day, availability }).returning();
    return inserted;
  }

  async deletePlayerAvailabilities(playerId: string): Promise<boolean> {
    const teamId = getTeamId();
    await db.delete(playerAvailability).where(and(eq(playerAvailability.playerId, playerId), eq(playerAvailability.teamId, teamId)));
    return true;
  }

  async getStaffAvailabilities(gameId?: string | null, rosterId?: string | null): Promise<StaffAvailabilityRecord[]> {
    const teamId = getTeamId();
    return await db.select().from(staffAvailability).where(buildWhere(teamId, staffAvailability, gameId, rosterId));
  }

  async saveStaffAvailability(staffId: string, day: string, availability: string, gameId?: string | null, rosterId?: string | null): Promise<StaffAvailabilityRecord> {
    const teamId = getTeamId();
    const existing = await db.select().from(staffAvailability)
      .where(and(eq(staffAvailability.teamId, teamId), eq(staffAvailability.staffId, staffId), eq(staffAvailability.day, day)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(staffAvailability).set({ availability }).where(eq(staffAvailability.id, existing[0].id)).returning();
      return updated;
    }

    const [inserted] = await db.insert(staffAvailability).values({ teamId, gameId, rosterId, staffId, day, availability }).returning();
    return inserted;
  }

  async deleteStaffAvailabilities(staffId: string): Promise<boolean> {
    const teamId = getTeamId();
    await db.delete(staffAvailability).where(and(eq(staffAvailability.staffId, staffId), eq(staffAvailability.teamId, teamId)));
    return true;
  }

  async getAllAvailabilitySlots(gameId?: string | null, rosterId?: string | null): Promise<AvailabilitySlot[]> {
    const teamId = getTeamId();
    return await db.select().from(availabilitySlots).where(buildWhere(teamId, availabilitySlots, gameId, rosterId));
  }

  async getAllRosterRoles(gameId?: string | null, rosterId?: string | null): Promise<RosterRole[]> {
    const teamId = getTeamId();
    return await db.select().from(rosterRoles).where(buildWhere(teamId, rosterRoles, gameId, rosterId));
  }

  async getAllStaff(gameId?: string | null, rosterId?: string | null): Promise<Staff[]> {
    const teamId = getTeamId();
    return await db.select().from(staffTable).where(buildWhere(teamId, staffTable, gameId, rosterId));
  }

  async getSupportedGames(): Promise<SupportedGame[]> {
    return await db.select().from(supportedGames).orderBy(supportedGames.sortOrder);
  }

  async getSupportedGameBySlug(slug: string): Promise<SupportedGame | undefined> {
    const result = await db.select().from(supportedGames).where(eq(supportedGames.slug, slug)).limit(1);
    return result[0];
  }

  async getUserGameAssignments(userId: string): Promise<UserGameAssignment[]> {
    const teamId = getTeamId();
    return await db.select().from(userGameAssignments)
      .where(and(eq(userGameAssignments.userId, userId), eq(userGameAssignments.teamId, teamId)));
  }

  async getAllPendingAssignments(gameId?: string | null, rosterId?: string | null): Promise<(UserGameAssignment & { username: string; gameName: string; gameSlug: string; rosterName: string | null })[]> {
    const teamId = getTeamId();
    const conditions = [
      eq(userGameAssignments.teamId, teamId),
      eq(userGameAssignments.status, "pending"),
    ];
    if (gameId) conditions.push(eq(userGameAssignments.gameId, gameId));
    if (rosterId) conditions.push(eq(userGameAssignments.rosterId, rosterId));

    const results = await db
      .select({
        id: userGameAssignments.id,
        teamId: userGameAssignments.teamId,
        userId: userGameAssignments.userId,
        gameId: userGameAssignments.gameId,
        rosterId: userGameAssignments.rosterId,
        assignedRole: userGameAssignments.assignedRole,
        status: userGameAssignments.status,
        approvalGameStatus: userGameAssignments.approvalGameStatus,
        approvalOrgStatus: userGameAssignments.approvalOrgStatus,
        createdAt: userGameAssignments.createdAt,
        username: users.username,
        gameName: supportedGames.name,
        gameSlug: supportedGames.slug,
        rosterName: rosters.name,
      })
      .from(userGameAssignments)
      .innerJoin(users, eq(userGameAssignments.userId, users.id))
      .innerJoin(supportedGames, eq(userGameAssignments.gameId, supportedGames.id))
      .leftJoin(rosters, eq(userGameAssignments.rosterId, rosters.id))
      .where(and(...conditions));

    return results;
  }

  async createUserGameAssignment(teamId: string, userId: string, gameId: string, assignedRole: string, rosterId?: string): Promise<UserGameAssignment> {
    const [inserted] = await db.insert(userGameAssignments)
      .values({ teamId, userId, gameId, assignedRole, status: "pending", ...(rosterId ? { rosterId } : {}) })
      .returning();
    return inserted;
  }

  async approveUserGameAssignment(id: string): Promise<UserGameAssignment> {
    const [updated] = await db.update(userGameAssignments)
      .set({ status: "approved" })
      .where(eq(userGameAssignments.id, id))
      .returning();
    return updated;
  }

  async rejectUserGameAssignment(id: string): Promise<UserGameAssignment> {
    const [updated] = await db.update(userGameAssignments)
      .set({ status: "rejected" })
      .where(eq(userGameAssignments.id, id))
      .returning();
    return updated;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const teamId = getTeamId();
    return await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.teamId, teamId)))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(teamId: string, userId: string, message: string, type: string, relatedId?: string): Promise<Notification> {
    const [inserted] = await db.insert(notifications)
      .values({ teamId, userId, message, type, relatedId })
      .returning();
    return inserted;
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification> {
    const [updated] = await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const teamId = getTeamId();
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.teamId, teamId)));
  }
}

export const storage = new DbStorage();
