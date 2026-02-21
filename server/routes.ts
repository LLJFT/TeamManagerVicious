import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, ilike, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requirePermission } from "./auth";
import { getTeamId } from "./storage";
import {
  insertScheduleSchema, insertEventSchema, insertPlayerSchema, insertAttendanceSchema,
  insertTeamNotesSchema, insertGameSchema, insertGameModeSchema, insertMapSchema,
  insertSeasonSchema, insertOffDaySchema, insertStatFieldSchema, insertPlayerGameStatSchema,
  insertStaffSchema, insertChatChannelSchema, insertChatMessageSchema,
  insertAvailabilitySlotSchema, insertRosterRoleSchema,
  insertChatChannelPermissionSchema,
  users, roles, chatChannels, chatMessages, availabilitySlots, rosterRoles,
  chatChannelPermissions, activityLogs, playerGameStats, allPermissions,
  players, events, attendance, games, gameModes, maps, seasons, offDays,
  statFields as statFieldsTable,
  staff as staffTable,
  type UserWithRole,
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function logActivity(userId: string | null, action: string, details?: string, logType: string = "team", deviceInfo?: string) {
  try {
    const teamId = getTeamId();
    await db.insert(activityLogs).values({ teamId, userId, action, details, logType, deviceInfo });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  const express = await import("express");
  app.use("/uploads", express.default.static(uploadsDir));

  // ==================== FILE UPLOAD ====================
  app.post("/api/upload", requireAuth, requirePermission("send_messages"), upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      res.json({
        url: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== AUTH ROUTES ====================
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const teamId = getTeamId();
      const [user] = await db.select().from(users)
        .where(and(ilike(users.username, username.trim()), eq(users.teamId, teamId)))
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
      const userAgent = req.headers["user-agent"] || "";
      const { parseUserAgent } = await import("./auth");
      const deviceInfo = parseUserAgent(userAgent);
      req.session.userId = user.id;
      (req.session as any).deviceInfo = deviceInfo;
      (req.session as any).createdAt = new Date().toISOString();
      await db.update(users)
        .set({ lastSeen: new Date().toISOString(), lastUserAgent: deviceInfo })
        .where(eq(users.id, user.id));
      logActivity(user.id, "login", `User ${user.username} logged in`, "system", deviceInfo);
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
        .where(and(ilike(users.username, username.trim()), eq(users.teamId, teamId)))
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
      logActivity(null, "register", `User ${username} registered (pending approval)`, "system");
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

  // ==================== ACCOUNT SETTINGS ====================
  app.put("/api/auth/settings", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      
      const { username, currentPassword, newPassword, avatarUrl } = req.body;
      
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!currentUser) return res.status(404).json({ message: "User not found" });
      
      if (newPassword) {
        if (!currentPassword) return res.status(400).json({ message: "Current password required" });
        const valid = await bcrypt.compare(currentPassword, currentUser.passwordHash);
        if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      const updates: any = {};
      if (username && username.trim() !== currentUser.username) {
        const teamId = getTeamId();
        const [dup] = await db.select().from(users)
          .where(and(ilike(users.username, username.trim()), eq(users.teamId, teamId)))
          .limit(1);
        if (dup && dup.id !== userId) return res.status(400).json({ message: "Username already taken" });
        updates.username = username.trim();
      }
      if (newPassword) updates.passwordHash = await bcrypt.hash(newPassword, 10);
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, userId));
        if (updates.username) logActivity(userId, "username_change", `Changed username to ${updates.username}`, "system");
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== USER MANAGEMENT ====================
  app.get("/api/chat/users", requireAuth, requirePermission("view_chat"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const allUsers = await db.select().from(users).where(and(eq(users.teamId, teamId), eq(users.status, "active")));
      const result = allUsers.map(u => ({ id: u.id, username: u.username, status: u.status, roleId: u.roleId }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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

  app.post("/api/users/create", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { username, password, roleId, status } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });
      
      const teamId = getTeamId();
      
      const existing = await db.select().from(users).where(and(ilike(users.username, username.trim()), eq(users.teamId, teamId)));
      if (existing.length > 0) return res.status(400).json({ message: "Username already taken" });
      
      const passwordHash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(users).values({
        teamId,
        username,
        passwordHash,
        roleId: roleId || null,
        status: status || "active",
      }).returning();
      
      logActivity(req.session.userId!, "create_user", `Created user ${username}`, "system");
      res.json(newUser);
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
      logActivity(req.session.userId!, "user_status_change", `Changed ${updated.username} status to ${status}`);
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
      logActivity(req.session.userId!, "user_role_change", `Changed ${updated.username} role`);
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
      logActivity(req.session.userId!, "link_player", `Linked player to user ${updated.username}`, "system");
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
      logActivity(req.session.userId!, "delete_user", `Deleted user ${deleted.username}`, "system");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/users/:id/rename", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { id } = req.params;
      const { username } = req.body;
      if (!username || !username.trim()) return res.status(400).json({ message: "Username required" });
      const teamId = getTeamId();
      const [dup] = await db.select().from(users)
        .where(and(ilike(users.username, username.trim()), eq(users.teamId, teamId)))
        .limit(1);
      if (dup && dup.id !== id) return res.status(400).json({ message: "Username already taken" });
      const [updated] = await db.update(users)
        .set({ username: username.trim() })
        .where(and(eq(users.id, id), eq(users.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });
      logActivity(req.session.userId!, "admin_rename_user", `Renamed user to ${username.trim()}`, "system");
      const { passwordHash, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/sessions", requireAuth, async (req, res) => {
    try {
      const userId = String(req.session.userId);
      const currentSid = req.sessionID;
      const result = await db.execute(sql`
        SELECT sid, sess, expire FROM "session" 
        WHERE sess::jsonb->>'userId' = ${userId}
        ORDER BY expire DESC
      `);
      const sessions = (result.rows || []).map((row: any) => {
        const sess = typeof row.sess === "string" ? JSON.parse(row.sess) : row.sess;
        return {
          sid: row.sid,
          isCurrent: row.sid === currentSid,
          deviceInfo: sess.deviceInfo || null,
          createdAt: sess.createdAt || null,
          expiresAt: row.expire,
        };
      });
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/sessions/:sid", requireAuth, async (req, res) => {
    try {
      const { sid } = req.params;
      const userId = req.session.userId;
      const result = await db.execute(sql`
        SELECT sess FROM "session" WHERE sid = ${sid}
      `);
      if (!result.rows || result.rows.length === 0) return res.status(404).json({ message: "Session not found" });
      const sess = typeof result.rows[0].sess === "string" ? JSON.parse(result.rows[0].sess) : result.rows[0].sess;
      if (String(sess.userId) !== String(userId)) {
        return res.status(403).json({ message: "Cannot terminate another user's session" });
      }
      await db.execute(sql`DELETE FROM "session" WHERE sid = ${sid}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/sessions/:userId", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { userId } = req.params;
      await db.execute(sql`
        DELETE FROM "session" WHERE sess::jsonb->>'userId' = ${userId}
      `);
      logActivity(req.session.userId!, "admin_terminate_sessions", `Terminated all sessions for user ${userId}`, "system");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/sessions/:userId", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await db.execute(sql`
        SELECT sid, sess, expire FROM "session" 
        WHERE sess::jsonb->>'userId' = ${userId}
        ORDER BY expire DESC
      `);
      const sessions = (result.rows || []).map((row: any) => {
        const sess = typeof row.sess === "string" ? JSON.parse(row.sess) : row.sess;
        return {
          sid: row.sid,
          deviceInfo: sess.deviceInfo || null,
          createdAt: sess.createdAt || null,
          expiresAt: row.expire,
        };
      });
      res.json(sessions);
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
      logActivity(req.session.userId!, "create_role", `Created role "${name}"`);
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
      logActivity(req.session.userId!, "edit_role", `Updated role "${updated.name}"`);
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
      logActivity(req.session.userId!, "delete_role", `Deleted role "${existing.name}"`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== STAFF MANAGEMENT ====================
  app.get("/api/staff", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const allStaff = await db.select().from(staffTable).where(eq(staffTable.teamId, teamId));
      res.json(allStaff);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staff", requireAuth, requirePermission("manage_staff"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const validatedData = insertStaffSchema.parse(req.body);
      const [newStaff] = await db.insert(staffTable).values({ ...validatedData, teamId }).returning();
      logActivity(req.session.userId!, "add_staff", `Added staff member "${newStaff.name}"`);
      res.json(newStaff);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/staff/:id", requireAuth, requirePermission("manage_staff"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const validatedData = insertStaffSchema.partial().parse(req.body);
      const [updated] = await db.update(staffTable).set(validatedData)
        .where(and(eq(staffTable.id, id), eq(staffTable.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Staff not found" });
      logActivity(req.session.userId!, "edit_staff", `Updated staff member "${updated.name}"`);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/staff/:id", requireAuth, requirePermission("manage_staff"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [deleted] = await db.delete(staffTable)
        .where(and(eq(staffTable.id, id), eq(staffTable.teamId, teamId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Staff not found" });
      logActivity(req.session.userId!, "remove_staff", `Removed staff member "${deleted.name}"`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CHAT CHANNELS & MESSAGES ====================
  app.get("/api/chat/channels", requireAuth, requirePermission("view_chat"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const channels = await db.select().from(chatChannels).where(eq(chatChannels.teamId, teamId));
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const perms = await db.select().from(chatChannelPermissions).where(eq(chatChannelPermissions.teamId, teamId));

      const filteredChannels = channels.filter(ch => {
        if (!currentUser?.roleId) return true;
        const channelPerms = perms.filter(p => p.channelId === ch.id && p.roleId === currentUser.roleId);
        if (channelPerms.length === 0) return true;
        return channelPerms.some(p => p.canView);
      });

      const enriched = filteredChannels.map(ch => {
        const channelPerms = perms.filter(p => p.channelId === ch.id && currentUser?.roleId && p.roleId === currentUser.roleId);
        const canSend = channelPerms.length === 0 || channelPerms.some(p => p.canSend);
        return { ...ch, canSend };
      });

      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/channels", requireAuth, requirePermission("manage_channels"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { name } = req.body;
      const [channel] = await db.insert(chatChannels).values({ teamId, name }).returning();
      logActivity(req.session.userId!, "create_channel", `Created chat channel "${channel.name}"`);
      res.json(channel);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/chat/channels/:id", requireAuth, requirePermission("manage_channels"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ message: "Channel name is required" });
      const [updated] = await db.update(chatChannels)
        .set({ name: name.trim() })
        .where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Channel not found" });
      logActivity(req.session.userId!, "edit_channel", `Updated chat channel`);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/chat/channels/:id", requireAuth, requirePermission("manage_channels"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.delete(chatChannels).where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId)));
      logActivity(req.session.userId!, "delete_channel", `Deleted chat channel`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/channels/:channelId/messages", requireAuth, requirePermission("view_chat"), async (req, res) => {
    try {
      const { channelId } = req.params;
      const teamId = getTeamId();
      const messages = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.channelId, channelId), eq(chatMessages.teamId, teamId)));
      const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
      const allRoles = await db.select().from(roles).where(eq(roles.teamId, teamId));
      const enriched = messages.map(m => {
        const sender = allUsers.find(u => u.id === m.userId);
        const senderRole = sender?.roleId ? allRoles.find(r => r.id === sender.roleId) : null;
        return {
          ...m,
          senderName: sender?.username || "Unknown",
          senderAvatarUrl: sender?.avatarUrl || null,
          senderRoleName: senderRole?.name || null,
        };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/channels/:channelId/messages", requireAuth, requirePermission("send_messages"), async (req, res) => {
    try {
      const { channelId } = req.params;
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const { message, attachmentUrl, attachmentType, attachmentName, attachmentSize, mentions } = req.body;
      const [msg] = await db.insert(chatMessages).values({
        teamId, channelId, userId, message, attachmentUrl, attachmentType,
        attachmentName: attachmentName || null, attachmentSize: attachmentSize || null,
        mentions: mentions || [],
      }).returning();
      const [sender] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const senderRoleData = sender?.roleId ? await db.select().from(roles).where(eq(roles.id, sender.roleId)).limit(1) : [];
      res.json({
        ...msg,
        senderName: sender?.username || "Unknown",
        senderAvatarUrl: sender?.avatarUrl || null,
        senderRoleName: senderRoleData.length > 0 ? senderRoleData[0].name : null,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/chat/messages/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const userId = req.session.userId!;

      const [msg] = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.id, id), eq(chatMessages.teamId, teamId)))
        .limit(1);
      if (!msg) return res.status(404).json({ message: "Message not found" });

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const [userRole] = currentUser?.roleId
        ? await db.select().from(roles).where(eq(roles.id, currentUser.roleId)).limit(1)
        : [null];
      const perms = (userRole?.permissions as string[]) || [];
      const isOwner = userRole?.name === "Owner";
      const isOwnMessage = msg.userId === userId;

      if (!isOwner && !isOwnMessage && !perms.includes("delete_any_message")) {
        if (!perms.includes("delete_own_messages")) {
          return res.status(403).json({ message: "No permission to delete messages" });
        }
        return res.status(403).json({ message: "You can only delete your own messages" });
      }
      if (!isOwner && isOwnMessage && !perms.includes("delete_own_messages") && !perms.includes("delete_any_message")) {
        return res.status(403).json({ message: "No permission to delete messages" });
      }

      await db.delete(chatMessages).where(and(eq(chatMessages.id, id), eq(chatMessages.teamId, teamId)));
      logActivity(req.session.userId!, "delete_message", `Deleted chat message`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CHANNEL PERMISSIONS ====================
  app.get("/api/chat/channels/:channelId/permissions", requireAuth, requirePermission("manage_channels"), async (req, res) => {
    try {
      const { channelId } = req.params;
      const teamId = getTeamId();
      const perms = await db.select().from(chatChannelPermissions)
        .where(and(eq(chatChannelPermissions.channelId, channelId), eq(chatChannelPermissions.teamId, teamId)));
      res.json(perms);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/channels/:channelId/permissions", requireAuth, requirePermission("manage_channels"), async (req, res) => {
    try {
      const { channelId } = req.params;
      const teamId = getTeamId();
      const { roleId, canView, canSend } = req.body;
      const existing = await db.select().from(chatChannelPermissions)
        .where(and(
          eq(chatChannelPermissions.channelId, channelId),
          eq(chatChannelPermissions.roleId, roleId),
          eq(chatChannelPermissions.teamId, teamId)
        ));
      if (existing.length > 0) {
        const [updated] = await db.update(chatChannelPermissions)
          .set({ canView: canView ?? true, canSend: canSend ?? true })
          .where(eq(chatChannelPermissions.id, existing[0].id))
          .returning();
        return res.json(updated);
      }
      const [perm] = await db.insert(chatChannelPermissions)
        .values({ teamId, channelId, roleId, canView: canView ?? true, canSend: canSend ?? true })
        .returning();
      res.json(perm);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/chat/channel-permissions/:id", requireAuth, requirePermission("manage_channels"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.delete(chatChannelPermissions).where(and(eq(chatChannelPermissions.id, id), eq(chatChannelPermissions.teamId, teamId)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ACTIVITY LOGS ====================
  app.get("/api/activity-logs", requireAuth, requirePermission("view_activity_log"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const logTypeFilter = req.query.logType as string | undefined;
      const conditions = [eq(activityLogs.teamId, teamId)];
      if (logTypeFilter) {
        conditions.push(eq(activityLogs.logType, logTypeFilter));
      }
      const logs = await db.select().from(activityLogs)
        .where(and(...conditions))
        .orderBy(activityLogs.createdAt);
      const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
      const enriched = logs.map(l => {
        const actor = l.userId ? allUsers.find(u => u.id === l.userId) : null;
        return { ...l, actorName: actor?.username || "System" };
      });
      res.json(enriched.reverse().slice(0, 500));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/activity-logs", requireAuth, requirePermission("view_activity_log"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = getTeamId();
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.roleId) return res.status(403).json({ message: "Forbidden" });
      const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId));
      if (role?.name !== "Owner") return res.status(403).json({ message: "Only the Owner can clear logs" });
      const logTypeFilter = req.query.logType as string | undefined;
      if (logTypeFilter) {
        await db.delete(activityLogs).where(and(eq(activityLogs.teamId, teamId), eq(activityLogs.logType, logTypeFilter)));
      } else {
        await db.delete(activityLogs).where(eq(activityLogs.teamId, teamId));
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/activity-logs/:id", requireAuth, requirePermission("view_activity_log"), async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teamId = getTeamId();
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.roleId) return res.status(403).json({ message: "Forbidden" });
      const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId));
      if (role?.name !== "Owner") return res.status(403).json({ message: "Only the Owner can delete log entries" });
      const { id } = req.params;
      await db.delete(activityLogs).where(and(eq(activityLogs.id, id), eq(activityLogs.teamId, teamId)));
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

  app.post("/api/availability-slots", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const validatedData = insertAvailabilitySlotSchema.parse(req.body);
      const [slot] = await db.insert(availabilitySlots).values({ ...validatedData, teamId }).returning();
      logActivity(req.session.userId!, "add_availability_slot", `Added availability slot "${slot.label}"`);
      res.json(slot);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/availability-slots/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
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
      logActivity(req.session.userId!, "edit_availability_slot", `Updated availability slot`);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/availability-slots/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.delete(availabilitySlots)
        .where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.teamId, teamId)));
      logActivity(req.session.userId!, "delete_availability_slot", `Deleted availability slot`);
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

  app.post("/api/roster-roles", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const validatedData = insertRosterRoleSchema.parse(req.body);
      const [rr] = await db.insert(rosterRoles).values({ ...validatedData, teamId }).returning();
      logActivity(req.session.userId!, "add_roster_role", `Added roster role "${rr.name}"`);
      res.json(rr);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/roster-roles/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
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
      logActivity(req.session.userId!, "edit_roster_role", `Updated roster role "${updated.name}"`);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/roster-roles/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.delete(rosterRoles)
        .where(and(eq(rosterRoles.id, id), eq(rosterRoles.teamId, teamId)));
      logActivity(req.session.userId!, "delete_roster_role", `Deleted roster role`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== PLAYER AVAILABILITY ====================
  app.get("/api/player-availability", requireAuth, async (req, res) => {
    try {
      const records = await storage.getPlayerAvailabilities();
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/player-availability", requireAuth, async (req, res) => {
    try {
      const { playerId, day, availability } = req.body;
      if (!playerId || !day || !availability) {
        return res.status(400).json({ message: "playerId, day, and availability required" });
      }

      const teamId = getTeamId();
      const [currentUser] = await db.select().from(users).where(and(eq(users.id, req.session.userId!), eq(users.teamId, teamId))).limit(1);
      if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

      const [userRole] = currentUser.roleId ? await db.select().from(roles).where(and(eq(roles.id, currentUser.roleId), eq(roles.teamId, teamId))).limit(1) : [];
      const perms = userRole?.name === "Owner" ? [...allPermissions] : ((userRole?.permissions as string[]) || []);

      const hasEditAll = perms.includes("edit_all_availability");
      const hasEditOwn = perms.includes("edit_own_availability");
      const isOwnPlayer = currentUser.playerId === playerId;

      if (!hasEditAll && !(hasEditOwn && isOwnPlayer)) {
        return res.status(403).json({ message: "No permission to edit this player's availability" });
      }

      const record = await storage.savePlayerAvailability(playerId, day, availability);
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/player-availability/bulk", requireAuth, async (req, res) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "updates must be an array" });
      }

      const teamId = getTeamId();
      const [currentUser] = await db.select().from(users).where(and(eq(users.id, req.session.userId!), eq(users.teamId, teamId))).limit(1);
      if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

      const [userRole] = currentUser.roleId ? await db.select().from(roles).where(and(eq(roles.id, currentUser.roleId), eq(roles.teamId, teamId))).limit(1) : [];
      const perms = userRole?.name === "Owner" ? [...allPermissions] : ((userRole?.permissions as string[]) || []);
      const hasEditAll = perms.includes("edit_all_availability");
      const hasEditOwn = perms.includes("edit_own_availability");

      const results = [];
      for (const { playerId, day, availability } of updates) {
        const isOwnPlayer = currentUser.playerId === playerId;
        if (!hasEditAll && !(hasEditOwn && isOwnPlayer)) {
          return res.status(403).json({ message: "No permission to edit this player's availability" });
        }
        const record = await storage.savePlayerAvailability(playerId, day, availability);
        results.push(record);
      }
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== STAFF AVAILABILITY ====================
  app.get("/api/staff-availability", requireAuth, async (req, res) => {
    try {
      const records = await storage.getStaffAvailabilities();
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staff-availability", requireAuth, requirePermission("edit_own_availability"), async (req, res) => {
    try {
      const { staffId, day, availability } = req.body;
      if (!staffId || !day || !availability) {
        return res.status(400).json({ message: "staffId, day, and availability required" });
      }
      const record = await storage.saveStaffAvailability(staffId, day, availability);
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staff-availability/bulk", requireAuth, requirePermission("edit_own_availability"), async (req, res) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "updates must be an array" });
      }
      const results = [];
      for (const { staffId, day, availability } of updates) {
        const record = await storage.saveStaffAvailability(staffId, day, availability);
        results.push(record);
      }
      res.json(results);
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

  app.post("/api/schedule", requireAuth, requirePermission("edit_all_availability"), async (req, res) => {
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

  app.post("/api/players", requireAuth, requirePermission("add_players"), async (req, res) => {
    try {
      const validatedData = insertPlayerSchema.parse(req.body);
      const player = await storage.addPlayer(validatedData);
      logActivity(req.session.userId!, "add_player", `Added player "${player.name}"`);
      res.json(player);
    } catch (error: any) {
      console.error('Error in POST /api/players:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid player data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/players/:id", requireAuth, requirePermission("remove_players"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removePlayer(id);
      if (success) {
        logActivity(req.session.userId!, "remove_player", `Removed player`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Player not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/players:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/events", requireAuth, requirePermission("view_events"), async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error: any) {
      console.error('Error in GET /api/events:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/events", requireAuth, requirePermission("create_events"), async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.addEvent(validatedData);
      logActivity(req.session.userId!, "create_event", `Created event "${event.title}"`);
      res.json(event);
    } catch (error: any) {
      console.error('Error in POST /api/events:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/events/:id", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(id, validatedData);
      logActivity(req.session.userId!, "edit_event", `Updated event "${event.title}"`);
      res.json(event);
    } catch (error: any) {
      console.error('Error in PUT /api/events:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/events/:id", requireAuth, requirePermission("delete_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeEvent(id);
      if (success) {
        logActivity(req.session.userId!, "delete_event", `Deleted event`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Event not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/events:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/players/:id", requireAuth, requirePermission("edit_players"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertPlayerSchema.partial().parse(req.body);
      const player = await storage.updatePlayer(id, validatedData);
      logActivity(req.session.userId!, "edit_player", `Updated player "${player.name}"`);
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

  app.post("/api/attendance", requireAuth, requirePermission("edit_events"), async (req, res) => {
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

  app.put("/api/attendance/:id", requireAuth, requirePermission("edit_events"), async (req, res) => {
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

  app.delete("/api/attendance/:id", requireAuth, requirePermission("edit_events"), async (req, res) => {
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

  app.post("/api/team-notes", requireAuth, requirePermission("view_chat"), async (req, res) => {
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

  app.delete("/api/team-notes/:id", requireAuth, requirePermission("view_chat"), async (req, res) => {
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

  app.post("/api/games", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const validatedData = insertGameSchema.parse(req.body);
      const game = await storage.addGame(validatedData);
      logActivity(req.session.userId!, "add_game", `Added game to event`);
      res.json(game);
    } catch (error: any) {
      console.error('Error in POST /api/games:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/games/:id", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertGameSchema.partial().parse(req.body);
      const game = await storage.updateGame(id, validatedData);
      logActivity(req.session.userId!, "edit_game", `Updated game`);
      res.json(game);
    } catch (error: any) {
      console.error('Error in PUT /api/games:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/games/:id", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeGame(id);
      if (success) {
        logActivity(req.session.userId!, "delete_game", `Deleted game`);
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

  app.post("/api/game-modes", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertGameModeSchema.parse(req.body);
      const gameMode = await storage.addGameMode(validatedData);
      logActivity(req.session.userId!, "add_game_mode", `Added game mode "${gameMode.name}"`);
      res.json(gameMode);
    } catch (error: any) {
      console.error('Error in POST /api/game-modes:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game mode data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/game-modes/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertGameModeSchema.partial().parse(req.body);
      const gameMode = await storage.updateGameMode(id, validatedData);
      logActivity(req.session.userId!, "edit_game_mode", `Updated game mode "${gameMode.name}"`);
      res.json(gameMode);
    } catch (error: any) {
      console.error('Error in PUT /api/game-modes:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game mode data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/game-modes/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeGameMode(id);
      if (success) {
        logActivity(req.session.userId!, "delete_game_mode", `Deleted game mode`);
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

  app.post("/api/maps", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertMapSchema.parse(req.body);
      const map = await storage.addMap(validatedData);
      logActivity(req.session.userId!, "add_map", `Added map "${map.name}"`);
      res.json(map);
    } catch (error: any) {
      console.error('Error in POST /api/maps:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid map data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/maps/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertMapSchema.partial().parse(req.body);
      const map = await storage.updateMap(id, validatedData);
      logActivity(req.session.userId!, "edit_map", `Updated map "${map.name}"`);
      res.json(map);
    } catch (error: any) {
      console.error('Error in PUT /api/maps:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid map data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/maps/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeMap(id);
      if (success) {
        logActivity(req.session.userId!, "delete_map", `Deleted map`);
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

  app.post("/api/seasons", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertSeasonSchema.parse(req.body);
      const season = await storage.addSeason(validatedData);
      logActivity(req.session.userId!, "add_season", `Added season "${season.name}"`);
      res.json(season);
    } catch (error: any) {
      console.error('Error in POST /api/seasons:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid season data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/seasons/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertSeasonSchema.partial().parse(req.body);
      const season = await storage.updateSeason(id, validatedData);
      logActivity(req.session.userId!, "edit_season", `Updated season "${season.name}"`);
      res.json(season);
    } catch (error: any) {
      console.error('Error in PUT /api/seasons:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid season data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/seasons/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeSeason(id);
      if (success) {
        logActivity(req.session.userId!, "delete_season", `Deleted season`);
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

  app.post("/api/off-days", requireAuth, requirePermission("create_events"), async (req, res) => {
    try {
      const validatedData = insertOffDaySchema.parse(req.body);
      const offDay = await storage.addOffDay(validatedData);
      logActivity(req.session.userId!, "add_off_day", `Added off day on ${offDay.date}`);
      res.json(offDay);
    } catch (error: any) {
      console.error('Error in POST /api/off-days:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid off day data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/off-days/:id", requireAuth, requirePermission("delete_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeOffDayById(id);
      if (success) {
        logActivity(req.session.userId!, "remove_off_day", `Removed off day`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Off day not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/off-days:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/off-days/by-date/:date", requireAuth, requirePermission("delete_events"), async (req, res) => {
    try {
      const { date } = req.params;
      const success = await storage.removeOffDay(date);
      if (success) {
        logActivity(req.session.userId!, "remove_off_day", `Removed off day on ${date}`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Off day not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/off-days/by-date:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/events/:id/duplicate", requireAuth, requirePermission("create_events"), async (req, res) => {
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

  app.post("/api/stat-fields", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertStatFieldSchema.parse(req.body);
      const statField = await storage.addStatField(validatedData);
      logActivity(req.session.userId!, "add_stat_field", `Added stat field "${statField.name}"`);
      res.json(statField);
    } catch (error: any) {
      console.error('Error in POST /api/stat-fields:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid stat field data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/stat-fields/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertStatFieldSchema.partial().parse(req.body);
      const statField = await storage.updateStatField(id, validatedData);
      logActivity(req.session.userId!, "edit_stat_field", `Updated stat field`);
      res.json(statField);
    } catch (error: any) {
      console.error('Error in PUT /api/stat-fields/:id:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid stat field data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/stat-fields/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.removeStatField(id);
      if (success) {
        logActivity(req.session.userId!, "delete_stat_field", `Deleted stat field`);
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

  app.post("/api/games/:id/player-stats", requireAuth, requirePermission("edit_events"), async (req, res) => {
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

  app.get("/api/player-stats-summary", requireAuth, requirePermission("view_player_stats"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const allPlayers = await storage.getAllPlayers();
      const allStatFields = await db.select().from(statFieldsTable).where(eq(statFieldsTable.teamId, teamId));
      const allPlayerGameStats = await db.select().from(playerGameStats).where(eq(playerGameStats.teamId, teamId));
      const allGames = await storage.getAllGamesWithEventType();
      const allEvents = await storage.getAllEvents();
      const allGameModes = await storage.getAllGameModes();

      const summary = allPlayers.map(player => {
        const playerStats = allPlayerGameStats.filter(s => s.playerId === player.id);
        const gameIds = Array.from(new Set(playerStats.map(s => s.gameId)));
        const gamesPlayed = gameIds.length;

        const statAggregatesByName: Record<string, { fieldName: string; total: number; count: number; avg: number }> = {};
        for (const stat of playerStats) {
          const field = allStatFields.find(f => f.id === stat.statFieldId);
          if (!field) continue;
          const key = field.name;
          if (!statAggregatesByName[key]) {
            statAggregatesByName[key] = { fieldName: field.name, total: 0, count: 0, avg: 0 };
          }
          const val = parseFloat(stat.value) || 0;
          statAggregatesByName[key].total += val;
          statAggregatesByName[key].count += 1;
        }
        for (const key of Object.keys(statAggregatesByName)) {
          const agg = statAggregatesByName[key];
          agg.avg = agg.count > 0 ? Math.round((agg.total / agg.count) * 100) / 100 : 0;
        }

        const opponentStats: Record<string, { opponent: string; wins: number; losses: number; draws: number; gamesPlayed: number; stats: Record<string, { fieldName: string; total: number; count: number; avg: number }> }> = {};
        for (const gameId of gameIds) {
          const game = allGames.find(g => g.id === gameId);
          if (!game) continue;
          const event = allEvents.find(e => e.id === game.eventId);
          if (!event || !event.opponentName) continue;
          const opp = event.opponentName;
          if (!opponentStats[opp]) {
            opponentStats[opp] = { opponent: opp, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, stats: {} };
          }
          opponentStats[opp].gamesPlayed++;
          if (game.result === "win") opponentStats[opp].wins++;
          else if (game.result === "loss") opponentStats[opp].losses++;
          else if (game.result === "draw") opponentStats[opp].draws++;

          const gameStats = playerStats.filter(s => s.gameId === gameId);
          for (const gs of gameStats) {
            const field = allStatFields.find(f => f.id === gs.statFieldId);
            if (!field) continue;
            const fname = field.name;
            if (!opponentStats[opp].stats[fname]) {
              opponentStats[opp].stats[fname] = { fieldName: fname, total: 0, count: 0, avg: 0 };
            }
            const val = parseFloat(gs.value) || 0;
            opponentStats[opp].stats[fname].total += val;
            opponentStats[opp].stats[fname].count += 1;
          }
        }
        for (const opp of Object.values(opponentStats)) {
          for (const st of Object.values(opp.stats)) {
            st.avg = st.count > 0 ? Math.round((st.total / st.count) * 100) / 100 : 0;
          }
        }

        const statsByMode: Record<string, { modeName: string; stats: { fieldName: string; total: number; count: number; avg: number }[] }> = {};
        for (const stat of playerStats) {
          const field = allStatFields.find(f => f.id === stat.statFieldId);
          if (!field) continue;
          const game = allGames.find(g => g.id === stat.gameId);
          const modeId = game?.gameModeId || "unknown";
          const modeObj = allGameModes.find(m => m.id === modeId);
          const modeName = modeObj?.name || "Unknown";
          if (!statsByMode[modeId]) {
            statsByMode[modeId] = { modeName, stats: [] };
          }
          let modeStat = statsByMode[modeId].stats.find(s => s.fieldName === field.name);
          if (!modeStat) {
            modeStat = { fieldName: field.name, total: 0, count: 0, avg: 0 };
            statsByMode[modeId].stats.push(modeStat);
          }
          const val = parseFloat(stat.value) || 0;
          modeStat.total += val;
          modeStat.count += 1;
        }
        for (const mode of Object.values(statsByMode)) {
          for (const st of mode.stats) {
            st.avg = st.count > 0 ? Math.round((st.total / st.count) * 100) / 100 : 0;
          }
        }

        const eventTypeGames: Record<string, number> = {};
        for (const gameId of gameIds) {
          const game = allGames.find(g => g.id === gameId);
          if (!game) continue;
          const eventType = (game as any).eventType || "unknown";
          eventTypeGames[eventType] = (eventTypeGames[eventType] || 0) + 1;
        }

        const opponentsList = Object.values(opponentStats).map(o => ({
          ...o,
          stats: Object.values(o.stats),
        }));

        return {
          player: { id: player.id, name: player.name, role: player.role },
          gamesPlayed,
          stats: Object.values(statAggregatesByName),
          statsByMode: Object.values(statsByMode),
          opponents: opponentsList,
          eventTypeGames,
        };
      });

      res.json(summary);
    } catch (error: any) {
      console.error("Error in GET /api/player-stats-summary:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
