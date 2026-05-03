import type { Player, InsertPlayer, Schedule, InsertSchedule, Setting, InsertSetting, Event, InsertEvent, Attendance, InsertAttendance, TeamNotes, InsertTeamNotes, Game, InsertGame, GameMode, InsertGameMode, Map, InsertMap, Season, InsertSeason, OffDay, InsertOffDay, StatField, InsertStatField, PlayerGameStat, InsertPlayerGameStat, PlayerAvailabilityRecord, InsertPlayerAvailability, StaffAvailabilityRecord, InsertStaffAvailability, Staff, InsertStaff, AvailabilitySlot, RosterRole, SupportedGame, UserGameAssignment, Notification, EventCategory, InsertEventCategory, EventSubType, InsertEventSubType, Side, InsertSide, GameRound, InsertGameRound, Hero, InsertHero, HeroRoleConfig, InsertHeroRoleConfig, GameHero, InsertGameHero, Opponent, InsertOpponent, OpponentPlayer, InsertOpponentPlayer, MatchParticipant, InsertMatchParticipant, OpponentPlayerGameStat, InsertOpponentPlayerGameStat, HeroBanSystem, InsertHeroBanSystem, MapVetoSystem, InsertMapVetoSystem, GameHeroBanAction, InsertGameHeroBanAction, GameMapVetoRow, InsertGameMapVetoRow, GameTemplate, GameTemplateConfig } from "@shared/schema";
import { players, schedules, settings, events, attendance, teamNotes, games, gameModes, maps, seasons, offDays, statFields, playerGameStats, playerAvailability, staffAvailability, staff as staffTable, availabilitySlots, rosterRoles, supportedGames, userGameAssignments, notifications, users, rosters, eventCategories, eventSubTypes, sides, gameRounds, heroes, heroRoleConfigs, gameHeroes, opponents, opponentPlayers, matchParticipants, opponentPlayerGameStats, heroBanSystems, mapVetoSystems, gameHeroBanActions, gameMapVetoRows, gameTemplates, mediaFolders, mediaItems } from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import { getGameDefaults, defaultIgn } from "./defaults/gameDefaults";
import { OPPONENT_SEEDS_BY_GAME_SLUG } from "./defaults/realOpponents";

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
  updateEvent(id: string, event: Partial<InsertEvent>, gameId?: string | null, rosterId?: string | null): Promise<Event>;
  removeEvent(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getAllAttendance(gameId?: string | null, rosterId?: string | null): Promise<Attendance[]>;
  getAttendanceByPlayerId(playerId: string): Promise<Attendance[]>;
  addAttendance(attendance: InsertAttendance, gameId?: string | null, rosterId?: string | null): Promise<Attendance>;
  updateAttendance(id: string, attendance: Partial<InsertAttendance>): Promise<Attendance>;
  removeAttendance(id: string): Promise<boolean>;
  getTeamNotes(gameId?: string | null, rosterId?: string | null): Promise<TeamNotes[]>;
  addTeamNote(note: InsertTeamNotes, gameId?: string | null, rosterId?: string | null): Promise<TeamNotes>;
  deleteTeamNote(id: string): Promise<boolean>;
  getGamesByEventId(eventId: string, gameId?: string | null, rosterId?: string | null): Promise<Game[]>;
  getAllGamesWithEventType(scope?: string, gameId?: string | null, rosterId?: string | null): Promise<(Game & { eventType: string })[]>;
  addGame(game: InsertGame, gameId?: string | null, rosterId?: string | null): Promise<Game>;
  updateGame(id: string, game: Partial<InsertGame>, gameId?: string | null, rosterId?: string | null): Promise<Game>;
  removeGame(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getAllGameModes(gameId?: string | null, rosterId?: string | null): Promise<GameMode[]>;
  addGameMode(gameMode: InsertGameMode, gameId?: string | null, rosterId?: string | null): Promise<GameMode>;
  updateGameMode(id: string, gameMode: Partial<InsertGameMode>, gameId?: string | null, rosterId?: string | null): Promise<GameMode>;
  removeGameMode(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getAllHeroes(gameId?: string | null, rosterId?: string | null): Promise<Hero[]>;
  addHero(hero: InsertHero, gameId?: string | null, rosterId?: string | null): Promise<Hero>;
  updateHero(id: string, hero: Partial<InsertHero>, gameId?: string | null, rosterId?: string | null): Promise<Hero | undefined>;
  removeHero(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  bulkInsertHeroes(rows: InsertHero[], gameId?: string | null, rosterId?: string | null): Promise<Hero[]>;
  getAllHeroRoleConfigs(gameId?: string | null): Promise<HeroRoleConfig[]>;
  addHeroRoleConfig(row: InsertHeroRoleConfig, gameId?: string | null): Promise<HeroRoleConfig>;
  updateHeroRoleConfig(id: string, row: Partial<InsertHeroRoleConfig>, gameId?: string | null): Promise<HeroRoleConfig | undefined>;
  removeHeroRoleConfig(id: string, gameId?: string | null): Promise<boolean>;
  bulkInsertHeroRoleConfigs(rows: InsertHeroRoleConfig[], gameId?: string | null): Promise<HeroRoleConfig[]>;
  getAllHeroBanSystems(gameId?: string | null, rosterId?: string | null): Promise<HeroBanSystem[]>;
  getHeroBanSystem(id: string): Promise<HeroBanSystem | undefined>;
  addHeroBanSystem(s: InsertHeroBanSystem, gameId?: string | null, rosterId?: string | null): Promise<HeroBanSystem>;
  updateHeroBanSystem(id: string, s: Partial<InsertHeroBanSystem>, gameId?: string | null, rosterId?: string | null): Promise<HeroBanSystem | undefined>;
  removeHeroBanSystem(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getAllMapVetoSystems(gameId?: string | null, rosterId?: string | null): Promise<MapVetoSystem[]>;
  getMapVetoSystem(id: string): Promise<MapVetoSystem | undefined>;
  addMapVetoSystem(s: InsertMapVetoSystem, gameId?: string | null, rosterId?: string | null): Promise<MapVetoSystem>;
  updateMapVetoSystem(id: string, s: Partial<InsertMapVetoSystem>, gameId?: string | null, rosterId?: string | null): Promise<MapVetoSystem | undefined>;
  removeMapVetoSystem(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getHeroBanActionsByMatchId(matchId: string): Promise<GameHeroBanAction[]>;
  getHeroBanActionsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<GameHeroBanAction[]>;
  replaceHeroBanActions(matchId: string, rows: Omit<InsertGameHeroBanAction, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<GameHeroBanAction[]>;
  getMapVetoRowsByMatchId(matchId: string): Promise<GameMapVetoRow[]>;
  getMapVetoRowsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<GameMapVetoRow[]>;
  replaceMapVetoRows(matchId: string, rows: Omit<InsertGameMapVetoRow, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<GameMapVetoRow[]>;
  getGameHeroesByMatchId(matchId: string): Promise<GameHero[]>;
  getGameHeroesByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<GameHero[]>;
  addGameHero(gameHero: InsertGameHero, gameId?: string | null, rosterId?: string | null): Promise<GameHero>;
  removeGameHero(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  replaceGameHeroes(matchId: string, rows: Omit<InsertGameHero, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<GameHero[]>;
  getAllOpponents(gameId?: string | null, rosterId?: string | null): Promise<Opponent[]>;
  getOpponent(id: string): Promise<Opponent | undefined>;
  addOpponent(opp: InsertOpponent, gameId?: string | null, rosterId?: string | null): Promise<Opponent>;
  updateOpponent(id: string, opp: Partial<InsertOpponent>, gameId?: string | null, rosterId?: string | null): Promise<Opponent | undefined>;
  removeOpponent(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getOpponentPlayersByOpponentId(opponentId: string): Promise<OpponentPlayer[]>;
  getOpponentPlayersByRoster(gameId: string, rosterId: string): Promise<OpponentPlayer[]>;
  getOpponentPlayerGameStatsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<OpponentPlayerGameStat[]>;
  getOpponentPlayer(id: string): Promise<OpponentPlayer | undefined>;
  addOpponentPlayer(p: InsertOpponentPlayer, gameId?: string | null, rosterId?: string | null): Promise<OpponentPlayer>;
  updateOpponentPlayer(id: string, p: Partial<InsertOpponentPlayer>): Promise<OpponentPlayer | undefined>;
  removeOpponentPlayer(id: string): Promise<boolean>;
  getMatchParticipants(matchId: string): Promise<MatchParticipant[]>;
  getMatchParticipantsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<MatchParticipant[]>;
  replaceMatchParticipants(matchId: string, rows: Omit<InsertMatchParticipant, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<MatchParticipant[]>;
  getOpponentPlayerGameStats(matchId: string): Promise<OpponentPlayerGameStat[]>;
  saveOpponentPlayerGameStats(matchId: string, stats: InsertOpponentPlayerGameStat[], gameId?: string | null): Promise<OpponentPlayerGameStat[]>;
  getAllMaps(gameId?: string | null, rosterId?: string | null): Promise<Map[]>;
  getMapsByGameModeId(gameModeId: string): Promise<Map[]>;
  addMap(map: InsertMap, gameId?: string | null, rosterId?: string | null): Promise<Map>;
  updateMap(id: string, map: Partial<InsertMap>, gameId?: string | null, rosterId?: string | null): Promise<Map>;
  removeMap(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getAllEventCategories(gameId?: string | null, rosterId?: string | null): Promise<EventCategory[]>;
  addEventCategory(cat: InsertEventCategory, gameId?: string | null, rosterId?: string | null): Promise<EventCategory>;
  updateEventCategory(id: string, cat: Partial<InsertEventCategory>, gameId?: string | null, rosterId?: string | null): Promise<EventCategory>;
  removeEventCategory(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getAllEventSubTypes(gameId?: string | null, rosterId?: string | null): Promise<EventSubType[]>;
  getEventSubTypesByCategory(categoryId: string): Promise<EventSubType[]>;
  addEventSubType(sub: InsertEventSubType, gameId?: string | null, rosterId?: string | null): Promise<EventSubType>;
  updateEventSubType(id: string, sub: Partial<InsertEventSubType>, gameId?: string | null, rosterId?: string | null): Promise<EventSubType>;
  removeEventSubType(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getAttendanceByEventId(eventId: string, gameId?: string | null, rosterId?: string | null): Promise<Attendance[]>;
  getAllSeasons(gameId?: string | null, rosterId?: string | null): Promise<Season[]>;
  addSeason(season: InsertSeason, gameId?: string | null, rosterId?: string | null): Promise<Season>;
  updateSeason(id: string, season: Partial<InsertSeason>, gameId?: string | null, rosterId?: string | null): Promise<Season>;
  removeSeason(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getAllOffDays(gameId?: string | null, rosterId?: string | null): Promise<OffDay[]>;
  addOffDay(offDay: InsertOffDay, gameId?: string | null, rosterId?: string | null): Promise<OffDay>;
  removeOffDay(date: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  removeOffDayById(id: string): Promise<boolean>;
  getAllSides(gameId?: string | null, rosterId?: string | null): Promise<Side[]>;
  addSide(side: InsertSide, gameId?: string | null, rosterId?: string | null): Promise<Side>;
  updateSide(id: string, side: Partial<InsertSide>, gameId?: string | null, rosterId?: string | null): Promise<Side>;
  removeSide(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getRoundsForGame(matchId: string): Promise<GameRound[]>;
  getGameRoundsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<GameRound[]>;
  replaceRoundsForGame(matchId: string, rounds: Omit<InsertGameRound, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<GameRound[]>;
  duplicateEvent(eventId: string, gameId?: string | null, rosterId?: string | null): Promise<Event>;
  getAllStatFields(gameId?: string | null, rosterId?: string | null): Promise<StatField[]>;
  getStatFieldsByGameModeId(gameModeId: string): Promise<StatField[]>;
  addStatField(statField: InsertStatField, gameId?: string | null, rosterId?: string | null): Promise<StatField>;
  updateStatField(id: string, statField: Partial<InsertStatField>, gameId?: string | null, rosterId?: string | null): Promise<StatField>;
  removeStatField(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean>;
  getPlayerGameStats(matchId: string, gameId?: string | null, rosterId?: string | null): Promise<PlayerGameStat[]>;
  getPlayerGameStatsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<PlayerGameStat[]>;
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
  getAllGameTemplates(): Promise<GameTemplate[]>;
  getGameTemplate(id: string): Promise<GameTemplate | undefined>;
  getGameTemplateByCode(code: string): Promise<GameTemplate | undefined>;
  createGameTemplate(name: string, gameId: string, code: string, config: any): Promise<GameTemplate>;
  updateGameTemplate(id: string, fields: { name?: string; config?: any }): Promise<GameTemplate | undefined>;
  deleteGameTemplate(id: string): Promise<boolean>;
  applyGameTemplate(templateId: string, rosterId: string, gameId: string): Promise<{ ok: true }>;
  findDefaultTemplateForGame(gameId: string): Promise<GameTemplate | undefined>;
  seedNewRoster(rosterId: string, gameId: string, opts?: { templateId?: string; force?: boolean }): Promise<SeedRosterResult>;
}

export interface SeedRosterResult {
  source: "template" | "defaults" | "skipped";
  templateId?: string;
  templateName?: string;
  counts: {
    rosterRoles: number;
    heroRoles: number;
    sides: number;
    eventCategories: number;
    eventSubTypes: number;
    gameModes: number;
    maps: number;
    statFields: number;
    heroes: number;
    heroBanSystems: number;
    mapVetoSystems: number;
    opponents: number;
    opponentPlayers: number;
  };
  warnings: string[];
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

  async updateEvent(id: string, updateData: Partial<InsertEvent>, gameId?: string | null, rosterId?: string | null): Promise<Event> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(events.id, id), eq(events.teamId, teamId)];
    if (gameId) conditions.push(eq(events.gameId, gameId));
    if (rosterId) conditions.push(eq(events.rosterId, rosterId));
    const updated = await db.update(events).set(updateData).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeEvent(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(events.id, id), eq(events.teamId, teamId)];
    if (gameId) conditions.push(eq(events.gameId, gameId));
    if (rosterId) conditions.push(eq(events.rosterId, rosterId));
    const deleted = await db.delete(events).where(and(...conditions)).returning();
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

  async getGamesByEventId(eventId: string, gameId?: string | null, rosterId?: string | null): Promise<Game[]> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(games.eventId, eventId), eq(games.teamId, teamId)];
    if (gameId) conditions.push(eq(games.gameId, gameId));
    if (rosterId) conditions.push(eq(games.rosterId, rosterId));
    return await db.select().from(games).where(and(...conditions));
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
        rosterId: games.rosterId,
        eventId: games.eventId,
        gameCode: games.gameCode,
        score: games.score,
        imageUrl: games.imageUrl,
        gameModeId: games.gameModeId,
        mapId: games.mapId,
        result: games.result,
        link: games.link,
        opponentId: games.opponentId,
        heroBanSystemId: games.heroBanSystemId,
        mapVetoSystemId: games.mapVetoSystemId,
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

  async updateGame(id: string, updateData: Partial<InsertGame>, gameId?: string | null, rosterId?: string | null): Promise<Game> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(games.id, id), eq(games.teamId, teamId)];
    if (gameId) conditions.push(eq(games.gameId, gameId));
    if (rosterId) conditions.push(eq(games.rosterId, rosterId));
    const updated = await db.update(games).set(updateData).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeGame(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(games.id, id), eq(games.teamId, teamId)];
    if (gameId) conditions.push(eq(games.gameId, gameId));
    if (rosterId) conditions.push(eq(games.rosterId, rosterId));
    const deleted = await db.delete(games).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async getAllGameModes(gameId?: string | null, _rosterId?: string | null): Promise<GameMode[]> {
    const teamId = getTeamId();
    return await db.select().from(gameModes).where(buildWhere(teamId, gameModes, gameId, null));
  }

  async addGameMode(insertGameMode: InsertGameMode, gameId?: string | null, _rosterId?: string | null): Promise<GameMode> {
    const teamId = getTeamId();
    const inserted = await db.insert(gameModes).values({ ...insertGameMode, teamId, gameId, rosterId: null }).returning();
    return inserted[0];
  }

  async updateGameMode(id: string, updateData: Partial<InsertGameMode>, gameId?: string | null, _rosterId?: string | null): Promise<GameMode> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(gameModes.id, id), eq(gameModes.teamId, teamId)];
    if (gameId) conditions.push(eq(gameModes.gameId, gameId));
    const updated = await db.update(gameModes).set(updateData).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeGameMode(id: string, gameId?: string | null, _rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(gameModes.id, id), eq(gameModes.teamId, teamId)];
    if (gameId) conditions.push(eq(gameModes.gameId, gameId));
    const deleted = await db.delete(gameModes).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async getAllHeroes(gameId?: string | null, _rosterId?: string | null): Promise<Hero[]> {
    const teamId = getTeamId();
    return await db.select().from(heroes).where(buildWhere(teamId, heroes, gameId, null));
  }

  async addHero(insertHero: InsertHero, gameId?: string | null, _rosterId?: string | null): Promise<Hero> {
    const teamId = getTeamId();
    const inserted = await db.insert(heroes).values({ ...insertHero, teamId, gameId, rosterId: null }).returning();
    return inserted[0];
  }

  async updateHero(id: string, updateData: Partial<InsertHero>, gameId?: string | null, _rosterId?: string | null): Promise<Hero | undefined> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(heroes.id, id), eq(heroes.teamId, teamId)];
    if (gameId) conditions.push(eq(heroes.gameId, gameId));
    const updated = await db.update(heroes).set(updateData).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeHero(id: string, gameId?: string | null, _rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(heroes.id, id), eq(heroes.teamId, teamId)];
    if (gameId) conditions.push(eq(heroes.gameId, gameId));
    const deleted = await db.delete(heroes).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async bulkInsertHeroes(rows: InsertHero[], gameId?: string | null, _rosterId?: string | null): Promise<Hero[]> {
    if (rows.length === 0) return [];
    const teamId = getTeamId();
    const inserted = await db.insert(heroes).values(rows.map(r => ({ ...r, teamId, gameId, rosterId: null }))).returning();
    return inserted;
  }

  async getAllHeroRoleConfigs(gameId?: string | null): Promise<HeroRoleConfig[]> {
    const teamId = getTeamId();
    const conds: any[] = [eq(heroRoleConfigs.teamId, teamId)];
    if (gameId) conds.push(eq(heroRoleConfigs.gameId, gameId));
    return await db.select().from(heroRoleConfigs).where(and(...conds));
  }

  async addHeroRoleConfig(row: InsertHeroRoleConfig, gameId?: string | null): Promise<HeroRoleConfig> {
    const teamId = getTeamId();
    if (!gameId) throw new Error("gameId is required for hero role config");
    const inserted = await db.insert(heroRoleConfigs).values({ ...row, teamId, gameId }).returning();
    return inserted[0];
  }

  async updateHeroRoleConfig(id: string, row: Partial<InsertHeroRoleConfig>, gameId?: string | null): Promise<HeroRoleConfig | undefined> {
    const teamId = getTeamId();
    const conds: any[] = [eq(heroRoleConfigs.id, id), eq(heroRoleConfigs.teamId, teamId)];
    if (gameId) conds.push(eq(heroRoleConfigs.gameId, gameId));
    const updated = await db.update(heroRoleConfigs).set(row).where(and(...conds)).returning();
    return updated[0];
  }

  async removeHeroRoleConfig(id: string, gameId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conds: any[] = [eq(heroRoleConfigs.id, id), eq(heroRoleConfigs.teamId, teamId)];
    if (gameId) conds.push(eq(heroRoleConfigs.gameId, gameId));
    const deleted = await db.delete(heroRoleConfigs).where(and(...conds)).returning();
    return deleted.length > 0;
  }

  async bulkInsertHeroRoleConfigs(rows: InsertHeroRoleConfig[], gameId?: string | null): Promise<HeroRoleConfig[]> {
    if (rows.length === 0) return [];
    const teamId = getTeamId();
    if (!gameId) throw new Error("gameId is required for hero role config");
    const inserted = await db.insert(heroRoleConfigs).values(rows.map(r => ({ ...r, teamId, gameId }))).returning();
    return inserted;
  }

  async getAllHeroBanSystems(gameId?: string | null, rosterId?: string | null): Promise<HeroBanSystem[]> {
    const teamId = getTeamId();
    return await db.select().from(heroBanSystems).where(buildWhere(teamId, heroBanSystems, gameId, rosterId));
  }

  async getHeroBanSystem(id: string): Promise<HeroBanSystem | undefined> {
    const teamId = getTeamId();
    const rows = await db.select().from(heroBanSystems).where(and(eq(heroBanSystems.id, id), eq(heroBanSystems.teamId, teamId)));
    return rows[0];
  }

  async addHeroBanSystem(s: InsertHeroBanSystem, gameId?: string | null, rosterId?: string | null): Promise<HeroBanSystem> {
    const teamId = getTeamId();
    const inserted = await db.insert(heroBanSystems).values({ ...s, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateHeroBanSystem(id: string, s: Partial<InsertHeroBanSystem>, gameId?: string | null, rosterId?: string | null): Promise<HeroBanSystem | undefined> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(heroBanSystems.id, id), eq(heroBanSystems.teamId, teamId)];
    if (gameId) conditions.push(eq(heroBanSystems.gameId, gameId));
    if (rosterId) conditions.push(eq(heroBanSystems.rosterId, rosterId));
    const updated = await db.update(heroBanSystems).set(s).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeHeroBanSystem(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(heroBanSystems.id, id), eq(heroBanSystems.teamId, teamId)];
    if (gameId) conditions.push(eq(heroBanSystems.gameId, gameId));
    if (rosterId) conditions.push(eq(heroBanSystems.rosterId, rosterId));
    return await db.transaction(async (tx) => {
      await tx.update(games).set({ heroBanSystemId: null }).where(and(eq(games.heroBanSystemId, id), eq(games.teamId, teamId)));
      const deleted = await tx.delete(heroBanSystems).where(and(...conditions)).returning();
      return deleted.length > 0;
    });
  }

  async getAllMapVetoSystems(gameId?: string | null, rosterId?: string | null): Promise<MapVetoSystem[]> {
    const teamId = getTeamId();
    return await db.select().from(mapVetoSystems).where(buildWhere(teamId, mapVetoSystems, gameId, rosterId));
  }

  async getMapVetoSystem(id: string): Promise<MapVetoSystem | undefined> {
    const teamId = getTeamId();
    const rows = await db.select().from(mapVetoSystems).where(and(eq(mapVetoSystems.id, id), eq(mapVetoSystems.teamId, teamId)));
    return rows[0];
  }

  async addMapVetoSystem(s: InsertMapVetoSystem, gameId?: string | null, rosterId?: string | null): Promise<MapVetoSystem> {
    const teamId = getTeamId();
    const inserted = await db.insert(mapVetoSystems).values({ ...s, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateMapVetoSystem(id: string, s: Partial<InsertMapVetoSystem>, gameId?: string | null, rosterId?: string | null): Promise<MapVetoSystem | undefined> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(mapVetoSystems.id, id), eq(mapVetoSystems.teamId, teamId)];
    if (gameId) conditions.push(eq(mapVetoSystems.gameId, gameId));
    if (rosterId) conditions.push(eq(mapVetoSystems.rosterId, rosterId));
    const updated = await db.update(mapVetoSystems).set(s).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeMapVetoSystem(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(mapVetoSystems.id, id), eq(mapVetoSystems.teamId, teamId)];
    if (gameId) conditions.push(eq(mapVetoSystems.gameId, gameId));
    if (rosterId) conditions.push(eq(mapVetoSystems.rosterId, rosterId));
    return await db.transaction(async (tx) => {
      await tx.update(games).set({ mapVetoSystemId: null }).where(and(eq(games.mapVetoSystemId, id), eq(games.teamId, teamId)));
      const deleted = await tx.delete(mapVetoSystems).where(and(...conditions)).returning();
      return deleted.length > 0;
    });
  }

  async getHeroBanActionsByMatchId(matchId: string): Promise<GameHeroBanAction[]> {
    const teamId = getTeamId();
    return await db.select().from(gameHeroBanActions).where(and(eq(gameHeroBanActions.matchId, matchId), eq(gameHeroBanActions.teamId, teamId)));
  }

  async getHeroBanActionsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<GameHeroBanAction[]> {
    const teamId = getTeamId();
    if (opponentId) {
      const rows = await db.select({ a: gameHeroBanActions })
        .from(gameHeroBanActions)
        .innerJoin(games, eq(gameHeroBanActions.matchId, games.id))
        .where(and(
          eq(gameHeroBanActions.teamId, teamId),
          eq(gameHeroBanActions.gameId, gameId),
          eq(gameHeroBanActions.rosterId, rosterId),
          eq(games.opponentId, opponentId),
        ));
      return rows.map(r => r.a);
    }
    return await db.select().from(gameHeroBanActions).where(and(
      eq(gameHeroBanActions.teamId, teamId),
      eq(gameHeroBanActions.gameId, gameId),
      eq(gameHeroBanActions.rosterId, rosterId),
    ));
  }

  async replaceHeroBanActions(matchId: string, rows: Omit<InsertGameHeroBanAction, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<GameHeroBanAction[]> {
    const teamId = getTeamId();
    return await db.transaction(async (tx) => {
      await tx.delete(gameHeroBanActions).where(and(eq(gameHeroBanActions.matchId, matchId), eq(gameHeroBanActions.teamId, teamId)));
      if (rows.length === 0) return [];
      const inserted = await tx.insert(gameHeroBanActions).values(rows.map(r => ({ ...r, matchId, teamId, gameId, rosterId }))).returning();
      return inserted;
    });
  }

  async getMapVetoRowsByMatchId(matchId: string): Promise<GameMapVetoRow[]> {
    const teamId = getTeamId();
    return await db.select().from(gameMapVetoRows).where(and(eq(gameMapVetoRows.matchId, matchId), eq(gameMapVetoRows.teamId, teamId)));
  }

  async getMapVetoRowsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<GameMapVetoRow[]> {
    const teamId = getTeamId();
    if (opponentId) {
      const rows = await db.select({ r: gameMapVetoRows })
        .from(gameMapVetoRows)
        .innerJoin(games, eq(gameMapVetoRows.matchId, games.id))
        .where(and(
          eq(gameMapVetoRows.teamId, teamId),
          eq(gameMapVetoRows.gameId, gameId),
          eq(gameMapVetoRows.rosterId, rosterId),
          eq(games.opponentId, opponentId),
        ));
      return rows.map(r => r.r);
    }
    return await db.select().from(gameMapVetoRows).where(and(
      eq(gameMapVetoRows.teamId, teamId),
      eq(gameMapVetoRows.gameId, gameId),
      eq(gameMapVetoRows.rosterId, rosterId),
    ));
  }

  async replaceMapVetoRows(matchId: string, rows: Omit<InsertGameMapVetoRow, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<GameMapVetoRow[]> {
    const teamId = getTeamId();
    return await db.transaction(async (tx) => {
      await tx.delete(gameMapVetoRows).where(and(eq(gameMapVetoRows.matchId, matchId), eq(gameMapVetoRows.teamId, teamId)));
      if (rows.length === 0) return [];
      const inserted = await tx.insert(gameMapVetoRows).values(rows.map(r => ({ ...r, matchId, teamId, gameId, rosterId }))).returning();
      return inserted;
    });
  }

  async getGameHeroesByMatchId(matchId: string): Promise<GameHero[]> {
    const teamId = getTeamId();
    return await db.select().from(gameHeroes).where(and(eq(gameHeroes.matchId, matchId), eq(gameHeroes.teamId, teamId)));
  }

  async getGameHeroesByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<GameHero[]> {
    const teamId = getTeamId();
    if (opponentId) {
      const rows = await db.select({ h: gameHeroes })
        .from(gameHeroes)
        .innerJoin(games, eq(gameHeroes.matchId, games.id))
        .where(and(
          eq(gameHeroes.teamId, teamId),
          eq(gameHeroes.gameId, gameId),
          eq(gameHeroes.rosterId, rosterId),
          eq(games.opponentId, opponentId),
        ));
      return rows.map(r => r.h);
    }
    return await db.select().from(gameHeroes).where(and(
      eq(gameHeroes.teamId, teamId),
      eq(gameHeroes.gameId, gameId),
      eq(gameHeroes.rosterId, rosterId),
    ));
  }

  async addGameHero(insertGameHero: InsertGameHero, gameId?: string | null, rosterId?: string | null): Promise<GameHero> {
    const teamId = getTeamId();
    const inserted = await db.insert(gameHeroes).values({ ...insertGameHero, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async removeGameHero(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(gameHeroes.id, id), eq(gameHeroes.teamId, teamId)];
    if (gameId) conditions.push(eq(gameHeroes.gameId, gameId));
    if (rosterId) conditions.push(eq(gameHeroes.rosterId, rosterId));
    const deleted = await db.delete(gameHeroes).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async replaceGameHeroes(matchId: string, rows: Omit<InsertGameHero, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<GameHero[]> {
    const teamId = getTeamId();
    return await db.transaction(async (tx) => {
      await tx.delete(gameHeroes).where(and(eq(gameHeroes.matchId, matchId), eq(gameHeroes.teamId, teamId)));
      if (rows.length === 0) return [];
      const inserted = await tx.insert(gameHeroes).values(rows.map(r => ({ ...r, matchId, teamId, gameId, rosterId }))).returning();
      return inserted;
    });
  }

  async getAllMaps(gameId?: string | null, _rosterId?: string | null): Promise<Map[]> {
    const teamId = getTeamId();
    return await db.select().from(maps).where(buildWhere(teamId, maps, gameId, null));
  }

  async getMapsByGameModeId(gameModeId: string): Promise<Map[]> {
    const teamId = getTeamId();
    return await db.select().from(maps).where(and(eq(maps.gameModeId, gameModeId), eq(maps.teamId, teamId)));
  }

  async addMap(insertMap: InsertMap, gameId?: string | null, _rosterId?: string | null): Promise<Map> {
    const teamId = getTeamId();
    const inserted = await db.insert(maps).values({ ...insertMap, teamId, gameId, rosterId: null }).returning();
    return inserted[0];
  }

  async updateMap(id: string, updateData: Partial<InsertMap>, gameId?: string | null, _rosterId?: string | null): Promise<Map> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(maps.id, id), eq(maps.teamId, teamId)];
    if (gameId) conditions.push(eq(maps.gameId, gameId));
    const updated = await db.update(maps).set(updateData).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeMap(id: string, gameId?: string | null, _rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(maps.id, id), eq(maps.teamId, teamId)];
    if (gameId) conditions.push(eq(maps.gameId, gameId));
    const deleted = await db.delete(maps).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async getAllEventCategories(gameId?: string | null, rosterId?: string | null): Promise<EventCategory[]> {
    const teamId = getTeamId();
    return await db.select().from(eventCategories).where(buildWhere(teamId, eventCategories, gameId, rosterId));
  }

  async addEventCategory(cat: InsertEventCategory, gameId?: string | null, rosterId?: string | null): Promise<EventCategory> {
    const teamId = getTeamId();
    const inserted = await db.insert(eventCategories).values({ ...cat, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateEventCategory(id: string, cat: Partial<InsertEventCategory>, gameId?: string | null, rosterId?: string | null): Promise<EventCategory> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(eventCategories.id, id), eq(eventCategories.teamId, teamId)];
    if (gameId) conditions.push(eq(eventCategories.gameId, gameId));
    if (rosterId) conditions.push(eq(eventCategories.rosterId, rosterId));
    const updated = await db.update(eventCategories).set(cat).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeEventCategory(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(eventCategories.id, id), eq(eventCategories.teamId, teamId)];
    if (gameId) conditions.push(eq(eventCategories.gameId, gameId));
    if (rosterId) conditions.push(eq(eventCategories.rosterId, rosterId));
    const deleted = await db.delete(eventCategories).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async getAllEventSubTypes(gameId?: string | null, rosterId?: string | null): Promise<EventSubType[]> {
    const teamId = getTeamId();
    return await db.select().from(eventSubTypes).where(buildWhere(teamId, eventSubTypes, gameId, rosterId));
  }

  async getEventSubTypesByCategory(categoryId: string): Promise<EventSubType[]> {
    const teamId = getTeamId();
    return await db.select().from(eventSubTypes).where(and(eq(eventSubTypes.categoryId, categoryId), eq(eventSubTypes.teamId, teamId)));
  }

  async addEventSubType(sub: InsertEventSubType, gameId?: string | null, rosterId?: string | null): Promise<EventSubType> {
    const teamId = getTeamId();
    const inserted = await db.insert(eventSubTypes).values({ ...sub, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateEventSubType(id: string, sub: Partial<InsertEventSubType>, gameId?: string | null, rosterId?: string | null): Promise<EventSubType> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(eventSubTypes.id, id), eq(eventSubTypes.teamId, teamId)];
    if (gameId) conditions.push(eq(eventSubTypes.gameId, gameId));
    if (rosterId) conditions.push(eq(eventSubTypes.rosterId, rosterId));
    const updated = await db.update(eventSubTypes).set(sub).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeEventSubType(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(eventSubTypes.id, id), eq(eventSubTypes.teamId, teamId)];
    if (gameId) conditions.push(eq(eventSubTypes.gameId, gameId));
    if (rosterId) conditions.push(eq(eventSubTypes.rosterId, rosterId));
    const deleted = await db.delete(eventSubTypes).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async getAttendanceByEventId(eventId: string, gameId?: string | null, rosterId?: string | null): Promise<Attendance[]> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(attendance.eventId, eventId), eq(attendance.teamId, teamId)];
    if (gameId) conditions.push(eq(attendance.gameId, gameId));
    if (rosterId) conditions.push(eq(attendance.rosterId, rosterId));
    return await db.select().from(attendance).where(and(...conditions));
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

  async updateSeason(id: string, updateData: Partial<InsertSeason>, gameId?: string | null, rosterId?: string | null): Promise<Season> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(seasons.id, id), eq(seasons.teamId, teamId)];
    if (gameId) conditions.push(eq(seasons.gameId, gameId));
    if (rosterId) conditions.push(eq(seasons.rosterId, rosterId));
    const updated = await db.update(seasons).set(updateData).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeSeason(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(seasons.id, id), eq(seasons.teamId, teamId)];
    if (gameId) conditions.push(eq(seasons.gameId, gameId));
    if (rosterId) conditions.push(eq(seasons.rosterId, rosterId));
    const deleted = await db.delete(seasons).where(and(...conditions)).returning();
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

  async getAllSides(gameId?: string | null, rosterId?: string | null): Promise<Side[]> {
    const teamId = getTeamId();
    return await db.select().from(sides).where(buildWhere(teamId, sides, gameId, rosterId));
  }

  async addSide(side: InsertSide, gameId?: string | null, rosterId?: string | null): Promise<Side> {
    const teamId = getTeamId();
    const inserted = await db.insert(sides).values({ ...side, teamId, gameId, rosterId }).returning();
    return inserted[0];
  }

  async updateSide(id: string, side: Partial<InsertSide>, gameId?: string | null, rosterId?: string | null): Promise<Side> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(sides.id, id), eq(sides.teamId, teamId)];
    if (gameId) conditions.push(eq(sides.gameId, gameId));
    if (rosterId) conditions.push(eq(sides.rosterId, rosterId));
    const updated = await db.update(sides).set(side).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeSide(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(sides.id, id), eq(sides.teamId, teamId)];
    if (gameId) conditions.push(eq(sides.gameId, gameId));
    if (rosterId) conditions.push(eq(sides.rosterId, rosterId));
    const deleted = await db.delete(sides).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async getRoundsForGame(matchId: string): Promise<GameRound[]> {
    const teamId = getTeamId();
    return await db.select().from(gameRounds)
      .where(and(eq(gameRounds.matchId, matchId), eq(gameRounds.teamId, teamId)));
  }

  async getGameRoundsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<GameRound[]> {
    const teamId = getTeamId();
    const conditions: any[] = [
      eq(gameRounds.teamId, teamId),
      eq(gameRounds.gameId, gameId),
      eq(games.rosterId, rosterId),
    ];
    if (opponentId) conditions.push(eq(games.opponentId, opponentId));
    const rows = await db.select({ r: gameRounds })
      .from(gameRounds)
      .innerJoin(games, eq(gameRounds.matchId, games.id))
      .where(and(...conditions));
    return rows.map(r => r.r);
  }

  async replaceRoundsForGame(matchId: string, rounds: Omit<InsertGameRound, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<GameRound[]> {
    const teamId = getTeamId();
    await db.delete(gameRounds).where(and(eq(gameRounds.matchId, matchId), eq(gameRounds.teamId, teamId)));
    if (rounds.length === 0) return [];
    const rows = rounds.map(r => ({ ...r, matchId, teamId, gameId: gameId ?? null, rosterId: rosterId ?? null }));
    const inserted = await db.insert(gameRounds).values(rows).returning();
    return inserted;
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
        rosterId: event.rosterId || rosterId || null,
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

  async updateStatField(id: string, updateData: Partial<InsertStatField>, gameId?: string | null, rosterId?: string | null): Promise<StatField> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(statFields.id, id), eq(statFields.teamId, teamId)];
    if (gameId) conditions.push(eq(statFields.gameId, gameId));
    if (rosterId) conditions.push(eq(statFields.rosterId, rosterId));
    const updated = await db.update(statFields).set(updateData).where(and(...conditions)).returning();
    return updated[0];
  }

  async removeStatField(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(statFields.id, id), eq(statFields.teamId, teamId)];
    if (gameId) conditions.push(eq(statFields.gameId, gameId));
    if (rosterId) conditions.push(eq(statFields.rosterId, rosterId));
    const deleted = await db.delete(statFields).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async getPlayerGameStats(matchId: string, gameId?: string | null, rosterId?: string | null): Promise<PlayerGameStat[]> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(playerGameStats.matchId, matchId), eq(playerGameStats.teamId, teamId)];
    if (gameId) conditions.push(eq(playerGameStats.gameId, gameId));
    return await db.select().from(playerGameStats).where(and(...conditions));
  }

  async getPlayerGameStatsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<PlayerGameStat[]> {
    const teamId = getTeamId();
    const conditions: any[] = [
      eq(playerGameStats.teamId, teamId),
      eq(playerGameStats.gameId, gameId),
      eq(games.rosterId, rosterId),
    ];
    if (opponentId) conditions.push(eq(games.opponentId, opponentId));
    const rows = await db.select({ s: playerGameStats })
      .from(playerGameStats)
      .innerJoin(games, eq(playerGameStats.matchId, games.id))
      .where(and(...conditions));
    return rows.map(r => r.s);
  }

  async savePlayerGameStats(matchId: string, stats: InsertPlayerGameStat[], gameId?: string | null, rosterId?: string | null): Promise<PlayerGameStat[]> {
    const teamId = getTeamId();
    const delConditions: any[] = [eq(playerGameStats.matchId, matchId), eq(playerGameStats.teamId, teamId)];
    if (gameId) delConditions.push(eq(playerGameStats.gameId, gameId));
    await db.delete(playerGameStats).where(and(...delConditions));
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

  async getAllOpponents(gameId?: string | null, rosterId?: string | null): Promise<Opponent[]> {
    const teamId = getTeamId();
    return await db.select().from(opponents).where(buildWhere(teamId, opponents, gameId, rosterId));
  }

  async getOpponent(id: string): Promise<Opponent | undefined> {
    const teamId = getTeamId();
    const [row] = await db.select().from(opponents).where(and(eq(opponents.id, id), eq(opponents.teamId, teamId))).limit(1);
    return row;
  }

  async addOpponent(opp: InsertOpponent, gameId?: string | null, rosterId?: string | null): Promise<Opponent> {
    const teamId = getTeamId();
    const trimmedName = (opp.name || "").trim();
    if (trimmedName) {
      const conditions: any[] = [
        eq(opponents.teamId, teamId),
        sql`lower(${opponents.name}) = lower(${trimmedName})`,
      ];
      if (gameId) conditions.push(eq(opponents.gameId, gameId));
      if (rosterId) conditions.push(eq(opponents.rosterId, rosterId));
      const [existing] = await db.select().from(opponents).where(and(...conditions)).limit(1);
      if (existing) return existing;
    }
    const [inserted] = await db.insert(opponents).values({ ...opp, name: trimmedName || opp.name, teamId, gameId, rosterId }).returning();
    return inserted;
  }

  async updateOpponent(id: string, opp: Partial<InsertOpponent>, gameId?: string | null, rosterId?: string | null): Promise<Opponent | undefined> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(opponents.id, id), eq(opponents.teamId, teamId)];
    if (gameId) conditions.push(eq(opponents.gameId, gameId));
    if (rosterId) conditions.push(eq(opponents.rosterId, rosterId));
    const [updated] = await db.update(opponents).set(opp).where(and(...conditions)).returning();
    return updated;
  }

  async removeOpponent(id: string, gameId?: string | null, rosterId?: string | null): Promise<boolean> {
    const teamId = getTeamId();
    const conditions: any[] = [eq(opponents.id, id), eq(opponents.teamId, teamId)];
    if (gameId) conditions.push(eq(opponents.gameId, gameId));
    if (rosterId) conditions.push(eq(opponents.rosterId, rosterId));
    const deleted = await db.delete(opponents).where(and(...conditions)).returning();
    return deleted.length > 0;
  }

  async getOpponentPlayersByOpponentId(opponentId: string): Promise<OpponentPlayer[]> {
    const teamId = getTeamId();
    return await db.select().from(opponentPlayers)
      .where(and(eq(opponentPlayers.opponentId, opponentId), eq(opponentPlayers.teamId, teamId)));
  }

  async getOpponentPlayersByRoster(gameId: string, rosterId: string): Promise<OpponentPlayer[]> {
    const teamId = getTeamId();
    return await db.select().from(opponentPlayers)
      .where(and(
        eq(opponentPlayers.teamId, teamId),
        eq(opponentPlayers.gameId, gameId),
        eq(opponentPlayers.rosterId, rosterId),
      ));
  }

  async getOpponentPlayerGameStatsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<OpponentPlayerGameStat[]> {
    const teamId = getTeamId();
    const conditions: any[] = [
      eq(opponentPlayerGameStats.teamId, teamId),
      eq(opponentPlayerGameStats.gameId, gameId),
      eq(games.rosterId, rosterId),
    ];
    if (opponentId) conditions.push(eq(games.opponentId, opponentId));
    const rows = await db.select({ s: opponentPlayerGameStats })
      .from(opponentPlayerGameStats)
      .innerJoin(games, eq(opponentPlayerGameStats.matchId, games.id))
      .where(and(...conditions));
    return rows.map(r => r.s);
  }

  async getOpponentPlayer(id: string): Promise<OpponentPlayer | undefined> {
    const teamId = getTeamId();
    const [row] = await db.select().from(opponentPlayers).where(and(eq(opponentPlayers.id, id), eq(opponentPlayers.teamId, teamId))).limit(1);
    return row;
  }

  async addOpponentPlayer(p: InsertOpponentPlayer, gameId?: string | null, rosterId?: string | null): Promise<OpponentPlayer> {
    const teamId = getTeamId();
    const [inserted] = await db.insert(opponentPlayers).values({ ...p, teamId, gameId, rosterId }).returning();
    return inserted;
  }

  async updateOpponentPlayer(id: string, p: Partial<InsertOpponentPlayer>): Promise<OpponentPlayer | undefined> {
    const teamId = getTeamId();
    const [updated] = await db.update(opponentPlayers).set(p)
      .where(and(eq(opponentPlayers.id, id), eq(opponentPlayers.teamId, teamId))).returning();
    return updated;
  }

  async removeOpponentPlayer(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db.delete(opponentPlayers)
      .where(and(eq(opponentPlayers.id, id), eq(opponentPlayers.teamId, teamId))).returning();
    return deleted.length > 0;
  }

  async getMatchParticipants(matchId: string): Promise<MatchParticipant[]> {
    const teamId = getTeamId();
    return await db.select().from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.teamId, teamId)));
  }

  async getMatchParticipantsByRoster(gameId: string, rosterId: string, opponentId?: string): Promise<MatchParticipant[]> {
    const teamId = getTeamId();
    const conditions: any[] = [
      eq(matchParticipants.teamId, teamId),
      eq(matchParticipants.gameId, gameId),
      eq(matchParticipants.rosterId, rosterId),
    ];
    if (opponentId) {
      const rows = await db.select({ p: matchParticipants })
        .from(matchParticipants)
        .innerJoin(games, eq(matchParticipants.matchId, games.id))
        .where(and(...conditions, eq(games.opponentId, opponentId)));
      return rows.map(r => r.p);
    }
    return await db.select().from(matchParticipants).where(and(...conditions));
  }

  async replaceMatchParticipants(matchId: string, rows: Omit<InsertMatchParticipant, "matchId">[], gameId?: string | null, rosterId?: string | null): Promise<MatchParticipant[]> {
    const teamId = getTeamId();
    return await db.transaction(async (tx) => {
      await tx.delete(matchParticipants).where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.teamId, teamId)));
      if (rows.length === 0) return [];
      const inserted = await tx.insert(matchParticipants).values(
        rows.map(r => ({ ...r, matchId, teamId, gameId, rosterId }))
      ).returning();
      return inserted;
    });
  }

  async getOpponentPlayerGameStats(matchId: string): Promise<OpponentPlayerGameStat[]> {
    const teamId = getTeamId();
    return await db.select().from(opponentPlayerGameStats)
      .where(and(eq(opponentPlayerGameStats.matchId, matchId), eq(opponentPlayerGameStats.teamId, teamId)));
  }

  async saveOpponentPlayerGameStats(matchId: string, stats: InsertOpponentPlayerGameStat[], gameId?: string | null): Promise<OpponentPlayerGameStat[]> {
    const teamId = getTeamId();
    return await db.transaction(async (tx) => {
      await tx.delete(opponentPlayerGameStats)
        .where(and(eq(opponentPlayerGameStats.matchId, matchId), eq(opponentPlayerGameStats.teamId, teamId)));
      if (stats.length === 0) return [];
      const inserted = await tx.insert(opponentPlayerGameStats).values(
        stats.map(s => ({ ...s, matchId, teamId, gameId }))
      ).returning();
      return inserted;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Game Templates (super_admin only at route layer; teamId-scoped in storage)
  // ─────────────────────────────────────────────────────────────────────────
  async getAllGameTemplates(): Promise<GameTemplate[]> {
    const teamId = getTeamId();
    return await db.select().from(gameTemplates)
      .where(eq(gameTemplates.teamId, teamId))
      .orderBy(desc(gameTemplates.createdAt));
  }

  async getGameTemplate(id: string): Promise<GameTemplate | undefined> {
    const teamId = getTeamId();
    const r = await db.select().from(gameTemplates)
      .where(and(eq(gameTemplates.id, id), eq(gameTemplates.teamId, teamId))).limit(1);
    return r[0];
  }

  async getGameTemplateByCode(code: string): Promise<GameTemplate | undefined> {
    const teamId = getTeamId();
    const r = await db.select().from(gameTemplates)
      .where(and(eq(gameTemplates.code, code), eq(gameTemplates.teamId, teamId))).limit(1);
    return r[0];
  }

  async createGameTemplate(name: string, gameId: string, code: string, config: any): Promise<GameTemplate> {
    const teamId = getTeamId();
    const inserted = await db.insert(gameTemplates).values({
      teamId, gameId, name, code, config: config ?? {},
    }).returning();
    return inserted[0];
  }

  async updateGameTemplate(id: string, fields: { name?: string; config?: any }): Promise<GameTemplate | undefined> {
    const teamId = getTeamId();
    const updates: any = { updatedAt: sql`now()` };
    if (typeof fields.name === "string") updates.name = fields.name;
    if (fields.config !== undefined) updates.config = fields.config;
    const updated = await db.update(gameTemplates)
      .set(updates)
      .where(and(eq(gameTemplates.id, id), eq(gameTemplates.teamId, teamId)))
      .returning();
    return updated[0];
  }

  async deleteGameTemplate(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const r = await db.delete(gameTemplates)
      .where(and(eq(gameTemplates.id, id), eq(gameTemplates.teamId, teamId)))
      .returning({ id: gameTemplates.id });
    return r.length > 0;
  }

  /**
   * Apply a template to a roster. SINGLE TRANSACTION:
   *   1. DELETE existing roster-scoped config rows in: heroes, maps, gameModes,
   *      statFields, eventCategories, availabilitySlots, opponents.
   *      (Score config lives on gameModes columns — wiped with gameModes.)
   *   2. INSERT deep copies from template config with re-mapped tempId → new UUID.
   *   3. Update settings.single_mode_game flag for this team+game (NOT per-roster:
   *      single-mode is per-team-per-game in this system; we still write the flag).
   *   4. NEVER touches: players, games, events, attendance, history, sides, etc.
   *   ANY failure → full rollback.
   */
  async applyGameTemplate(templateId: string, rosterId: string, gameId: string): Promise<{ ok: true }> {
    const teamId = getTeamId();
    const tpl = await this.getGameTemplate(templateId);
    if (!tpl) throw new Error("Template not found");
    if (tpl.gameId !== gameId) {
      throw new Error(`Template game does not match roster game.`);
    }
    const config = (tpl.config || {}) as GameTemplateConfig;

    await db.transaction(async (tx) => {
      // 1) WIPE ALL roster data first. The user has explicitly confirmed
      //    a destructive apply via the AlertDialog on the client. We delete
      //    operational data (players, events, games, attendance, history,
      //    schedules, off days, opponents, opponent rosters, staff,
      //    availability, team notes) IN ADDITION to the template-config
      //    tables (modes, maps, heroes, etc).
      //    PRESERVED: users, userGameAssignments, roles, notifications,
      //    activityLogs (audit), rosters (the roster itself), settings
      //    (except single_mode flag which is upserted below), chat,
      //    media library.
      const scoped = (tbl: any) => and(
        eq(tbl.teamId, teamId),
        eq(tbl.gameId, gameId),
        eq(tbl.rosterId, rosterId),
      );

      // Operational data — order matters for FK constraints. games has
      //   ON DELETE CASCADE for: gameHeroes, gameRounds, gameHeroBanActions,
      //   gameMapVetoRows, matchParticipants, playerGameStats, opponentPlayerGameStats.
      // events has ON DELETE RESTRICT from games.eventId, so games MUST be
      //   deleted before events.
      // heroes has ON DELETE RESTRICT from gameHeroes.heroId, so games
      //   MUST be deleted before heroes.
      // opponents → opponentPlayers cascades. players → playerAvailability
      //   cascades. staff → staffAvailability cascades.
      await tx.delete(games).where(scoped(games));
      await tx.delete(attendance).where(scoped(attendance));
      await tx.delete(events).where(scoped(events));
      await tx.delete(seasons).where(scoped(seasons));
      await tx.delete(schedules).where(scoped(schedules));
      await tx.delete(offDays).where(scoped(offDays));
      await tx.delete(opponents).where(scoped(opponents));

      // FK-safe: users.playerId references players.id with NO onDelete clause,
      // so we MUST null out any user→player links for players in this roster
      // BEFORE deleting players, or the transaction will roll back. Users
      // themselves are preserved.
      const playersToWipe = await tx.select({ id: players.id })
        .from(players)
        .where(scoped(players));
      const playerIdsToWipe = playersToWipe.map(p => p.id);
      if (playerIdsToWipe.length > 0) {
        await tx.update(users)
          .set({ playerId: null })
          .where(and(eq(users.teamId, teamId), inArray(users.playerId, playerIdsToWipe)));
      }
      await tx.delete(players).where(scoped(players));
      await tx.delete(staffTable).where(scoped(staffTable));
      await tx.delete(teamNotes).where(scoped(teamNotes));

      // Template-config tables (heroes after games; maps & statFields
      // before gameModes; eventSubTypes before eventCategories).
      await tx.delete(heroes).where(scoped(heroes));
      await tx.delete(maps).where(scoped(maps));
      await tx.delete(statFields).where(scoped(statFields));
      await tx.delete(gameModes).where(scoped(gameModes));
      await tx.delete(eventSubTypes).where(scoped(eventSubTypes));
      await tx.delete(eventCategories).where(scoped(eventCategories));
      await tx.delete(availabilitySlots).where(scoped(availabilitySlots));
      await tx.delete(rosterRoles).where(scoped(rosterRoles));
      await tx.delete(sides).where(scoped(sides));
      await tx.delete(heroBanSystems).where(scoped(heroBanSystems));
      await tx.delete(mapVetoSystems).where(scoped(mapVetoSystems));

      // 2) INSERT deep copies. Build tempId → new UUID maps so child rows can re-link.
      const modeIdMap = new Map<string, string>();
      const modesIn = (config.gameModes || []).map(m => {
        const newId = crypto.randomUUID();
        modeIdMap.set(m.tempId, newId);
        return {
          id: newId,
          teamId, gameId, rosterId,
          name: m.name,
          sortOrder: m.sortOrder ?? "0",
          scoreType: m.scoreType ?? "numeric",
          maxScore: m.maxScore ?? null,
          maxRoundWins: m.maxRoundWins ?? null,
          maxRoundsPerGame: m.maxRoundsPerGame ?? null,
          maxScorePerRoundPerSide: m.maxScorePerRoundPerSide ?? null,
        };
      });
      if (modesIn.length > 0) await tx.insert(gameModes).values(modesIn);

      const mapsIn = (config.maps || []).map(m => ({
        id: crypto.randomUUID(),
        teamId, gameId, rosterId,
        name: m.name,
        gameModeId: m.gameModeTempId ? (modeIdMap.get(m.gameModeTempId) ?? null) : null,
        imageUrl: m.imageUrl ?? null,
        sortOrder: m.sortOrder ?? "0",
      }));
      if (mapsIn.length > 0) await tx.insert(maps).values(mapsIn);

      const statsIn = (config.statFields || []).map(s => ({
        id: crypto.randomUUID(),
        teamId, gameId, rosterId,
        name: s.name,
        gameModeId: s.gameModeTempId ? (modeIdMap.get(s.gameModeTempId) ?? null) : null,
      }));
      if (statsIn.length > 0) await tx.insert(statFields).values(statsIn);

      const heroesIn = (config.heroes || []).map(h => ({
        id: crypto.randomUUID(),
        teamId, gameId, rosterId,
        name: h.name,
        role: h.role,
        imageUrl: h.imageUrl ?? null,
        isActive: h.isActive ?? true,
        sortOrder: h.sortOrder ?? 0,
      }));
      if (heroesIn.length > 0) await tx.insert(heroes).values(heroesIn);

      const catIdMap = new Map<string, string>();
      const catsIn = (config.eventCategories || []).map(c => {
        const newId = crypto.randomUUID();
        catIdMap.set(c.tempId, newId);
        return {
          id: newId,
          teamId, gameId, rosterId,
          name: c.name,
          color: c.color ?? "#3b82f6",
        };
      });
      if (catsIn.length > 0) await tx.insert(eventCategories).values(catsIn);

      const subTypesIn = (config.eventSubTypes || [])
        .filter(s => catIdMap.has(s.categoryTempId))
        .map(s => ({
          id: crypto.randomUUID(),
          teamId, gameId, rosterId,
          categoryId: catIdMap.get(s.categoryTempId)!,
          name: s.name,
          color: s.color ?? null,
          sortOrder: s.sortOrder ?? 0,
        }));
      if (subTypesIn.length > 0) await tx.insert(eventSubTypes).values(subTypesIn);

      const slotsIn = (config.availabilitySlots || []).map(s => ({
        id: crypto.randomUUID(),
        teamId, gameId, rosterId,
        label: s.label,
        sortOrder: s.sortOrder ?? 0,
      }));
      if (slotsIn.length > 0) await tx.insert(availabilitySlots).values(slotsIn);

      const oppIdMap = new Map<string, string>();
      const oppsIn = (config.opponents || []).map(o => {
        const newId = crypto.randomUUID();
        oppIdMap.set(o.tempId, newId);
        return {
          id: newId,
          teamId, gameId, rosterId,
          name: o.name,
          shortName: o.shortName ?? null,
          logoUrl: o.logoUrl ?? null,
          region: o.region ?? null,
          notes: o.notes ?? null,
          isActive: o.isActive ?? true,
          sortOrder: o.sortOrder ?? 0,
        };
      });
      if (oppsIn.length > 0) await tx.insert(opponents).values(oppsIn);

      // Re-link template-scoped opponent players to the freshly inserted
      // opponents via the tempId → newId map. Skip orphans (opponentTempId
      // not found) — that means the user deleted the opponent but left
      // dangling players in the template.
      const oppPlayersIn = (config.players || [])
        .filter(p => oppIdMap.has(p.opponentTempId))
        .map(p => ({
          id: crypto.randomUUID(),
          teamId, gameId, rosterId,
          opponentId: oppIdMap.get(p.opponentTempId)!,
          // Append IGN to name in parens when present so the live
          // opponent_players table (which has no separate IGN column)
          // still shows it.
          name: p.ign && p.ign.trim()
            ? `${p.name} (${p.ign.trim()})`
            : p.name,
          role: p.role ?? null,
          isStarter: p.isStarter ?? true,
          sortOrder: p.sortOrder ?? 0,
          notes: p.notes ?? null,
        }));
      if (oppPlayersIn.length > 0) await tx.insert(opponentPlayers).values(oppPlayersIn);

      const sidesIn = (config.sides || []).map(s => ({
        id: crypto.randomUUID(),
        teamId, gameId, rosterId,
        name: s.name,
        sortOrder: s.sortOrder ?? "0",
      }));
      if (sidesIn.length > 0) await tx.insert(sides).values(sidesIn);

      const rolesIn = (config.rosterRoles || []).map(r => ({
        id: crypto.randomUUID(),
        teamId, gameId, rosterId,
        name: r.name,
        type: r.type ?? "player",
        sortOrder: r.sortOrder ?? 0,
      }));
      if (rolesIn.length > 0) await tx.insert(rosterRoles).values(rolesIn);

      const hbsIn = (config.heroBanSystems || []).map(h => ({
        id: crypto.randomUUID(),
        teamId, gameId, rosterId,
        name: h.name,
        enabled: h.enabled ?? true,
        mode: h.mode ?? "simple",
        supportsLocks: h.supportsLocks ?? false,
        bansPerTeam: h.bansPerTeam ?? 0,
        locksPerTeam: h.locksPerTeam ?? 0,
        bansTargetEnemy: h.bansTargetEnemy ?? true,
        locksSecureOwn: h.locksSecureOwn ?? false,
        // actionSequence is a free-form jsonb sequence editor (not yet exposed
        // in the template editor UI). Pass through if present in the template
        // config; otherwise leave null. Safe today because no other code path
        // writes this column, but documented so future template-editor work
        // doesn't lose data.
        actionSequence: ((h as any).actionSequence ?? null) as any,
        bansPerRound: h.bansPerRound ?? null,
        bansEverySideSwitch: h.bansEverySideSwitch ?? false,
        bansEveryTwoRounds: h.bansEveryTwoRounds ?? false,
        bansResetOnHalftime: h.bansResetOnHalftime ?? false,
        overtimeBehavior: h.overtimeBehavior ?? null,
        totalBansPerMap: h.totalBansPerMap ?? null,
        bansAccumulate: h.bansAccumulate ?? false,
        notes: h.notes ?? null,
        sortOrder: h.sortOrder ?? 0,
      }));
      if (hbsIn.length > 0) await tx.insert(heroBanSystems).values(hbsIn);

      const mvsIn = (config.mapVetoSystems || []).map(v => ({
        id: crypto.randomUUID(),
        teamId, gameId, rosterId,
        name: v.name,
        enabled: v.enabled ?? true,
        supportsBan: v.supportsBan ?? true,
        supportsPick: v.supportsPick ?? true,
        supportsDecider: v.supportsDecider ?? true,
        supportsSideChoice: v.supportsSideChoice ?? true,
        defaultRowCount: v.defaultRowCount ?? 7,
        notes: v.notes ?? null,
        sortOrder: v.sortOrder ?? 0,
      }));
      if (mvsIn.length > 0) await tx.insert(mapVetoSystems).values(mvsIn);

      // Hero roles are TEMPLATE-SCOPED ONLY. They live inside the template
      // config JSON (`config.heroRoles`) and drive the Heroes-tab role
      // dropdown inside the editor. We deliberately DO NOT write them into
      // the team-shared `hero_role_configs` table on apply, because that
      // would leak this template's roles into every other roster on the team.
      // (The Heroes form on the roster Dashboard reads its options from the
      // active template's `cfg.heroRoles` instead.)

      // 3) Single-mode flag (per-team-per-game). Upsert in settings.
      const flagVal = config.singleModeGame ? "true" : "false";
      const existing = await tx.select().from(settings).where(and(
        eq(settings.teamId, teamId),
        eq(settings.gameId, gameId),
        eq(settings.key, "single_mode_game"),
        isNull(settings.rosterId),
      )).limit(1);
      if (existing[0]) {
        await tx.update(settings).set({ value: flagVal }).where(eq(settings.id, existing[0].id));
      } else {
        await tx.insert(settings).values({ teamId, gameId, rosterId: null, key: "single_mode_game", value: flagVal });
      }
    });

    return { ok: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Roster seeding (Dataset system)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Pick a "default" Game Template for a game. Strategy: most recently updated
   * template for the (team, game). Returns undefined if none exists.
   */
  async findDefaultTemplateForGame(gameId: string): Promise<GameTemplate | undefined> {
    const teamId = getTeamId();
    const rows = await db
      .select()
      .from(gameTemplates)
      .where(and(eq(gameTemplates.teamId, teamId), eq(gameTemplates.gameId, gameId)))
      .orderBy(desc(gameTemplates.updatedAt))
      .limit(1);
    return rows[0];
  }

  /**
   * Seed a roster with a complete, immediately-usable dataset.
   *
   *   - If a templateId is given OR a Game Template exists for this game → copy
   *     it via applyGameTemplate (destructive, FK-safe wipe + insert).
   *   - Else → seed from per-game defaults inside one transaction.
   *
   * Safety:
   *   - force=false (default): if the roster already has ANY data
   *     (rosterRoles, sides, players, opponents, gameModes, eventCategories,
   *     heroBanSystems, mapVetoSystems), return {source:"skipped"} without
   *     touching anything. This is what auto-seed-on-create relies on to never
   *     overwrite a live roster.
   *   - force=true: wipe first (same logic as applyGameTemplate) then re-seed.
   */
  async seedNewRoster(
    rosterId: string,
    gameId: string,
    opts: { templateId?: string; force?: boolean } = {},
  ): Promise<SeedRosterResult> {
    const teamId = getTeamId();
    const force = !!opts.force;
    const warnings: string[] = [];
    const emptyCounts = {
      rosterRoles: 0, heroRoles: 0, sides: 0, eventCategories: 0, eventSubTypes: 0,
      gameModes: 0, maps: 0, statFields: 0, heroes: 0,
      heroBanSystems: 0, mapVetoSystems: 0, opponents: 0, opponentPlayers: 0,
    };

    // 1) Live-roster guard for non-force seeds — checks every table that
    //    seeding writes to so we never silently mutate a populated roster.
    if (!force) {
      const scoped = (tbl: any) => and(
        eq(tbl.teamId, teamId), eq(tbl.gameId, gameId), eq(tbl.rosterId, rosterId),
      );
      const checks = await Promise.all([
        db.select({ id: rosterRoles.id }).from(rosterRoles).where(scoped(rosterRoles)).limit(1),
        db.select({ id: sides.id }).from(sides).where(scoped(sides)).limit(1),
        db.select({ id: opponents.id }).from(opponents).where(scoped(opponents)).limit(1),
        db.select({ id: players.id }).from(players).where(scoped(players)).limit(1),
        db.select({ id: gameModes.id }).from(gameModes).where(scoped(gameModes)).limit(1),
        db.select({ id: eventCategories.id }).from(eventCategories).where(scoped(eventCategories)).limit(1),
        db.select({ id: eventSubTypes.id }).from(eventSubTypes).where(scoped(eventSubTypes)).limit(1),
        db.select({ id: heroBanSystems.id }).from(heroBanSystems).where(scoped(heroBanSystems)).limit(1),
        db.select({ id: mapVetoSystems.id }).from(mapVetoSystems).where(scoped(mapVetoSystems)).limit(1),
        db.select({ id: heroes.id }).from(heroes).where(scoped(heroes)).limit(1),
        db.select({ id: maps.id }).from(maps).where(scoped(maps)).limit(1),
        db.select({ id: statFields.id }).from(statFields).where(scoped(statFields)).limit(1),
        db.select({ id: availabilitySlots.id }).from(availabilitySlots).where(scoped(availabilitySlots)).limit(1),
      ]);
      if (checks.some(rows => rows.length > 0)) {
        return { source: "skipped", counts: emptyCounts, warnings: ["roster already populated; pass force=true to re-seed"] };
      }
    }

    // 2) Resolve game slug — needed for picking defaults & opponent seed list.
    //    supportedGames is a global catalog (no teamId column).
    const gameRow = await db.select().from(supportedGames)
      .where(eq(supportedGames.id, gameId))
      .limit(1);
    const gameSlug = gameRow[0]?.slug ?? null;
    if (!gameSlug) warnings.push("supportedGames row not found for gameId; using generic defaults");

    // 3) Template path — explicit templateId OR auto-detected default template.
    let template: GameTemplate | undefined;
    if (opts.templateId) {
      template = await this.getGameTemplate(opts.templateId);
      if (!template) throw new Error("Template not found");
      if (template.gameId !== gameId) throw new Error("Template game does not match roster game");
    } else {
      template = await this.findDefaultTemplateForGame(gameId);
    }

    if (template) {
      await this.applyGameTemplate(template.id, rosterId, gameId);
      const cfg = (template.config || {}) as GameTemplateConfig;
      return {
        source: "template",
        templateId: template.id,
        templateName: template.name,
        counts: {
          rosterRoles: cfg.rosterRoles?.length ?? 0,
          heroRoles: cfg.heroRoles?.length ?? 0,
          sides: cfg.sides?.length ?? 0,
          eventCategories: cfg.eventCategories?.length ?? 0,
          eventSubTypes: cfg.eventSubTypes?.length ?? 0,
          gameModes: cfg.gameModes?.length ?? 0,
          maps: cfg.maps?.length ?? 0,
          statFields: cfg.statFields?.length ?? 0,
          heroes: cfg.heroes?.length ?? 0,
          heroBanSystems: cfg.heroBanSystems?.length ?? 0,
          mapVetoSystems: cfg.mapVetoSystems?.length ?? 0,
          opponents: cfg.opponents?.length ?? 0,
          opponentPlayers: cfg.players?.length ?? 0,
        },
        warnings,
      };
    }

    // 4) Defaults path.
    const defaults = getGameDefaults(gameSlug);
    const counts = { ...emptyCounts };

    await db.transaction(async (tx) => {
      // Force: wipe first using same FK-safe ordering as applyGameTemplate.
      if (force) {
        const scoped = (tbl: any) => and(
          eq(tbl.teamId, teamId), eq(tbl.gameId, gameId), eq(tbl.rosterId, rosterId),
        );
        await tx.delete(games).where(scoped(games));
        await tx.delete(attendance).where(scoped(attendance));
        await tx.delete(events).where(scoped(events));
        await tx.delete(seasons).where(scoped(seasons));
        await tx.delete(schedules).where(scoped(schedules));
        await tx.delete(offDays).where(scoped(offDays));
        await tx.delete(opponents).where(scoped(opponents));
        const playersToWipe = await tx.select({ id: players.id }).from(players).where(scoped(players));
        const playerIdsToWipe = playersToWipe.map(p => p.id);
        if (playerIdsToWipe.length > 0) {
          await tx.update(users).set({ playerId: null })
            .where(and(eq(users.teamId, teamId), inArray(users.playerId, playerIdsToWipe)));
        }
        await tx.delete(players).where(scoped(players));
        await tx.delete(staffTable).where(scoped(staffTable));
        await tx.delete(teamNotes).where(scoped(teamNotes));
        await tx.delete(heroes).where(scoped(heroes));
        await tx.delete(maps).where(scoped(maps));
        await tx.delete(statFields).where(scoped(statFields));
        await tx.delete(gameModes).where(scoped(gameModes));
        await tx.delete(eventSubTypes).where(scoped(eventSubTypes));
        await tx.delete(eventCategories).where(scoped(eventCategories));
        await tx.delete(rosterRoles).where(scoped(rosterRoles));
        await tx.delete(sides).where(scoped(sides));
        await tx.delete(heroBanSystems).where(scoped(heroBanSystems));
        await tx.delete(mapVetoSystems).where(scoped(mapVetoSystems));
        await tx.delete(availabilitySlots).where(scoped(availabilitySlots));
      }

      // 4a) Roster Roles
      if (defaults.rosterRoles.length > 0) {
        const rows = defaults.rosterRoles.map(r => ({
          teamId, gameId, rosterId,
          name: r.name, type: r.type, sortOrder: r.sortOrder,
        }));
        await tx.insert(rosterRoles).values(rows);
        counts.rosterRoles = rows.length;
      }

      // 4b) Hero Roles — TEAM-shared `hero_role_configs`. Idempotent: insert
      //     only if (team, game) currently has none, so we don't leak roles
      //     across rosters.
      if (defaults.heroRoles.length > 0) {
        const existing = await tx.select({ id: heroRoleConfigs.id })
          .from(heroRoleConfigs)
          .where(and(eq(heroRoleConfigs.teamId, teamId), eq(heroRoleConfigs.gameId, gameId)))
          .limit(1);
        if (existing.length === 0) {
          await tx.insert(heroRoleConfigs).values(
            defaults.heroRoles.map((name, i) => ({
              teamId, gameId, name, sortOrder: i, isActive: true,
            }))
          );
          counts.heroRoles = defaults.heroRoles.length;
        }
      }

      // 4c) Sides
      if (defaults.sides.length > 0) {
        await tx.insert(sides).values(defaults.sides.map((name, i) => ({
          teamId, gameId, rosterId, name, sortOrder: String(i),
        })));
        counts.sides = defaults.sides.length;
      }

      // 4d) Event Categories + Sub Types
      for (const cat of defaults.eventCategories) {
        const inserted = await tx.insert(eventCategories).values({
          teamId, gameId, rosterId, name: cat.name, color: cat.color, sortOrder: counts.eventCategories,
        }).returning({ id: eventCategories.id });
        counts.eventCategories++;
        const catId = inserted[0].id;
        if (cat.subs.length > 0) {
          await tx.insert(eventSubTypes).values(cat.subs.map((sub, j) => ({
            teamId, gameId, rosterId, categoryId: catId, name: sub, sortOrder: j,
          })));
          counts.eventSubTypes += cat.subs.length;
        }
      }

      // 4e) Game Modes → Maps → Stat Fields. Each game mode owns its maps and
      //     stat fields so the relations are coherent.
      for (const mode of defaults.gameModes) {
        const inserted = await tx.insert(gameModes).values({
          teamId, gameId, rosterId, name: mode.name, sortOrder: String(counts.gameModes),
        }).returning({ id: gameModes.id });
        counts.gameModes++;
        const modeId = inserted[0].id;
        if (mode.maps.length > 0) {
          await tx.insert(maps).values(mode.maps.map((m, j) => ({
            teamId, gameId, rosterId, name: m, gameModeId: modeId, sortOrder: String(j),
          })));
          counts.maps += mode.maps.length;
        }
        if (mode.statFields.length > 0) {
          await tx.insert(statFields).values(mode.statFields.map(s => ({
            teamId, gameId, rosterId, name: s, gameModeId: modeId,
          })));
          counts.statFields += mode.statFields.length;
        }
      }

      // 4f) Heroes — only games with a curated default hero list (Overwatch,
      //     Marvel Rivals). Other games get an empty heroes pool that the
      //     team will populate themselves.
      if (defaults.heroes.length > 0) {
        await tx.insert(heroes).values(defaults.heroes.map((h, i) => ({
          teamId, gameId, rosterId,
          name: h.name, role: h.role, imageUrl: null,
          isActive: true, sortOrder: i,
        })));
        counts.heroes = defaults.heroes.length;
      }

      // 4g) Hero Ban System (one preset).
      if (defaults.heroBanSystem) {
        await tx.insert(heroBanSystems).values({
          teamId, gameId, rosterId,
          name: defaults.heroBanSystem.name,
          mode: defaults.heroBanSystem.mode,
          bansPerTeam: defaults.heroBanSystem.bansPerTeam,
          enabled: true,
        });
        counts.heroBanSystems = 1;
      }

      // 4h0) Availability slots — sensible defaults so the roster's
      //      Availability page isn't blank on first run.
      await tx.insert(availabilitySlots).values(
        ["Morning", "Afternoon", "Evening", "Night"].map((label, i) => ({
          teamId, gameId, rosterId, label, sortOrder: i,
        }))
      );

      // 4h) Map Veto System (one preset).
      if (defaults.mapVetoSystem) {
        await tx.insert(mapVetoSystems).values({
          teamId, gameId, rosterId,
          name: defaults.mapVetoSystem.name,
          defaultRowCount: defaults.mapVetoSystem.defaultRowCount,
          enabled: true,
        });
        counts.mapVetoSystems = 1;
      }

      // 4i) Opponents — pull real names from OPPONENT_SEEDS_BY_GAME_SLUG; pad
      //     to ≥2 with placeholders if the seed list is short. Each opponent
      //     gets `defaultPlayersPerOpponent` generic players with IGN baked
      //     into the name as "DisplayName (ign)" — mirroring the template
      //     apply path which uses the same column convention.
      // Normalize a few common slug aliases for the opponent seed lookup.
      const opponentSlugAliases: Record<string, string> = { "cs": "cs2", "csgo2": "cs2" };
      const opponentLookupSlug = gameSlug ? (opponentSlugAliases[gameSlug] ?? gameSlug) : null;
      const seedList = (opponentLookupSlug && OPPONENT_SEEDS_BY_GAME_SLUG[opponentLookupSlug]) || [];
      const oppDefs: Array<{ name: string; shortName: string | null; region: string | null }> = [];
      for (const o of seedList.slice(0, 6)) {
        oppDefs.push({ name: o.name, shortName: o.shortName ?? null, region: o.region ?? null });
      }
      while (oppDefs.length < 2) {
        const i = oppDefs.length + 1;
        oppDefs.push({ name: `Opponent ${i}`, shortName: `OPP${i}`, region: null });
      }

      const playerRoleNames = defaults.rosterRoles
        .filter(r => r.type === "player")
        .map(r => r.name);

      for (const o of oppDefs) {
        const inserted = await tx.insert(opponents).values({
          teamId, gameId, rosterId,
          name: o.name, shortName: o.shortName, region: o.region,
          isActive: true, sortOrder: counts.opponents,
        }).returning({ id: opponents.id });
        counts.opponents++;
        const opponentId = inserted[0].id;

        const igNamePrefix = (o.shortName ?? o.name).toLowerCase().replace(/[^a-z0-9]+/g, "");
        const playerRows = Array.from({ length: defaults.defaultPlayersPerOpponent }).map((_, idx) => {
          const ign = `${igNamePrefix || "player"}${idx + 1}`;
          const displayName = `Player ${idx + 1}`;
          const role = playerRoleNames.length > 0
            ? playerRoleNames[idx % playerRoleNames.length]
            : null;
          return {
            teamId, gameId, rosterId, opponentId,
            name: `${displayName} (${ign})`,
            role, isStarter: idx < 5, sortOrder: idx,
          };
        });
        await tx.insert(opponentPlayers).values(playerRows);
        counts.opponentPlayers += playerRows.length;
      }
    });

    // Suppress unused-import warning when defaultIgn isn't reached above.
    void defaultIgn;

    return { source: "defaults", counts, warnings };
  }
}

export const storage = new DbStorage();
