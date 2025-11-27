import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScheduleSchema, insertEventSchema, insertPlayerSchema, insertAttendanceSchema, insertTeamNotesSchema, insertGameSchema, insertGameModeSchema, insertMapSchema } from "@shared/schema";
import { 
  readScheduleFromSheet, 
  writeScheduleToSheet, 
  convertScheduleToSheetData,
  convertSheetDataToSchedule,
  getSpreadsheetId
} from "./google-sheets";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/schedule", async (req, res) => {
    try {
      const { weekStartDate, weekEndDate } = req.query;
      
      if (!weekStartDate || !weekEndDate) {
        return res.status(400).json({ 
          error: "weekStartDate and weekEndDate are required" 
        });
      }

      const schedule = await storage.getSchedule(
        weekStartDate as string, 
        weekEndDate as string
      );

      if (schedule) {
        return res.json(schedule);
      }

      try {
        const sheetName = `Week_${weekStartDate}`;
        const sheetData = await readScheduleFromSheet(sheetName);
        
        if (sheetData && sheetData.length > 3) {
          const scheduleData = convertSheetDataToSchedule(sheetData);
          
          const newSchedule = await storage.saveSchedule({
            weekStartDate: weekStartDate as string,
            weekEndDate: weekEndDate as string,
            scheduleData: scheduleData as any,
            googleSheetId: sheetName,
          });

          return res.json(newSchedule);
        }
      } catch (sheetError) {
        console.error('Error reading from sheet, returning empty schedule:', sheetError);
      }

      const emptySchedule = await storage.saveSchedule({
        weekStartDate: weekStartDate as string,
        weekEndDate: weekEndDate as string,
        scheduleData: { players: [] } as any,
        googleSheetId: `Week_${weekStartDate}`,
      });

      return res.json(emptySchedule);
    } catch (error: any) {
      console.error('Error in GET /api/schedule:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/schedule", async (req, res) => {
    try {
      const validatedData = insertScheduleSchema.parse(req.body);
      
      const sheetName = `Week_${validatedData.weekStartDate}`;
      const sheetData = convertScheduleToSheetData(
        validatedData.scheduleData,
        validatedData.weekStartDate,
        validatedData.weekEndDate
      );

      await writeScheduleToSheet(sheetName, sheetData);

      const schedule = await storage.saveSchedule({
        ...validatedData,
        googleSheetId: sheetName,
      });

      res.json(schedule);
    } catch (error: any) {
      console.error('Error in POST /api/schedule:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid schedule data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/players", async (req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (error: any) {
      console.error('Error in GET /api/players:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/players", async (req, res) => {
    try {
      const validatedData = insertPlayerSchema.parse(req.body);
      const player = await storage.addPlayer(validatedData);
      res.json(player);
    } catch (error: any) {
      console.error('Error in POST /api/players:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid player data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/players/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removePlayer(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Player not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/players:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/spreadsheet-info", async (req, res) => {
    try {
      const spreadsheetId = await getSpreadsheetId();
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`;
      res.json({ spreadsheetId, url });
    } catch (error: any) {
      console.error('Error in GET /api/spreadsheet-info:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error: any) {
      console.error('Error in GET /api/events:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.addEvent(validatedData);
      res.json(event);
    } catch (error: any) {
      console.error('Error in POST /api/events:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(id, validatedData);
      res.json(event);
    } catch (error: any) {
      console.error('Error in PUT /api/events:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeEvent(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Event not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/events:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/players/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertPlayerSchema.partial().parse(req.body);
      const player = await storage.updatePlayer(id, validatedData);
      res.json(player);
    } catch (error: any) {
      console.error('Error in PUT /api/players:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid player data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/attendance", async (req, res) => {
    try {
      const attendance = await storage.getAllAttendance();
      res.json(attendance);
    } catch (error: any) {
      console.error('Error in GET /api/attendance:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const validatedData = insertAttendanceSchema.parse(req.body);
      const attendance = await storage.addAttendance(validatedData);
      res.json(attendance);
    } catch (error: any) {
      console.error('Error in POST /api/attendance:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid attendance data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/attendance/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertAttendanceSchema.partial().parse(req.body);
      const attendance = await storage.updateAttendance(id, validatedData);
      res.json(attendance);
    } catch (error: any) {
      console.error('Error in PUT /api/attendance:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid attendance data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/attendance/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeAttendance(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Attendance not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/attendance:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/team-notes", async (req, res) => {
    try {
      const notes = await storage.getTeamNotes();
      res.json(notes);
    } catch (error: any) {
      console.error('Error in GET /api/team-notes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/team-notes", async (req, res) => {
    try {
      const validatedData = insertTeamNotesSchema.parse(req.body);
      const note = await storage.addTeamNote(validatedData);
      res.json(note);
    } catch (error: any) {
      console.error('Error in POST /api/team-notes:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid team notes data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/team-notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTeamNote(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Team note not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/team-notes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/events/:eventId/games", async (req, res) => {
    try {
      const { eventId } = req.params;
      const games = await storage.getGamesByEventId(eventId);
      res.json(games);
    } catch (error: any) {
      console.error('Error in GET /api/events/:eventId/games:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/games", async (req, res) => {
    try {
      const validatedData = insertGameSchema.parse(req.body);
      const game = await storage.addGame(validatedData);
      res.json(game);
    } catch (error: any) {
      console.error('Error in POST /api/games:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/games/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertGameSchema.partial().parse(req.body);
      const game = await storage.updateGame(id, validatedData);
      res.json(game);
    } catch (error: any) {
      console.error('Error in PUT /api/games:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/games/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeGame(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Game not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/games:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/game-modes", async (req, res) => {
    try {
      const gameModes = await storage.getAllGameModes();
      res.json(gameModes);
    } catch (error: any) {
      console.error('Error in GET /api/game-modes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/game-modes", async (req, res) => {
    try {
      const validatedData = insertGameModeSchema.parse(req.body);
      const gameMode = await storage.addGameMode(validatedData);
      res.json(gameMode);
    } catch (error: any) {
      console.error('Error in POST /api/game-modes:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game mode data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/game-modes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertGameModeSchema.partial().parse(req.body);
      const gameMode = await storage.updateGameMode(id, validatedData);
      res.json(gameMode);
    } catch (error: any) {
      console.error('Error in PUT /api/game-modes:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game mode data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/game-modes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeGameMode(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Game mode not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/game-modes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/maps", async (req, res) => {
    try {
      const maps = await storage.getAllMaps();
      res.json(maps);
    } catch (error: any) {
      console.error('Error in GET /api/maps:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/game-modes/:gameModeId/maps", async (req, res) => {
    try {
      const { gameModeId } = req.params;
      const maps = await storage.getMapsByGameModeId(gameModeId);
      res.json(maps);
    } catch (error: any) {
      console.error('Error in GET /api/game-modes/:gameModeId/maps:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/maps", async (req, res) => {
    try {
      const validatedData = insertMapSchema.parse(req.body);
      const map = await storage.addMap(validatedData);
      res.json(map);
    } catch (error: any) {
      console.error('Error in POST /api/maps:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid map data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/maps/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertMapSchema.partial().parse(req.body);
      const map = await storage.updateMap(id, validatedData);
      res.json(map);
    } catch (error: any) {
      console.error('Error in PUT /api/maps:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid map data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/maps/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeMap(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Map not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/maps:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error('Error in POST /api/objects/upload:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
