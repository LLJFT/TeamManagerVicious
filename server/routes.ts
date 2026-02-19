import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requirePermission } from "./auth";
import { getTeamId } from "./storage";
import {
  insertScheduleSchema, insertEventSchema, insertPlayerSchema, insertAttendanceSchema,
  insertTeamNotesSchema, insertGameSchema, insertGameModeSchema, insertMapSchema,
  insertSeasonSchema, insertOffDaySchema, insertStatFieldSchema, insertPlayerGameStatSchema,
  insertStaffSchema, insertChatChannelSchema, insertChatMessageSchema,
  insertAvailabilitySlotSchema, insertRosterRoleSchema,
  users, roles, staff, chatChannels, chatMessages, availabilitySlots, rosterRoles,
  type UserWithRole,
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {

  // ==================== AUTH ROUTES ====================
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const teamId = getTeamId();
      const [user] = await db.select().from(users)
        .where(and(eq(users.username, username), eq(users.teamId, teamId)))
        .limit(1);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (!bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (user.status === "pending") {
        return res.status(403).json({ message: "Account pending approval" });
      }
      if (user.status === "banned") {
        return res.status(403).json({ message: "Account has been banned" });
      }
      req.session.userId = user.id;
      const { passwordHash, ...safeUser } = user;
      let role = null;
      if (user.roleId) {
        const [r] = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);
        role = r || null;
      }
      res.json({ ...safeUser, role });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const teamId = getTeamId();
      const [existing] = await db.select().from(users)
        .where(and(eq(users.username, username), eq(users.teamId, teamId)))
        .limit(1);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const [memberRole] = await db.select().from(roles)
        .where(and(eq(roles.name, "Member"), eq(roles.teamId, teamId)))
        .limit(1);
      const passwordHash = bcrypt.hashSync(password, 10);
      const [newUser] = await db.insert(users).values({
        teamId,
        username,
        passwordHash,
        roleId: memberRole?.id || null,
        status: "pending",
      }).returning();
      const { passwordHash: _, ...safeUser } = newUser;
      res.json({ ...safeUser, message: "Registration successful. Awaiting approval." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const teamId = getTeamId();
      const [user] = await db.select().from(users)
        .where(and(eq(users.id, req.session.userId), eq(users.teamId, teamId)))
        .limit(1);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const { passwordHash, ...safeUser } = user;
      let role = null;
      if (user.roleId) {
        const [r] = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);
        role = r || null;
      }
      res.json({ ...safeUser, role } as UserWithRole);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== USER MANAGEMENT ====================
  app.get("/api/users", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
      const allRoles = await db.select().from(roles).where(eq(roles.teamId, teamId));
      const result: UserWithRole[] = allUsers.map(u => {
        const { passwordHash, ...safeUser } = u;
        const role = allRoles.find(r => r.id === u.roleId) || null;
        return { ...safeUser, role };
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/users/:id/status", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const teamId = getTeamId();
      const [updated] = await db.update(users)
        .set({ status })
        .where(and(eq(users.id, id), eq(users.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { passwordHash, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/users/:id/role", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { id } = req.params;
      const { roleId } = req.body;
      const teamId = getTeamId();
      const [updated] = await db.update(users)
        .set({ roleId })
        .where(and(eq(users.id, id), eq(users.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { passwordHash, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/users/:id/player", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { id } = req.params;
      const { playerId } = req.body;
      const teamId = getTeamId();
      const [updated] = await db.update(users)
        .set({ playerId: playerId || null })
        .where(and(eq(users.id, id), eq(users.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { passwordHash, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/users/:id", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      if (id === req.session.userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      const [deleted] = await db.delete(users)
        .where(and(eq(users.id, id), eq(users.teamId, teamId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "User not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ROLES MANAGEMENT ====================
  app.get("/api/roles", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const allRoles = await db.select().from(roles).where(eq(roles.teamId, teamId));
      res.json(allRoles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/roles", requireAuth, requirePermission("manage_roles"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { name, permissions } = req.body;
      const [role] = await db.insert(roles).values({
        teamId, name, permissions: permissions || [], isSystem: false,
      }).returning();
      res.json(role);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/roles/:id", requireAuth, requirePermission("manage_roles"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const { name, permissions } = req.body;
      const [existing] = await db.select().from(roles)
        .where(and(eq(roles.id, id), eq(roles.teamId, teamId)))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Role not found" });
      if (existing.name === "Owner") return res.status(403).json({ message: "Cannot modify Owner role" });
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (permissions !== undefined) updateData.permissions = permissions;
      const [updated] = await db.update(roles).set(updateData)
        .where(and(eq(roles.id, id), eq(roles.teamId, teamId)))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/roles/:id", requireAuth, requirePermission("manage_roles"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(roles)
        .where(and(eq(roles.id, id), eq(roles.teamId, teamId)))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Role not found" });
      if (existing.isSystem) return res.status(403).json({ message: "Cannot delete system roles" });
      await db.delete(roles).where(and(eq(roles.id, id), eq(roles.teamId, teamId)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== STAFF MANAGEMENT ====================
  app.get("/api/staff", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const allStaff = await db.select().from(staff).where(eq(staff.teamId, teamId));
      res.json(allStaff);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staff", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const validatedData = insertStaffSchema.parse(req.body);
      const [newStaff] = await db.insert(staff).values({ ...validatedData, teamId }).returning();
      res.json(newStaff);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/staff/:id", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const validatedData = insertStaffSchema.partial().parse(req.body);
      const [updated] = await db.update(staff).set(validatedData)
        .where(and(eq(staff.id, id), eq(staff.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Staff not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/staff/:id", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [deleted] = await db.delete(staff)
        .where(and(eq(staff.id, id), eq(staff.teamId, teamId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Staff not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CHAT CHANNELS & MESSAGES ====================
  app.get("/api/chat/channels", requireAuth, requirePermission("access_chat"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const channels = await db.select().from(chatChannels).where(eq(chatChannels.teamId, teamId));
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/channels", requireAuth, requirePermission("manage_chat_channels"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { name } = req.body;
      const [channel] = await db.insert(chatChannels).values({ teamId, name }).returning();
      res.json(channel);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/chat/channels/:id", requireAuth, requirePermission("manage_chat_channels"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.delete(chatChannels).where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/channels/:channelId/messages", requireAuth, requirePermission("access_chat"), async (req, res) => {
    try {
      const { channelId } = req.params;
      const teamId = getTeamId();
      const messages = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.channelId, channelId), eq(chatMessages.teamId, teamId)));
      const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
      const enriched = messages.map(m => {
        const sender = allUsers.find(u => u.id === m.userId);
        return { ...m, senderName: sender?.username || "Unknown" };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/channels/:channelId/messages", requireAuth, requirePermission("access_chat"), async (req, res) => {
    try {
      const { channelId } = req.params;
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const { message, attachmentUrl, attachmentType } = req.body;
      const [msg] = await db.insert(chatMessages).values({
        teamId, channelId, userId, message, attachmentUrl, attachmentType,
      }).returning();
      const [sender] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      res.json({ ...msg, senderName: sender?.username || "Unknown" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/chat/messages/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.delete(chatMessages).where(and(eq(chatMessages.id, id), eq(chatMessages.teamId, teamId)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== AVAILABILITY SLOTS ====================
  app.get("/api/availability-slots", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const slots = await db.select().from(availabilitySlots).where(eq(availabilitySlots.teamId, teamId));
      res.json(slots);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/availability-slots", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const validatedData = insertAvailabilitySlotSchema.parse(req.body);
      const [slot] = await db.insert(availabilitySlots).values({ ...validatedData, teamId }).returning();
      res.json(slot);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/availability-slots/:id", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const { label, sortOrder } = req.body;
      const updateData: any = {};
      if (label !== undefined) updateData.label = label;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      const [updated] = await db.update(availabilitySlots).set(updateData)
        .where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Slot not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/availability-slots/:id", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.delete(availabilitySlots)
        .where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.teamId, teamId)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ROSTER ROLES ====================
  app.get("/api/roster-roles", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const rr = await db.select().from(rosterRoles).where(eq(rosterRoles.teamId, teamId));
      res.json(rr);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/roster-roles", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const validatedData = insertRosterRoleSchema.parse(req.body);
      const [rr] = await db.insert(rosterRoles).values({ ...validatedData, teamId }).returning();
      res.json(rr);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/roster-roles/:id", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const { name, type, sortOrder } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (type !== undefined) updateData.type = type;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      const [updated] = await db.update(rosterRoles).set(updateData)
        .where(and(eq(rosterRoles.id, id), eq(rosterRoles.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Roster role not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/roster-roles/:id", requireAuth, requirePermission("access_dashboard"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.delete(rosterRoles)
        .where(and(eq(rosterRoles.id, id), eq(rosterRoles.teamId, teamId)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== EXISTING ROUTES (now with auth) ====================
  app.get("/api/schedule", requireAuth, async (req, res) => {
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

      const emptySchedule = await storage.saveSchedule({
        weekStartDate: weekStartDate as string,
        weekEndDate: weekEndDate as string,
        scheduleData: { players: [] } as any,
      });

      return res.json(emptySchedule);
    } catch (error: any) {
      console.error('Error in GET /api/schedule:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/schedule", requireAuth, async (req, res) => {
    try {
      const validatedData = insertScheduleSchema.parse(req.body);

      const schedule = await storage.saveSchedule(validatedData);

      res.json(schedule);
    } catch (error: any) {
      console.error('Error in POST /api/schedule:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid schedule data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/players", requireAuth, async (req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (error: any) {
      console.error('Error in GET /api/players:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/players", requireAuth, async (req, res) => {
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

  app.delete("/api/players/:id", requireAuth, async (req, res) => {
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

  app.get("/api/events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error: any) {
      console.error('Error in GET /api/events:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/events", requireAuth, async (req, res) => {
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

  app.put("/api/events/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/events/:id", requireAuth, async (req, res) => {
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

  app.put("/api/players/:id", requireAuth, async (req, res) => {
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

  app.get("/api/attendance", requireAuth, async (req, res) => {
    try {
      const attendance = await storage.getAllAttendance();
      res.json(attendance);
    } catch (error: any) {
      console.error('Error in GET /api/attendance:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/attendance", requireAuth, async (req, res) => {
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

  app.put("/api/attendance/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/attendance/:id", requireAuth, async (req, res) => {
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

  app.get("/api/team-notes", requireAuth, async (req, res) => {
    try {
      const notes = await storage.getTeamNotes();
      res.json(notes);
    } catch (error: any) {
      console.error('Error in GET /api/team-notes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/team-notes", requireAuth, async (req, res) => {
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

  app.delete("/api/team-notes/:id", requireAuth, async (req, res) => {
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

  app.get("/api/events/:eventId/games", requireAuth, async (req, res) => {
    try {
      const { eventId } = req.params;
      const games = await storage.getGamesByEventId(eventId);
      res.json(games);
    } catch (error: any) {
      console.error('Error in GET /api/events/:eventId/games:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // GET /api/games - Aggregated games endpoint for stats pages
  // Supports optional ?scope=scrim|tournament|all filter
  app.get("/api/games", requireAuth, async (req, res) => {
    try {
      const scope = req.query.scope as string | undefined;
      const gamesWithEventType = await storage.getAllGamesWithEventType(scope);
      res.json(gamesWithEventType);
    } catch (error: any) {
      console.error('Error in GET /api/games:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/games", requireAuth, async (req, res) => {
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

  app.put("/api/games/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/games/:id", requireAuth, async (req, res) => {
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

  app.get("/api/game-modes", requireAuth, async (req, res) => {
    try {
      const gameModes = await storage.getAllGameModes();
      res.json(gameModes);
    } catch (error: any) {
      console.error('Error in GET /api/game-modes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/game-modes", requireAuth, async (req, res) => {
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

  app.put("/api/game-modes/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/game-modes/:id", requireAuth, async (req, res) => {
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

  app.get("/api/maps", requireAuth, async (req, res) => {
    try {
      const maps = await storage.getAllMaps();
      res.json(maps);
    } catch (error: any) {
      console.error('Error in GET /api/maps:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/game-modes/:gameModeId/maps", requireAuth, async (req, res) => {
    try {
      const { gameModeId } = req.params;
      const maps = await storage.getMapsByGameModeId(gameModeId);
      res.json(maps);
    } catch (error: any) {
      console.error('Error in GET /api/game-modes/:gameModeId/maps:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/maps", requireAuth, async (req, res) => {
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

  app.put("/api/maps/:id", requireAuth, async (req, res) => {
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

  app.delete("/api/maps/:id", requireAuth, async (req, res) => {
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

  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      console.log('[API] /api/objects/upload - uploadURL:', uploadURL);
      console.log('[API] /api/objects/upload - normalizedPath:', normalizedPath);
      res.json({ uploadURL, normalizedPath });
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

  // Seasons API endpoints
  app.get("/api/seasons", requireAuth, async (req, res) => {
    try {
      const seasons = await storage.getAllSeasons();
      res.json(seasons);
    } catch (error: any) {
      console.error('Error in GET /api/seasons:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/seasons", requireAuth, async (req, res) => {
    try {
      const validatedData = insertSeasonSchema.parse(req.body);
      const season = await storage.addSeason(validatedData);
      res.json(season);
    } catch (error: any) {
      console.error('Error in POST /api/seasons:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid season data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/seasons/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertSeasonSchema.partial().parse(req.body);
      const season = await storage.updateSeason(id, validatedData);
      res.json(season);
    } catch (error: any) {
      console.error('Error in PUT /api/seasons:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid season data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/seasons/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeSeason(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Season not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/seasons:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/off-days", requireAuth, async (req, res) => {
    try {
      const offDays = await storage.getAllOffDays();
      res.json(offDays);
    } catch (error: any) {
      console.error('Error in GET /api/off-days:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/off-days", requireAuth, async (req, res) => {
    try {
      const validatedData = insertOffDaySchema.parse(req.body);
      const offDay = await storage.addOffDay(validatedData);
      res.json(offDay);
    } catch (error: any) {
      console.error('Error in POST /api/off-days:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid off day data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/off-days/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeOffDayById(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Off day not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/off-days:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/off-days/by-date/:date", requireAuth, async (req, res) => {
    try {
      const { date } = req.params;
      const success = await storage.removeOffDay(date);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Off day not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/off-days/by-date:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/events/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const duplicatedEvent = await storage.duplicateEvent(id);
      res.json(duplicatedEvent);
    } catch (error: any) {
      console.error('Error in POST /api/events/:id/duplicate:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/stat-fields", requireAuth, async (req, res) => {
    try {
      const statFields = await storage.getAllStatFields();
      res.json(statFields);
    } catch (error: any) {
      console.error('Error in GET /api/stat-fields:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/stat-fields", requireAuth, async (req, res) => {
    try {
      const validatedData = insertStatFieldSchema.parse(req.body);
      const statField = await storage.addStatField(validatedData);
      res.json(statField);
    } catch (error: any) {
      console.error('Error in POST /api/stat-fields:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid stat field data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/stat-fields/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertStatFieldSchema.partial().parse(req.body);
      const statField = await storage.updateStatField(id, validatedData);
      res.json(statField);
    } catch (error: any) {
      console.error('Error in PUT /api/stat-fields/:id:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid stat field data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/stat-fields/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeStatField(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Stat field not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/stat-fields/:id:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/games/:id/player-stats", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const stats = await storage.getPlayerGameStats(id);
      res.json(stats);
    } catch (error: any) {
      console.error('Error in GET /api/games/:id/player-stats:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/games/:id/player-stats", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { stats } = req.body;
      if (!Array.isArray(stats)) {
        return res.status(400).json({ error: "stats must be an array" });
      }
      const saved = await storage.savePlayerGameStats(id, stats);
      res.json(saved);
    } catch (error: any) {
      console.error('Error in POST /api/games/:id/player-stats:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
