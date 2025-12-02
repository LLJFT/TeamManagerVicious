import type { Player, InsertPlayer, Schedule, InsertSchedule, Setting, InsertSetting, Event, InsertEvent, Attendance, InsertAttendance, TeamNotes, InsertTeamNotes, Game, InsertGame, GameMode, InsertGameMode, Map, InsertMap, Season, InsertSeason } from "@shared/schema";
import { players, schedules, settings, events, attendance, teamNotes, games, gameModes, maps, seasons } from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull } from "drizzle-orm";

export function getTeamId(): string {
  const teamId = process.env.TEAM_ID || process.env.REPL_ID;
  if (!teamId) {
    throw new Error("TEAM_ID or REPL_ID environment variable must be set for data isolation");
  }
  return teamId;
}

export interface IStorage {
  getSchedule(weekStartDate: string, weekEndDate: string): Promise<Schedule | undefined>;
  saveSchedule(schedule: InsertSchedule): Promise<Schedule>;
  getAllPlayers(): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  addPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, player: Partial<InsertPlayer>): Promise<Player>;
  removePlayer(id: string): Promise<boolean>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<Setting>;
  getAllEvents(): Promise<Event[]>;
  addEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event>;
  removeEvent(id: string): Promise<boolean>;
  getAllAttendance(): Promise<Attendance[]>;
  getAttendanceByPlayerId(playerId: string): Promise<Attendance[]>;
  addAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, attendance: Partial<InsertAttendance>): Promise<Attendance>;
  removeAttendance(id: string): Promise<boolean>;
  getTeamNotes(): Promise<TeamNotes[]>;
  addTeamNote(note: InsertTeamNotes): Promise<TeamNotes>;
  deleteTeamNote(id: string): Promise<boolean>;
  getGamesByEventId(eventId: string): Promise<Game[]>;
  getAllGamesWithEventType(scope?: string): Promise<(Game & { eventType: string })[]>;
  addGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, game: Partial<InsertGame>): Promise<Game>;
  removeGame(id: string): Promise<boolean>;
  getAllGameModes(): Promise<GameMode[]>;
  addGameMode(gameMode: InsertGameMode): Promise<GameMode>;
  updateGameMode(id: string, gameMode: Partial<InsertGameMode>): Promise<GameMode>;
  removeGameMode(id: string): Promise<boolean>;
  getAllMaps(): Promise<Map[]>;
  getMapsByGameModeId(gameModeId: string): Promise<Map[]>;
  addMap(map: InsertMap): Promise<Map>;
  updateMap(id: string, map: Partial<InsertMap>): Promise<Map>;
  removeMap(id: string): Promise<boolean>;
  resetToDefaults(): Promise<void>;
  getAllSeasons(): Promise<Season[]>;
  addSeason(season: InsertSeason): Promise<Season>;
  updateSeason(id: string, season: Partial<InsertSeason>): Promise<Season>;
  removeSeason(id: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  private getTeamIdOrNull(): string | null {
    try {
      return getTeamId();
    } catch {
      return null;
    }
  }

  async getSchedule(weekStartDate: string, weekEndDate: string): Promise<Schedule | undefined> {
    const teamId = getTeamId();
    const result = await db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.teamId, teamId),
          eq(schedules.weekStartDate, weekStartDate),
          eq(schedules.weekEndDate, weekEndDate)
        )
      )
      .limit(1);

    return result[0];
  }

  async saveSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const teamId = getTeamId();
    const existing = await this.getSchedule(
      insertSchedule.weekStartDate,
      insertSchedule.weekEndDate
    );

    if (existing) {
      const updated = await db
        .update(schedules)
        .set({
          scheduleData: insertSchedule.scheduleData as any,
          googleSheetId: insertSchedule.googleSheetId,
        })
        .where(and(eq(schedules.id, existing.id), eq(schedules.teamId, teamId)))
        .returning();

      return updated[0];
    }

    const inserted = await db
      .insert(schedules)
      .values({ ...insertSchedule, teamId })
      .returning();

    return inserted[0];
  }

  async getAllPlayers(): Promise<Player[]> {
    const teamId = getTeamId();
    return await db.select().from(players).where(eq(players.teamId, teamId));
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const teamId = getTeamId();
    const result = await db
      .select()
      .from(players)
      .where(and(eq(players.id, id), eq(players.teamId, teamId)))
      .limit(1);

    return result[0];
  }

  async addPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const teamId = getTeamId();
    const inserted = await db
      .insert(players)
      .values({ ...insertPlayer, teamId })
      .returning();

    return inserted[0];
  }

  async updatePlayer(id: string, updateData: Partial<InsertPlayer>): Promise<Player> {
    const teamId = getTeamId();
    const updated = await db
      .update(players)
      .set(updateData)
      .where(and(eq(players.id, id), eq(players.teamId, teamId)))
      .returning();

    return updated[0];
  }

  async removePlayer(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db
      .delete(players)
      .where(and(eq(players.id, id), eq(players.teamId, teamId)))
      .returning();

    return deleted.length > 0;
  }

  async getSetting(key: string): Promise<string | null> {
    const teamId = getTeamId();
    const result = await db
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.teamId, teamId)))
      .limit(1);

    return result[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const teamId = getTeamId();
    const existingResult = await db
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.teamId, teamId)))
      .limit(1);

    if (existingResult.length > 0) {
      const updated = await db
        .update(settings)
        .set({ value })
        .where(and(eq(settings.key, key), eq(settings.teamId, teamId)))
        .returning();

      return updated[0];
    }

    const inserted = await db
      .insert(settings)
      .values({ key, value, teamId })
      .returning();

    return inserted[0];
  }

  async getAllEvents(): Promise<Event[]> {
    const teamId = getTeamId();
    return await db.select().from(events).where(eq(events.teamId, teamId));
  }

  async addEvent(insertEvent: InsertEvent): Promise<Event> {
    const teamId = getTeamId();
    const inserted = await db
      .insert(events)
      .values({ ...insertEvent, teamId })
      .returning();

    return inserted[0];
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event> {
    const teamId = getTeamId();
    const updated = await db
      .update(events)
      .set(updateData)
      .where(and(eq(events.id, id), eq(events.teamId, teamId)))
      .returning();

    return updated[0];
  }

  async removeEvent(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db
      .delete(events)
      .where(and(eq(events.id, id), eq(events.teamId, teamId)))
      .returning();

    return deleted.length > 0;
  }

  async getAllAttendance(): Promise<Attendance[]> {
    const teamId = getTeamId();
    return await db.select().from(attendance).where(eq(attendance.teamId, teamId));
  }

  async getAttendanceByPlayerId(playerId: string): Promise<Attendance[]> {
    const teamId = getTeamId();
    return await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.playerId, playerId), eq(attendance.teamId, teamId)));
  }

  async addAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const teamId = getTeamId();
    const inserted = await db
      .insert(attendance)
      .values({ ...insertAttendance, teamId })
      .returning();

    return inserted[0];
  }

  async updateAttendance(id: string, updateData: Partial<InsertAttendance>): Promise<Attendance> {
    const teamId = getTeamId();
    const updated = await db
      .update(attendance)
      .set(updateData)
      .where(and(eq(attendance.id, id), eq(attendance.teamId, teamId)))
      .returning();

    return updated[0];
  }

  async removeAttendance(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db
      .delete(attendance)
      .where(and(eq(attendance.id, id), eq(attendance.teamId, teamId)))
      .returning();

    return deleted.length > 0;
  }

  async getTeamNotes(): Promise<TeamNotes[]> {
    const teamId = getTeamId();
    return await db.select().from(teamNotes).where(eq(teamNotes.teamId, teamId)).orderBy(teamNotes.timestamp);
  }

  async addTeamNote(insertTeamNote: InsertTeamNotes): Promise<TeamNotes> {
    const teamId = getTeamId();
    const inserted = await db
      .insert(teamNotes)
      .values({ ...insertTeamNote, teamId })
      .returning();

    return inserted[0];
  }

  async deleteTeamNote(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db
      .delete(teamNotes)
      .where(and(eq(teamNotes.id, id), eq(teamNotes.teamId, teamId)))
      .returning();

    return deleted.length > 0;
  }

  async getGamesByEventId(eventId: string): Promise<Game[]> {
    const teamId = getTeamId();
    return await db
      .select()
      .from(games)
      .where(and(eq(games.eventId, eventId), eq(games.teamId, teamId)));
  }

  async getAllGamesWithEventType(scope?: string): Promise<(Game & { eventType: string })[]> {
    const teamId = getTeamId();
    const allGames = await db
      .select({
        id: games.id,
        teamId: games.teamId,
        eventId: games.eventId,
        gameCode: games.gameCode,
        score: games.score,
        imageUrl: games.imageUrl,
        gameModeId: games.gameModeId,
        mapId: games.mapId,
        result: games.result,
        link: games.link,
        eventType: events.eventType,
      })
      .from(games)
      .innerJoin(events, eq(games.eventId, events.id))
      .where(eq(games.teamId, teamId));

    if (scope === "scrim") {
      return allGames.filter(g => g.eventType === "Scrim");
    } else if (scope === "tournament") {
      return allGames.filter(g => g.eventType === "Tournament");
    }

    return allGames;
  }

  async addGame(insertGame: InsertGame): Promise<Game> {
    const teamId = getTeamId();
    const inserted = await db
      .insert(games)
      .values({ ...insertGame, teamId })
      .returning();

    return inserted[0];
  }

  async updateGame(id: string, updateData: Partial<InsertGame>): Promise<Game> {
    const teamId = getTeamId();
    const updated = await db
      .update(games)
      .set(updateData)
      .where(and(eq(games.id, id), eq(games.teamId, teamId)))
      .returning();

    return updated[0];
  }

  async removeGame(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db
      .delete(games)
      .where(and(eq(games.id, id), eq(games.teamId, teamId)))
      .returning();

    return deleted.length > 0;
  }

  async getAllGameModes(): Promise<GameMode[]> {
    const teamId = getTeamId();
    return await db.select().from(gameModes).where(eq(gameModes.teamId, teamId));
  }

  async addGameMode(insertGameMode: InsertGameMode): Promise<GameMode> {
    const teamId = getTeamId();
    const inserted = await db
      .insert(gameModes)
      .values({ ...insertGameMode, teamId })
      .returning();

    return inserted[0];
  }

  async updateGameMode(id: string, updateData: Partial<InsertGameMode>): Promise<GameMode> {
    const teamId = getTeamId();
    const updated = await db
      .update(gameModes)
      .set(updateData)
      .where(and(eq(gameModes.id, id), eq(gameModes.teamId, teamId)))
      .returning();

    return updated[0];
  }

  async removeGameMode(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db
      .delete(gameModes)
      .where(and(eq(gameModes.id, id), eq(gameModes.teamId, teamId)))
      .returning();

    return deleted.length > 0;
  }

  async getAllMaps(): Promise<Map[]> {
    const teamId = getTeamId();
    return await db.select().from(maps).where(eq(maps.teamId, teamId));
  }

  async getMapsByGameModeId(gameModeId: string): Promise<Map[]> {
    const teamId = getTeamId();
    return await db
      .select()
      .from(maps)
      .where(and(eq(maps.gameModeId, gameModeId), eq(maps.teamId, teamId)));
  }

  async addMap(insertMap: InsertMap): Promise<Map> {
    const teamId = getTeamId();
    const inserted = await db
      .insert(maps)
      .values({ ...insertMap, teamId })
      .returning();

    return inserted[0];
  }

  async updateMap(id: string, updateData: Partial<InsertMap>): Promise<Map> {
    const teamId = getTeamId();
    const updated = await db
      .update(maps)
      .set(updateData)
      .where(and(eq(maps.id, id), eq(maps.teamId, teamId)))
      .returning();

    return updated[0];
  }

  async removeMap(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db
      .delete(maps)
      .where(and(eq(maps.id, id), eq(maps.teamId, teamId)))
      .returning();

    return deleted.length > 0;
  }

  async resetToDefaults(): Promise<void> {
    const teamId = getTeamId();
    await db.delete(maps).where(eq(maps.teamId, teamId));
    await db.delete(gameModes).where(eq(gameModes.teamId, teamId));

    const defaultModes = [
      { name: "Domination", teamId },
      { name: "Convoy", teamId },
      { name: "Convergence", teamId },
    ];

    const createdModes: GameMode[] = [];
    for (const mode of defaultModes) {
      const inserted = await db
        .insert(gameModes)
        .values(mode)
        .returning();
      createdModes.push(inserted[0]);
    }

    const dominationMode = createdModes.find(m => m.name === "Domination");
    const convoyMode = createdModes.find(m => m.name === "Convoy");
    const convergenceMode = createdModes.find(m => m.name === "Convergence");

    const defaultMaps = [
      { name: "Birnin T'Challa", gameModeId: dominationMode!.id, teamId },
      { name: "Celestial Husk", gameModeId: dominationMode!.id, teamId },
      { name: "Hell's Heaven", gameModeId: dominationMode!.id, teamId },
      { name: "Krakoa", gameModeId: dominationMode!.id, teamId },
      { name: "Spider-Islands", gameModeId: convoyMode!.id, teamId },
      { name: "Yggdrasill Path", gameModeId: convoyMode!.id, teamId },
      { name: "Midtown", gameModeId: convoyMode!.id, teamId },
      { name: "Arakko", gameModeId: convoyMode!.id, teamId },
      { name: "Heart of Heaven", gameModeId: convergenceMode!.id, teamId },
      { name: "Hall of Djalia", gameModeId: convergenceMode!.id, teamId },
      { name: "Symbiotic Surface", gameModeId: convergenceMode!.id, teamId },
      { name: "Central Park", gameModeId: convergenceMode!.id, teamId },
    ];

    for (const map of defaultMaps) {
      await db.insert(maps).values(map);
    }
  }

  async getAllSeasons(): Promise<Season[]> {
    const teamId = getTeamId();
    return await db.select().from(seasons).where(eq(seasons.teamId, teamId));
  }

  async addSeason(insertSeason: InsertSeason): Promise<Season> {
    const teamId = getTeamId();
    const inserted = await db
      .insert(seasons)
      .values({ ...insertSeason, teamId })
      .returning();

    return inserted[0];
  }

  async updateSeason(id: string, updateData: Partial<InsertSeason>): Promise<Season> {
    const teamId = getTeamId();
    const updated = await db
      .update(seasons)
      .set(updateData)
      .where(and(eq(seasons.id, id), eq(seasons.teamId, teamId)))
      .returning();

    return updated[0];
  }

  async removeSeason(id: string): Promise<boolean> {
    const teamId = getTeamId();
    const deleted = await db
      .delete(seasons)
      .where(and(eq(seasons.id, id), eq(seasons.teamId, teamId)))
      .returning();

    return deleted.length > 0;
  }
}

export const storage = new DbStorage();
