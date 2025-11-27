import type { Player, InsertPlayer, Schedule, InsertSchedule, Setting, InsertSetting, Event, InsertEvent, Attendance, InsertAttendance, TeamNotes, InsertTeamNotes, Game, InsertGame, GameMode, InsertGameMode, Map, InsertMap } from "@shared/schema";
import { players, schedules, settings, events, attendance, teamNotes, games, gameModes, maps } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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
}

export class DbStorage implements IStorage {
  async getSchedule(weekStartDate: string, weekEndDate: string): Promise<Schedule | undefined> {
    const result = await db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.weekStartDate, weekStartDate),
          eq(schedules.weekEndDate, weekEndDate)
        )
      )
      .limit(1);

    return result[0];
  }

  async saveSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
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
        .where(eq(schedules.id, existing.id))
        .returning();

      return updated[0];
    }

    const inserted = await db
      .insert(schedules)
      .values(insertSchedule)
      .returning();

    return inserted[0];
  }

  async getAllPlayers(): Promise<Player[]> {
    return await db.select().from(players);
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const result = await db
      .select()
      .from(players)
      .where(eq(players.id, id))
      .limit(1);

    return result[0];
  }

  async addPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const inserted = await db
      .insert(players)
      .values(insertPlayer)
      .returning();

    return inserted[0];
  }

  async updatePlayer(id: string, updateData: Partial<InsertPlayer>): Promise<Player> {
    const updated = await db
      .update(players)
      .set(updateData)
      .where(eq(players.id, id))
      .returning();

    return updated[0];
  }

  async removePlayer(id: string): Promise<boolean> {
    const deleted = await db
      .delete(players)
      .where(eq(players.id, id))
      .returning();

    return deleted.length > 0;
  }

  async getSetting(key: string): Promise<string | null> {
    const result = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    return result[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const existing = await this.getSetting(key);

    if (existing !== null) {
      const updated = await db
        .update(settings)
        .set({ value })
        .where(eq(settings.key, key))
        .returning();

      return updated[0];
    }

    const inserted = await db
      .insert(settings)
      .values({ key, value })
      .returning();

    return inserted[0];
  }

  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events);
  }

  async addEvent(insertEvent: InsertEvent): Promise<Event> {
    const inserted = await db
      .insert(events)
      .values(insertEvent)
      .returning();

    return inserted[0];
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event> {
    const updated = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();

    return updated[0];
  }

  async removeEvent(id: string): Promise<boolean> {
    const deleted = await db
      .delete(events)
      .where(eq(events.id, id))
      .returning();

    return deleted.length > 0;
  }

  async getAllAttendance(): Promise<Attendance[]> {
    return await db.select().from(attendance);
  }

  async getAttendanceByPlayerId(playerId: string): Promise<Attendance[]> {
    return await db
      .select()
      .from(attendance)
      .where(eq(attendance.playerId, playerId));
  }

  async addAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const inserted = await db
      .insert(attendance)
      .values(insertAttendance)
      .returning();

    return inserted[0];
  }

  async updateAttendance(id: string, updateData: Partial<InsertAttendance>): Promise<Attendance> {
    const updated = await db
      .update(attendance)
      .set(updateData)
      .where(eq(attendance.id, id))
      .returning();

    return updated[0];
  }

  async removeAttendance(id: string): Promise<boolean> {
    const deleted = await db
      .delete(attendance)
      .where(eq(attendance.id, id))
      .returning();

    return deleted.length > 0;
  }

  async getTeamNotes(): Promise<TeamNotes[]> {
    return await db.select().from(teamNotes).orderBy(teamNotes.timestamp);
  }

  async addTeamNote(insertTeamNote: InsertTeamNotes): Promise<TeamNotes> {
    const inserted = await db
      .insert(teamNotes)
      .values(insertTeamNote)
      .returning();

    return inserted[0];
  }

  async deleteTeamNote(id: string): Promise<boolean> {
    const deleted = await db
      .delete(teamNotes)
      .where(eq(teamNotes.id, id))
      .returning();

    return deleted.length > 0;
  }

  async getGamesByEventId(eventId: string): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(eq(games.eventId, eventId));
  }

  async getAllGamesWithEventType(scope?: string): Promise<(Game & { eventType: string })[]> {
    const allGames = await db
      .select({
        id: games.id,
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
      .innerJoin(events, eq(games.eventId, events.id));

    // Filter by scope if provided
    if (scope === "scrim") {
      return allGames.filter(g => g.eventType === "Scrim");
    } else if (scope === "tournament") {
      return allGames.filter(g => g.eventType === "Tournament");
    }

    return allGames;
  }

  async addGame(insertGame: InsertGame): Promise<Game> {
    const inserted = await db
      .insert(games)
      .values(insertGame)
      .returning();

    return inserted[0];
  }

  async updateGame(id: string, updateData: Partial<InsertGame>): Promise<Game> {
    const updated = await db
      .update(games)
      .set(updateData)
      .where(eq(games.id, id))
      .returning();

    return updated[0];
  }

  async removeGame(id: string): Promise<boolean> {
    const deleted = await db
      .delete(games)
      .where(eq(games.id, id))
      .returning();

    return deleted.length > 0;
  }

  async getAllGameModes(): Promise<GameMode[]> {
    return await db.select().from(gameModes);
  }

  async addGameMode(insertGameMode: InsertGameMode): Promise<GameMode> {
    const inserted = await db
      .insert(gameModes)
      .values(insertGameMode)
      .returning();

    return inserted[0];
  }

  async updateGameMode(id: string, updateData: Partial<InsertGameMode>): Promise<GameMode> {
    const updated = await db
      .update(gameModes)
      .set(updateData)
      .where(eq(gameModes.id, id))
      .returning();

    return updated[0];
  }

  async removeGameMode(id: string): Promise<boolean> {
    const deleted = await db
      .delete(gameModes)
      .where(eq(gameModes.id, id))
      .returning();

    return deleted.length > 0;
  }

  async getAllMaps(): Promise<Map[]> {
    return await db.select().from(maps);
  }

  async getMapsByGameModeId(gameModeId: string): Promise<Map[]> {
    return await db
      .select()
      .from(maps)
      .where(eq(maps.gameModeId, gameModeId));
  }

  async addMap(insertMap: InsertMap): Promise<Map> {
    const inserted = await db
      .insert(maps)
      .values(insertMap)
      .returning();

    return inserted[0];
  }

  async updateMap(id: string, updateData: Partial<InsertMap>): Promise<Map> {
    const updated = await db
      .update(maps)
      .set(updateData)
      .where(eq(maps.id, id))
      .returning();

    return updated[0];
  }

  async removeMap(id: string): Promise<boolean> {
    const deleted = await db
      .delete(maps)
      .where(eq(maps.id, id))
      .returning();

    return deleted.length > 0;
  }

  async resetToDefaults(): Promise<void> {
    await db.delete(maps);
    await db.delete(gameModes);

    const defaultModes = [
      { name: "Domination" },
      { name: "Convoy" },
      { name: "Convergence" },
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
      { name: "Birnin T'Challa", gameModeId: dominationMode!.id },
      { name: "Celestial Husk", gameModeId: dominationMode!.id },
      { name: "Hell's Heaven", gameModeId: dominationMode!.id },
      { name: "Krakoa", gameModeId: dominationMode!.id },
      { name: "Spider-Islands", gameModeId: convoyMode!.id },
      { name: "Yggdrasill Path", gameModeId: convoyMode!.id },
      { name: "Midtown", gameModeId: convoyMode!.id },
      { name: "Arakko", gameModeId: convoyMode!.id },
      { name: "Heart of Heaven", gameModeId: convergenceMode!.id },
      { name: "Hall of Djalia", gameModeId: convergenceMode!.id },
      { name: "Symbiotic Surface", gameModeId: convergenceMode!.id },
      { name: "Central Park", gameModeId: convergenceMode!.id },
    ];

    for (const map of defaultMaps) {
      await db.insert(maps).values(map);
    }
  }
}

export const storage = new DbStorage();
