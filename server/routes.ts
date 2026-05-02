import express from "express";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, ilike, sql, isNull, inArray, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requirePermission, requireOrgRole, requireGameAccess } from "./auth";
import { getTeamId } from "./storage";
import {
  insertScheduleSchema, insertEventSchema, insertPlayerSchema, insertAttendanceSchema,
  insertTeamNotesSchema, insertGameSchema, insertGameModeSchema, insertMapSchema,
  insertSeasonSchema, insertOffDaySchema, insertStatFieldSchema, insertPlayerGameStatSchema,
  insertStaffSchema, insertChatChannelSchema, insertChatMessageSchema,
  insertAvailabilitySlotSchema, insertRosterRoleSchema,
  insertChatChannelPermissionSchema, insertEventCategorySchema, insertEventSubTypeSchema,
  insertSideSchema, insertGameRoundSchema,
  heroBanSystems, mapVetoSystems, gameHeroBanActions, gameMapVetoRows,
  insertHeroBanSystemSchema, insertMapVetoSystemSchema,
  insertGameHeroBanActionSchema, insertGameMapVetoRowSchema,
  heroBanActionTypes, mapVetoActionTypes, banVetoTeamSlots,
  users, roles, chatChannels, chatMessages, availabilitySlots, rosterRoles,
  chatChannelPermissions, activityLogs, playerGameStats, allPermissions,
  players, events, attendance, teamNotes, games, gameModes, maps, seasons, offDays,
  heroes, heroRoleConfigs, gameHeroes, insertHeroSchema, insertHeroRoleConfigSchema, insertGameHeroSchema,
  opponents, opponentPlayers, matchParticipants, opponentPlayerGameStats,
  insertOpponentSchema, insertOpponentPlayerSchema, insertMatchParticipantSchema, insertOpponentPlayerGameStatSchema,
  statFields as statFieldsTable,
  staff as staffTable,
  supportedGames, userGameAssignments, notifications, rosters,
  eventCategories, eventSubTypes, sides, gameRounds,
  settings,
  mediaFolders, mediaItems, insertMediaFolderSchema, insertMediaItemSchema,
  type UserWithRole,
  GAME_ABBREVIATIONS,
} from "@shared/schema";
import { defaultColorForSortOrder } from "@shared/role-colors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { MARVEL_RIVALS_DEFAULT_HEROES, MARVEL_RIVALS_GAME_SLUG, HEROES_SEEDED_SETTING_KEY } from "./defaults/marvelRivalsHeroes";
import { OVERWATCH_DEFAULT_HEROES, OVERWATCH_GAME_SLUG } from "./defaults/overwatchHeroes";
import { HEROES_SEED_LOCK_KEY } from "./ensure-overwatch-heroes";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
for (const sub of ["logos", "game-icons", "chat", "general"]) {
  fs.mkdirSync(path.join(UPLOAD_DIR, sub), { recursive: true });
}

// One-time startup cleanup: quarantine any previously-uploaded files whose
// extension is not in the allowlist (e.g. legacy .svg files).
const QUARANTINE_DIR = path.join(UPLOAD_DIR, "_quarantine");
fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
(function quarantineDisallowedUploads() {
  const ALLOWED_UPLOAD_EXTS = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".ico",
    ".mp4", ".mov", ".webm", ".avi",
    ".mp3", ".m4a", ".ogg", ".wav", ".aac", ".opus",
    ".pdf", ".zip", ".rar", ".7z", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv",
  ]);
  for (const sub of ["logos", "game-icons", "chat", "general"]) {
    const dir = path.join(UPLOAD_DIR, sub);
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!ALLOWED_UPLOAD_EXTS.has(ext)) {
          const src = path.join(dir, file);
          const dst = path.join(QUARANTINE_DIR, `${sub}_${file}`);
          try {
            fs.renameSync(src, dst);
            console.log(`[security] Quarantined disallowed upload: ${sub}/${file}`);
          } catch (e) {
            console.error(`[security] Failed to quarantine ${sub}/${file}:`, e);
          }
        }
      }
    } catch (e) {
      // Directory may not exist yet or be unreadable – ignore
    }
  }
})();

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".ico",
  ".mp4", ".mov", ".webm", ".avi",
  ".mp3", ".m4a", ".ogg", ".wav", ".aac", ".opus",
  ".pdf", ".zip", ".rar", ".7z", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv",
]);

// Kept for reference only – the upload filter now uses the ALLOWED_EXTENSIONS allowlist above.
// Any extension absent from ALLOWED_EXTENSIONS is rejected, making this list redundant.
// const BLOCKED_EXTENSIONS = [...];

function createDiskUpload(subfolder: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(UPLOAD_DIR, subfolder);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || "";
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return cb(new Error(`File type ${ext} is not allowed`));
      }
      cb(null, true);
    },
  });
}

const uploadGeneral = createDiskUpload("general");
const uploadLogo = createDiskUpload("logos");
const uploadGameIcon = createDiskUpload("game-icons");
const uploadChat = createDiskUpload("chat");

function getGameId(req: any): string | null {
  return (req.query.gameId as string) || null;
}

function getRosterId(req: any): string | null {
  return (req.query.rosterId as string) || null;
}


async function verifyChatChannelScope(channelId: string, req: any, res: any): Promise<boolean> {
  const teamId = getTeamId();
  const [channel] = await db.select().from(chatChannels).where(and(eq(chatChannels.id, channelId), eq(chatChannels.teamId, teamId))).limit(1);
  if (!channel) { res.status(404).json({ message: "Channel not found" }); return false; }
  if (!channel.gameId) return true;
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ message: "Unauthorized" }); return false; }
  const [user] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
  if (!user) { res.status(403).json({ message: "Forbidden" }); return false; }
  if (user.orgRole === "super_admin" || user.orgRole === "org_admin") return true;
  const conditions: any[] = [
    eq(userGameAssignments.userId, userId),
    eq(userGameAssignments.gameId, channel.gameId),
    eq(userGameAssignments.status, "approved"),
    eq(userGameAssignments.teamId, teamId),
  ];
  if (channel.rosterId) conditions.push(or(isNull(userGameAssignments.rosterId), eq(userGameAssignments.rosterId, channel.rosterId)));
  const [assignment] = await db.select().from(userGameAssignments).where(and(...conditions)).limit(1);
  if (!assignment) { res.status(403).json({ message: "You do not have access to this channel" }); return false; }
  return true;
}

async function verifyObjectScope(req: any, res: any, objectGameId: string | null | undefined, objectRosterId: string | null | undefined): Promise<boolean> {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ message: "Unauthorized" }); return false; }
  const teamId = getTeamId();
  const [user] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
  if (!user) { res.status(403).json({ message: "Forbidden" }); return false; }
  if (user.orgRole === "super_admin" || user.orgRole === "org_admin") return true;
  if (!objectGameId) { res.status(403).json({ message: "Forbidden" }); return false; }
  const baseConditions: any[] = [
    eq(userGameAssignments.userId, userId),
    eq(userGameAssignments.gameId, objectGameId),
    eq(userGameAssignments.status, "approved"),
    eq(userGameAssignments.teamId, teamId),
  ];
  if (objectRosterId) {
    baseConditions.push(or(isNull(userGameAssignments.rosterId), eq(userGameAssignments.rosterId, objectRosterId)));
  }
  const [assignment] = await db.select().from(userGameAssignments).where(and(...baseConditions)).limit(1);
  if (!assignment) { res.status(403).json({ message: "You do not have access to this record" }); return false; }
  return true;
}

/**
 * Stricter scope check for game-wide config writes: when the target record has rosterId = null
 * (game-wide), non-admin users must hold a game-wide assignment (rosterId IS NULL).
 * Roster-scoped writes still require the standard verifyObjectScope check.
 * Returns true on pass; on fail, has already responded with the appropriate status.
 */
async function verifyConfigWriteScope(req: any, res: any, objectGameId: string | null | undefined, objectRosterId: string | null | undefined): Promise<boolean> {
  if (!await verifyObjectScope(req, res, objectGameId, objectRosterId)) return false;
  const userId = req.session?.userId;
  if (!userId) return false;
  const teamId = getTeamId();
  const [user] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
  if (!user) { res.status(403).json({ message: "Forbidden" }); return false; }
  if (user.orgRole === "super_admin" || user.orgRole === "org_admin") return true;
  if (objectRosterId) return true; // verifyObjectScope already enforced roster gating
  if (!objectGameId) { res.status(403).json({ message: "Forbidden" }); return false; }
  const [gameWide] = await db.select().from(userGameAssignments).where(and(
    eq(userGameAssignments.userId, userId),
    eq(userGameAssignments.gameId, objectGameId),
    eq(userGameAssignments.status, "approved"),
    eq(userGameAssignments.teamId, teamId),
    isNull(userGameAssignments.rosterId),
  )).limit(1);
  if (!gameWide) {
    res.status(403).json({ message: "Game-wide config writes require a game-wide assignment" });
    return false;
  }
  return true;
}

/**
 * Strip scope-changing fields (rosterId, gameId) from an update payload for non-admin callers.
 * Admins (super_admin / org_admin) are allowed to reassign records between scopes.
 * Non-admins must not be able to move a record they own in roster A into roster B.
 */
async function sanitizeScopeFields<T extends Record<string, any>>(req: any, data: T): Promise<T> {
  const userId = req.session?.userId;
  if (!userId) return data;
  const teamId = getTeamId();
  const [user] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
  if (!user || user.orgRole === "super_admin" || user.orgRole === "org_admin") return data;
  const sanitized = { ...data };
  delete sanitized.rosterId;
  delete sanitized.gameId;
  return sanitized;
}

const ORG_ROLE_RANK: Record<string, number> = {
  super_admin: 6,
  org_admin: 5,
  game_manager: 4,
  coach_analyst: 2,
  player: 1,
};

const SYSTEM_ROLE_RANK: Record<string, number> = {
  Management: 4,
  Owner: 4,
  Admin: 3,
  Staff: 2,
  Member: 1,
};

function getUserRank(user: any, allRoles: any[]): number {
  const orgRank = ORG_ROLE_RANK[user.orgRole] || 0;
  const role = allRoles.find((r: any) => r.id === user.roleId);
  const sysRank = role ? (SYSTEM_ROLE_RANK[role.name] || 0) : 0;
  return Math.max(orgRank, sysRank);
}

async function checkRankGuard(actorId: string, targetId: string, teamId: string): Promise<string | null> {
  if (actorId === targetId) return "Cannot perform this action on yourself";
  const allRoles_r = await db.select().from(roles).where(eq(roles.teamId, teamId));
  const [actor] = await db.select().from(users).where(and(eq(users.id, actorId), eq(users.teamId, teamId)));
  const [target] = await db.select().from(users).where(and(eq(users.id, targetId), eq(users.teamId, teamId)));
  if (!actor || !target) return "User not found";
  const actorRank = getUserRank(actor, allRoles_r);
  const targetRank = getUserRank(target, allRoles_r);
  if (targetRank >= actorRank) return "Cannot perform this action on a user with equal or higher rank";
  return null;
}

async function logActivity(userId: string | null, action: string, details?: string, logType: string = "team", deviceInfo?: string, gameId?: string | null, rosterId?: string | null) {
  try {
    const teamId = getTeamId();
    await db.insert(activityLogs).values({ teamId, userId, action, details, logType, deviceInfo, gameId: gameId || null, rosterId: rosterId || null });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

function generateRosterCode(): string {
  return String(Math.floor(1000000000 + Math.random() * 9000000000));
}

export async function ensureRostersExist() {
  const teamId = getTeamId();
  const allGamesList = await db.select().from(supportedGames);
  const existingRosters = await db.select().from(rosters).where(eq(rosters.teamId, teamId));

  if (existingRosters.length > 0) {
    let codesMigrated = 0;
    let namesUpdated = 0;
    for (const r of existingRosters) {
      if (!r.code) {
        await db.update(rosters).set({ code: generateRosterCode() }).where(eq(rosters.id, r.id));
        codesMigrated++;
      }
    }

    const nameMap: Record<string, string> = {
      "First Team": "Team 1", "Academy": "Team 2", "Women": "Team 3",
    };
    const slugMap: Record<string, string> = {
      "first-team": "team-1", "academy": "team-2", "women": "team-3",
    };
    for (const r of existingRosters) {
      const newName = nameMap[r.name];
      const newSlug = slugMap[r.slug];
      if (newName && newSlug) {
        await db.update(rosters).set({ name: newName, slug: newSlug }).where(eq(rosters.id, r.id));
        namesUpdated++;
      }
    }

    if (codesMigrated > 0) console.log(`[startup] Assigned codes to ${codesMigrated} rosters`);
    if (namesUpdated > 0) console.log(`[startup] Renamed ${namesUpdated} rosters to Team 1/2/3`);

    for (const game of allGamesList) {
      const gameRosters = existingRosters.filter(r => r.gameId === game.id);
      if (gameRosters.length < 4) {
        const existingSorts = gameRosters.map(r => r.sortOrder ?? 0);
        const maxSort = Math.max(...existingSorts, -1);
        for (let i = gameRosters.length + 1; i <= 4; i++) {
          await db.insert(rosters).values({
            teamId, gameId: game.id,
            name: `Team ${i}`, slug: `team-${i}`,
            sortOrder: maxSort + (i - gameRosters.length),
            code: generateRosterCode(),
          });
        }
        const newRosters = await db.select().from(rosters)
          .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, game.id)));
        for (const r of newRosters) {
          await seedRosterDefaults(teamId, game.id, r.id);
        }
      }
    }
    return;
  }

  console.log("[startup] Creating default rosters for all games...");
  for (const game of allGamesList) {
    const defaults = [
      { name: "Team 1", slug: "team-1", sortOrder: 0 },
      { name: "Team 2", slug: "team-2", sortOrder: 1 },
      { name: "Team 3", slug: "team-3", sortOrder: 2 },
      { name: "Team 4", slug: "team-4", sortOrder: 3 },
    ];
    for (const d of defaults) {
      await db.insert(rosters).values({
        teamId, gameId: game.id, name: d.name, slug: d.slug,
        sortOrder: d.sortOrder, code: generateRosterCode(),
      });
    }
    const gameRosters = await db.select().from(rosters)
      .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, game.id)));
    for (const r of gameRosters) {
      await seedRosterDefaults(teamId, game.id, r.id);
    }
  }
  const finalCount = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
  console.log(`[startup] Created ${finalCount.length} rosters with defaults`);
}

async function seedRosterDefaults(teamId: string, gameId: string, rosterId: string) {
  try {
    const existingSlots = await db.select().from(availabilitySlots)
      .where(and(eq(availabilitySlots.teamId, teamId), eq(availabilitySlots.gameId, gameId), eq(availabilitySlots.rosterId, rosterId)))
      .limit(1);
    if (existingSlots.length === 0) {
      const defaultSlots = [
        { label: "Unknown", sortOrder: 0 },
        { label: "18:00-20:00", sortOrder: 1 },
        { label: "20:00-22:00", sortOrder: 2 },
        { label: "All Blocks", sortOrder: 3 },
        { label: "Can't", sortOrder: 4 },
      ];
      for (const s of defaultSlots) {
        await db.insert(availabilitySlots).values({ teamId, gameId, rosterId, label: s.label, sortOrder: s.sortOrder });
      }
    }

    const existingRoles = await db.select().from(rosterRoles)
      .where(and(eq(rosterRoles.teamId, teamId), eq(rosterRoles.gameId, gameId), eq(rosterRoles.rosterId, rosterId)))
      .limit(1);
    if (existingRoles.length === 0) {
      const defaultRoles = [
        { name: "Tank", type: "player", sortOrder: 0 },
        { name: "DPS", type: "player", sortOrder: 1 },
        { name: "Support", type: "player", sortOrder: 2 },
        { name: "Flex", type: "player", sortOrder: 3 },
      ];
      for (const r of defaultRoles) {
        await db.insert(rosterRoles).values({ teamId, gameId, rosterId, name: r.name, type: r.type, sortOrder: r.sortOrder });
      }
    }

    const existingCats = await db.select().from(eventCategories)
      .where(and(eq(eventCategories.teamId, teamId), eq(eventCategories.gameId, gameId), eq(eventCategories.rosterId, rosterId)))
      .limit(1);
    if (existingCats.length === 0) {
      const defaultCategories = [
        { name: "Scrim", color: null, sortOrder: 0, subs: [
          { name: "Practice", color: "#3b82f6", sortOrder: 0 },
          { name: "Warm-up", color: "#06b6d4", sortOrder: 1 },
        ]},
        { name: "Tournament", color: null, sortOrder: 1, subs: [
          { name: "Stage 1", color: "#f59e0b", sortOrder: 0 },
          { name: "Saudi League", color: "#f97316", sortOrder: 1 },
          { name: "Elite 3000$ Cup", color: "#ef4444", sortOrder: 2 },
        ]},
        { name: "Meetings", color: null, sortOrder: 2, subs: [
          { name: "Vod Review", color: "#8b5cf6", sortOrder: 0 },
          { name: "Roster Meeting", color: "#a855f7", sortOrder: 1 },
          { name: "Organization Meeting", color: "#6366f1", sortOrder: 2 },
        ]},
      ];
      for (const cat of defaultCategories) {
        const [inserted] = await db.insert(eventCategories).values({
          teamId, gameId, rosterId, name: cat.name, color: cat.color, sortOrder: cat.sortOrder,
        }).returning();
        for (const sub of cat.subs) {
          await db.insert(eventSubTypes).values({
            teamId, gameId, rosterId, categoryId: inserted.id, name: sub.name, color: sub.color, sortOrder: sub.sortOrder,
          });
        }
      }
    }

    const existingStaff = await db.select().from(staffTable)
      .where(and(eq(staffTable.teamId, teamId), eq(staffTable.gameId, gameId), eq(staffTable.rosterId, rosterId)))
      .limit(1);
    if (existingStaff.length === 0) {
      const defaultStaff = [
        { name: "Head Coach", role: "Head Coach" },
        { name: "Assistant Coach", role: "Assistant Coach" },
        { name: "Analyst", role: "Analyst" },
        { name: "Manager", role: "Manager" },
      ];
      for (const s of defaultStaff) {
        await db.insert(staffTable).values({ teamId, gameId, rosterId, name: s.name, role: s.role });
      }
    }

    const existingChannels = await db.select().from(chatChannels)
      .where(and(eq(chatChannels.teamId, teamId), eq(chatChannels.gameId, gameId), eq(chatChannels.rosterId, rosterId)))
      .limit(1);
    if (existingChannels.length === 0) {
      const defaultChannels = ["General", "Strategy", "Announcements"];
      for (const ch of defaultChannels) {
        await db.insert(chatChannels).values({ teamId, gameId, rosterId, name: ch });
      }
    }
  } catch (err) {
    console.error("Failed to seed roster defaults:", err);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  const gameAccessPaths = [
    "/api/players", "/api/events", "/api/attendance", "/api/schedule",
    "/api/staff", "/api/chat", "/api/availability-slots", "/api/roster-roles",
    "/api/player-availability", "/api/staff-availability", "/api/seasons",
    "/api/sides", "/api/heroes", "/api/hero-role-configs", "/api/opponents",
    "/api/game-modes", "/api/maps", "/api/games", "/api/off-days",
    "/api/stat-fields", "/api/player-stats-summary", "/api/team-notes",
    "/api/activity-logs",
  ];
  for (const path of gameAccessPaths) {
    app.use(path, requireGameAccess);
  }

  // ==================== STATIC FILE SERVING ====================
  // Branding assets (logos, game icons) are public – needed on login/public pages.
  // Local-disk fallback (kept for any pre-existing /uploads/logos/* URLs that
  // still happen to exist on disk after a redeploy). New uploads go to object
  // storage and are served via /public-objects/* below.
  app.use("/uploads/logos", express.static(path.join(UPLOAD_DIR, "logos")));
  app.use("/uploads/game-icons", express.static(path.join(UPLOAD_DIR, "game-icons")));

  // Inline-safe media types that may be rendered directly in the browser
  const INLINE_MEDIA_EXTS = new Set([
    ".jpg",".jpeg",".png",".gif",".webp",".bmp",".ico",
    ".mp4",".mov",".webm",".avi",
    ".mp3",".m4a",".ogg",".wav",".aac",".opus",
  ]);

  // Serve chat attachments with full channel + game + roster + role authorization.
  // Mirror the same permission chain used by GET /api/chat/channels/:channelId/messages.
  app.get("/uploads/chat/:filename", requireAuth, requirePermission("view_chat"), async (req: any, res: any) => {
    try {
      const rawName = req.params.filename as string;
      if (!/^[a-f0-9-]+\.[a-zA-Z0-9]+$/.test(rawName)) {
        return res.status(400).json({ message: "Invalid filename" });
      }

      const teamId = getTeamId();
      const userId = req.session.userId as string;
      const attachmentUrl = `/uploads/chat/${rawName}`;

      // Find the chat message that owns this file
      const [msg] = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.attachmentUrl, attachmentUrl), eq(chatMessages.teamId, teamId)))
        .limit(1);
      if (!msg) return res.status(404).json({ message: "Not found" });

      // Load the channel the message belongs to
      const [channel] = await db.select().from(chatChannels)
        .where(and(eq(chatChannels.id, msg.channelId!), eq(chatChannels.teamId, teamId)))
        .limit(1);
      if (!channel) return res.status(404).json({ message: "Not found" });

      // Resolve current user once (reused for all downstream checks)
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const isOrgLevel = currentUser?.orgRole === "org_admin" || currentUser?.orgRole === "super_admin" || currentUser?.orgRole === "game_manager";

      // For game/roster-scoped channels, verify the user has an approved assignment
      // that matches BOTH gameId AND rosterId (when present), mirroring requireGameAccess.
      if (channel.gameId && !isOrgLevel) {
        const assignmentConditions: any[] = [
          eq(userGameAssignments.userId, userId),
          eq(userGameAssignments.gameId, channel.gameId),
          eq(userGameAssignments.teamId, teamId),
          eq(userGameAssignments.approvalGameStatus, "approved"),
          eq(userGameAssignments.approvalOrgStatus, "approved"),
        ];
        if (channel.rosterId) {
          assignmentConditions.push(eq(userGameAssignments.rosterId, channel.rosterId));
        }
        const [assignment] = await db.select().from(userGameAssignments)
          .where(and(...assignmentConditions))
          .limit(1);
        if (!assignment) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Check channel-level view permissions (role-based)
      if (currentUser?.roleId) {
        const channelPerms = await db.select().from(chatChannelPermissions)
          .where(and(
            eq(chatChannelPermissions.channelId, channel.id),
            eq(chatChannelPermissions.roleId, currentUser.roleId),
            eq(chatChannelPermissions.teamId, teamId),
          ))
          .limit(1);
        if (channelPerms.length > 0 && !channelPerms[0].canView) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const filePath = path.join(UPLOAD_DIR, "chat", rawName);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Not found" });

      res.setHeader("X-Content-Type-Options", "nosniff");
      const ext = path.extname(rawName).toLowerCase();
      if (!INLINE_MEDIA_EXTS.has(ext)) {
        res.setHeader("Content-Disposition", `attachment; filename="${rawName}"`);
      }
      return res.sendFile(filePath);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Serve general uploads (event scoreboards, org assets) to authenticated team members.
  // requireAuth guarantees the user's teamId matches this deployment's teamId.
  app.get("/uploads/general/:filename", requireAuth, async (req: any, res: any) => {
    try {
      const rawName = req.params.filename as string;
      if (!/^[a-f0-9-]+\.[a-zA-Z0-9]+$/.test(rawName)) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      const filePath = path.join(UPLOAD_DIR, "general", rawName);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Not found" });

      res.setHeader("X-Content-Type-Options", "nosniff");
      const ext = path.extname(rawName).toLowerCase();
      if (!INLINE_MEDIA_EXTS.has(ext)) {
        res.setHeader("Content-Disposition", `attachment; filename="${rawName}"`);
      }
      return res.sendFile(filePath);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== FILE UPLOAD (Local Filesystem) ====================
  app.post("/api/upload", requireAuth, requirePermission("send_messages"), uploadChat.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const filePath = `/uploads/chat/${req.file.filename}`;
      res.json({
        url: filePath,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Logos go to object storage (persistent across redeploys/restarts).
  // We use multer.memoryStorage so the file never lands on the ephemeral
  // local disk; we forward the buffer straight to the bucket.
  const logoMemoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const ok = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".ico"]);
      if (!ok.has(ext)) return cb(new Error(`File type ${ext} is not allowed`));
      cb(null, true);
    },
  });

  app.post("/api/upload/logo", requireAuth, requireOrgRole("org_admin"), logoMemoryUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      // Persist the logo as a data URL. This stores it directly in the
      // org_settings DB row (which IS persistent), so it survives redeploys,
      // container restarts, and the upload-folder quarantine sweep — none of
      // which touch the database. Logos are small (10 MB hard cap above) and
      // base64 inflates by ~33%, so this is well within Postgres text limits.
      const mime = req.file.mimetype || "application/octet-stream";
      const allowedMimes = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/bmp", "image/x-icon", "image/vnd.microsoft.icon"]);
      if (!allowedMimes.has(mime)) {
        return res.status(400).json({ message: `Image type ${mime} is not allowed` });
      }
      const dataUrl = `data:${mime};base64,${req.file.buffer.toString("base64")}`;
      res.json({ url: dataUrl, path: dataUrl });
    } catch (error: any) {
      console.error("Logo upload error:", error);
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
      const { username, password, selectedGames, selectedRole, selectedRosterType: rosterTypeOrId } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      const teamId = getTeamId();

      let orgRole: string;
      if (selectedRole === "management" || selectedRole === "org_admin") {
        orgRole = "management";
      } else if (selectedRole === "staff" || selectedRole === "coach_analyst") {
        orgRole = "staff";
      } else if (selectedRole === "game_manager") {
        orgRole = "game_manager";
      } else {
        orgRole = "member";
      }

      const baseUsername = username.trim();
      let displayName = baseUsername;
      let selectedGameId: string | null = null;
      let selectedRosterId: string | null = null;

      const needsGame = selectedRole !== "management" && selectedRole !== "org_admin";
      if (needsGame && (!selectedGames || !Array.isArray(selectedGames) || selectedGames.length === 0)) {
        return res.status(400).json({ message: "Game selection required for players and staff" });
      }

      if (needsGame && selectedGames && Array.isArray(selectedGames) && selectedGames.length > 0) {
        selectedGameId = selectedGames[0];
        const [game] = await db.select().from(supportedGames).where(eq(supportedGames.id, selectedGameId!)).limit(1);
        if (game) {
          const abbrev = GAME_ABBREVIATIONS[game.slug] || game.slug.toUpperCase();

          if (rosterTypeOrId && !["first_team", "academy", "women"].includes(rosterTypeOrId)) {
            const [roster] = await db.select().from(rosters)
              .where(and(eq(rosters.id, rosterTypeOrId), eq(rosters.teamId, teamId)))
              .limit(1);
            if (roster) {
              selectedRosterId = roster.id;
              let suffix = abbrev;
              if (roster.slug === "academy") suffix = `${abbrev}_AC`;
              else if (roster.slug === "women") suffix = `${abbrev}_W`;
              displayName = `${baseUsername}_${suffix}`;
            } else {
              displayName = `${baseUsername}_${abbrev}`;
            }
          } else {
            const rosterType = rosterTypeOrId || "first_team";
            let suffix = abbrev;
            if (rosterType === "academy") suffix = `${abbrev}_AC`;
            else if (rosterType === "women") suffix = `${abbrev}_W`;
            displayName = `${baseUsername}_${suffix}`;

            const rosterNameMap: Record<string, string> = { first_team: "First Team", academy: "Academy", women: "Women" };
            const rosterName = rosterNameMap[rosterType] || "First Team";
            const [roster] = await db.select().from(rosters)
              .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, game.id), eq(rosters.name, rosterName)))
              .limit(1);
            if (roster) {
              selectedRosterId = roster.id;
            }
          }
        }
      }

      if (needsGame && selectedGameId && !selectedRosterId) {
        return res.status(400).json({ message: "Roster selection required" });
      }

      const [existing] = await db.select().from(users)
        .where(and(ilike(users.username, baseUsername), eq(users.teamId, teamId)))
        .limit(1);
      if (existing) {
        return res.status(409).json({ message: "Username already taken" });
      }

      let targetRoleName = "Member";
      if (orgRole === "staff") targetRoleName = "Staff";
      else if (orgRole === "management") targetRoleName = "Management";

      const [targetPlatformRole] = await db.select().from(roles)
        .where(and(eq(roles.name, targetRoleName), eq(roles.teamId, teamId)))
        .limit(1);
      const memberRole = targetPlatformRole;

      let isAdminCreating = false;
      if (req.session && req.session.userId) {
        const [caller] = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
        if (caller && (caller.orgRole === "org_admin" || caller.orgRole === "super_admin")) {
          isAdminCreating = true;
        }
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const [newUser] = await db.insert(users).values({
        teamId,
        username: baseUsername,
        displayName,
        passwordHash,
        roleId: memberRole?.id || null,
        orgRole,
        status: isAdminCreating ? "active" : "pending",
      }).returning();

      if (selectedGameId) {
        const assignment = await storage.createUserGameAssignment(teamId, newUser.id, selectedGameId, orgRole, selectedRosterId || undefined);
        if (isAdminCreating) {
          await db.update(userGameAssignments)
            .set({ status: "approved", approvalGameStatus: "approved", approvalOrgStatus: "approved" })
            .where(eq(userGameAssignments.id, assignment.id));
        }
      }

      const { passwordHash: _, ...safeUser } = newUser;
      if (isAdminCreating) {
        logActivity(req.session.userId!, "create_user", `Admin created user ${displayName} as ${selectedRole || "player"}`, "system");
      } else {
        logActivity(null, "register", `User ${displayName} registered as ${selectedRole || "player"} (pending approval)`, "system");
      }
      res.json({ ...safeUser, message: isAdminCreating ? "User created successfully." : "Registration successful. Awaiting approval." });
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
      const gameAssignments = await storage.getUserGameAssignments(user.id);
      res.json({ ...safeUser, role, gameAssignments } as UserWithRole);
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
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      let allUsers = await db.select().from(users).where(eq(users.teamId, teamId));

      if (gameId) {
        const conditions = [
          eq(userGameAssignments.teamId, teamId),
          eq(userGameAssignments.gameId, gameId),
          eq(userGameAssignments.status, "approved"),
        ];
        if (rosterId) conditions.push(eq(userGameAssignments.rosterId, rosterId));
        const gameAssigns = await db.select().from(userGameAssignments)
          .where(and(...conditions));
        const gameUserIds = new Set(gameAssigns.map(a => a.userId));
        allUsers = allUsers.filter(u => gameUserIds.has(u.id) && u.orgRole !== "org_admin" && u.orgRole !== "super_admin");
      }

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

      if (roleId) {
        const allRolesArr = await db.select().from(roles).where(eq(roles.teamId, teamId));
        const [actor] = await db.select().from(users).where(eq(users.id, req.session.userId!));
        const actorRank = getUserRank(actor, allRolesArr);
        const newRole = allRolesArr.find(r => r.id === roleId);
        const newRank = newRole ? (SYSTEM_ROLE_RANK[newRole.name] || 0) : 0;
        if (newRank >= actorRank) {
          return res.status(403).json({ message: "Cannot create a user with a role equal to or higher than your own" });
        }
      }
      
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
      if (id !== req.session.userId) {
        const rankError = await checkRankGuard(req.session.userId!, id, teamId);
        if (rankError) return res.status(403).json({ message: rankError });
      }
      const [updated] = await db.update(users)
        .set({ status })
        .where(and(eq(users.id, id), eq(users.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });

      if (status === "banned") {
        await db.update(userGameAssignments)
          .set({ status: "banned" })
          .where(and(eq(userGameAssignments.userId, id), eq(userGameAssignments.teamId, teamId)));
        await db.execute(sql`DELETE FROM "session" WHERE sess::jsonb->>'userId' = ${id}`);
      } else if (status === "active") {
        await db.update(userGameAssignments)
          .set({ status: "approved" })
          .where(and(eq(userGameAssignments.userId, id), eq(userGameAssignments.teamId, teamId), eq(userGameAssignments.status, "banned")));
      }

      logActivity(req.session.userId!, "user_status_change", `Changed ${updated.username} status to ${status}`, "team", undefined, getGameId(req), getRosterId(req));
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

      const rankError = await checkRankGuard(req.session.userId!, id, teamId);
      if (rankError) return res.status(403).json({ message: rankError });

      const allRolesArr = await db.select().from(roles).where(eq(roles.teamId, teamId));
      const [actor] = await db.select().from(users).where(eq(users.id, req.session.userId!));
      const actorRank = getUserRank(actor, allRolesArr);

      const newRole = allRolesArr.find(r => r.id === roleId);
      const newRank = newRole ? (SYSTEM_ROLE_RANK[newRole.name] || 0) : 0;
      if (newRank >= actorRank) {
        return res.status(403).json({ message: "Cannot assign a role equal to or higher than your own" });
      }

      const [updated] = await db.update(users)
        .set({ roleId })
        .where(and(eq(users.id, id), eq(users.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });
      logActivity(req.session.userId!, "user_role_change", `Changed ${updated.username} role`, "team", undefined, getGameId(req), getRosterId(req));
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
      if (playerId) {
        const player = await db.select().from(players).where(and(eq(players.id, playerId), eq(players.teamId, teamId))).limit(1);
        if (player.length === 0) {
          return res.status(400).json({ message: "Player not found in this organization" });
        }
      }
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
      const rankError = await checkRankGuard(req.session.userId!, id, teamId);
      if (rankError) return res.status(403).json({ message: rankError });
      await db.delete(userGameAssignments).where(and(eq(userGameAssignments.userId, id), eq(userGameAssignments.teamId, teamId)));
      await db.execute(sql`DELETE FROM "session" WHERE sess::jsonb->>'userId' = ${id}`);
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

  app.put("/api/users/:id/reset-password", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const rankError = await checkRankGuard(req.session.userId!, id, teamId);
      if (rankError) return res.status(403).json({ message: rankError });
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let tempPassword = "";
      for (let i = 0; i < 8; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const passwordHash = bcrypt.hashSync(tempPassword, 10);
      const [updated] = await db.update(users)
        .set({ passwordHash })
        .where(and(eq(users.id, id), eq(users.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });
      logActivity(req.session.userId!, "reset_password", `Reset password for ${updated.username}`, "system");
      res.json({ tempPassword });
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
      if (id !== req.session.userId) {
        const rankError = await checkRankGuard(req.session.userId!, id, teamId);
        if (rankError) return res.status(403).json({ message: rankError });
      }
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
      const teamId = getTeamId();
      const rankError = await checkRankGuard(req.session.userId!, userId, teamId);
      if (rankError) return res.status(403).json({ message: rankError });
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

  // ==================== PROD BOOTSTRAP (admin streaming) ====================
  app.post("/api/admin/prod-bootstrap/run", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    const { runProdBootstrapNow, setBootstrapLogger } = await import("./prod-bootstrap");
    res.status(200);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const writer = (line: string) => {
      try { res.write(`[${new Date().toISOString()}] ${line}\n`); } catch {}
    };
    writer(`prod-bootstrap admin run requested by user=${req.session.userId}`);
    let keepalive: NodeJS.Timeout | null = setInterval(() => {
      try { res.write(`[${new Date().toISOString()}] ...keepalive\n`); } catch {}
    }, 25000);
    setBootstrapLogger(writer);
    try {
      const result = await runProdBootstrapNow();
      writer(`RESULT: ${JSON.stringify(result)}`);
    } catch (err: any) {
      writer(`ERROR: ${err?.message || err}`);
    } finally {
      setBootstrapLogger(null);
      if (keepalive) { clearInterval(keepalive); keepalive = null; }
      res.end();
    }
  });

  app.post("/api/admin/prod-bootstrap/force-release-lock", requireAuth, requireOrgRole("org_admin"), async (_req, res) => {
    try {
      const ADVISORY_LOCK_KEY = "7345291004981234";
      const holders: any = await db.execute(sql.raw(`
        SELECT a.pid AS pid, a.state AS state, a.query_start AS query_start,
               now() - a.query_start AS held_for, left(a.query, 200) AS query
        FROM pg_stat_activity a
        JOIN pg_locks l ON l.pid = a.pid
        WHERE l.locktype = 'advisory'
          AND ((l.classid::bigint << 32) | l.objid::bigint) = ${ADVISORY_LOCK_KEY}
      `));
      const terminated: any[] = [];
      for (const row of (holders.rows as any[]) ?? []) {
        const pid = row.pid;
        const r: any = await db.execute(sql.raw(`SELECT pg_terminate_backend(${pid}) AS killed`));
        terminated.push({ pid, killed: r.rows?.[0]?.killed, heldFor: row.held_for, query: row.query });
      }
      res.json({ ok: true, holders: holders.rows, terminated });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/prod-bootstrap/status", requireAuth, requireOrgRole("org_admin"), async (_req, res) => {
    try {
      const r: any = await db.execute(sql`
        SELECT key, value FROM settings
        WHERE team_id = '9ae96acf-6ae9-40b4-945b-86651991bfc3'
          AND key = 'prod_bootstrap_v2_done'
        LIMIT 1
      `);
      res.json({
        sentinel: (r.rows?.length ?? 0) > 0,
        value: r.rows?.[0]?.value || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== ROSTER RESET / EXAMPLE DATA ====================
  app.post("/api/admin/fix-broken-events", requireAuth, requireOrgRole("super_admin", "org_admin"), async (_req, res) => {
    try {
      const { fixBrokenEventsAprilMay } = await import("./roster-reset");
      const result = await fixBrokenEventsAprilMay();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/rosters/:id/reset", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const { RESET_PASSWORD, resetRosterData } = await import("./roster-reset");
      const password = (req.body?.password ?? "").toString();
      if (password !== RESET_PASSWORD) {
        return res.status(403).json({ message: "Invalid admin password" });
      }
      const result = await resetRosterData(req.params.id);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/rosters/:id/load-example", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const { LOAD_EXAMPLE_PASSWORD, loadExampleData, startJob } = await import("./roster-reset");
      const password = (req.body?.password ?? "").toString();
      if (password !== LOAD_EXAMPLE_PASSWORD) {
        return res.status(403).json({ message: "Invalid admin password" });
      }
      const rosterId = req.params.id;
      // Start the heavy work in the background and return a job ID immediately.
      // The frontend polls /api/admin/jobs/:jobId for completion.
      const job = startJob(`load-example:${rosterId}`, () => loadExampleData(rosterId));
      res.json({ ok: true, jobId: job.id, status: job.status });
    } catch (err: any) {
      console.error("[load-example] failed to start job:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/jobs/:jobId", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const { getJob } = await import("./roster-reset");
      const job = getJob(req.params.jobId);
      if (!job) return res.status(404).json({ message: "Job not found or expired" });
      res.json({
        id: job.id,
        type: job.type,
        status: job.status,
        message: job.message,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        result: job.result,
        error: job.error,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== ROLES MANAGEMENT ====================
  app.get("/api/roles", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      const conditions: any[] = [eq(roles.teamId, teamId)];
      if (gameId) {
        conditions.push(eq(roles.gameId, gameId));
        if (rosterId) conditions.push(eq(roles.rosterId, rosterId));
      } else {
        conditions.push(isNull(roles.gameId));
      }
      let allRoles = await db.select().from(roles).where(and(...conditions));

      const ROSTER_HOME_PERMS_TO_STRIP = [
        "view_calendar",
        "view_upcoming_events",
        "view_users_tab",
        "view_roles_tab",
        "view_game_access",
        "view_settings",
        "manage_settings",
      ];

      if (gameId && rosterId && allRoles.length === 0) {
        const ownerPerms = [...allPermissions] as string[];
        const staffPerms = allPermissions.filter(p => p !== "manage_roles") as string[];
        const rosterAdminStaffPerms = staffPerms.filter(p => !ROSTER_HOME_PERMS_TO_STRIP.includes(p));
        const memberPerms = [
          "view_schedule", "edit_own_availability", "view_events", "view_results",
          "view_players", "view_statistics", "view_player_stats", "view_history",
          "view_compare", "view_opponents", "view_chat", "send_messages", "delete_own_messages",
        ] as string[];

        const defaults = [
          { name: "Management", permissions: ownerPerms, isSystem: true },
          { name: "Admin", permissions: rosterAdminStaffPerms, isSystem: true },
          { name: "Staff", permissions: rosterAdminStaffPerms, isSystem: true },
          { name: "Member", permissions: memberPerms, isSystem: true },
        ];

        for (const d of defaults) {
          await db.insert(roles).values({ teamId, gameId, rosterId, name: d.name, permissions: d.permissions, isSystem: d.isSystem });
        }
        allRoles = await db.select().from(roles).where(and(...conditions));
      } else if (gameId && rosterId && allRoles.length > 0) {
        for (const r of allRoles) {
          if (r.isSystem && (r.name === "Admin" || r.name === "Staff")) {
            const current = (r.permissions as string[]) || [];
            const cleaned = current.filter(p => !ROSTER_HOME_PERMS_TO_STRIP.includes(p));
            if (cleaned.length !== current.length) {
              await db.update(roles).set({ permissions: cleaned }).where(eq(roles.id, r.id));
            }
          }
        }
        allRoles = await db.select().from(roles).where(and(...conditions));
      } else if (gameId && !rosterId && allRoles.length === 0) {
        const ownerPerms = [...allPermissions] as string[];
        const staffPerms = allPermissions.filter(p => p !== "manage_roles") as string[];
        const memberPerms = [
          "view_schedule", "edit_own_availability", "view_events", "view_results",
          "view_players", "view_statistics", "view_player_stats", "view_history",
          "view_compare", "view_opponents", "view_chat", "send_messages", "delete_own_messages",
        ] as string[];
        const defaults = [
          { name: "Management", permissions: ownerPerms, isSystem: true },
          { name: "Admin", permissions: staffPerms, isSystem: true },
          { name: "Staff", permissions: staffPerms, isSystem: true },
          { name: "Member", permissions: memberPerms, isSystem: true },
        ];
        for (const d of defaults) {
          await db.insert(roles).values({ teamId, gameId, name: d.name, permissions: d.permissions, isSystem: d.isSystem });
        }
        allRoles = await db.select().from(roles).where(and(...conditions));
      } else if (!gameId && !rosterId && allRoles.length === 0) {
        const homeAllPerms = [
          "view_dashboard", "view_calendar", "view_upcoming_events",
          "view_users_tab", "manage_users", "view_roles_tab", "manage_roles",
          "view_game_access", "manage_game_config",
          "view_chat", "send_messages", "delete_own_messages", "delete_any_message", "manage_channels",
          "view_settings", "manage_settings", "view_activity_log",
        ] as string[];
        const homeStaffPerms = [
          "view_dashboard", "view_calendar", "view_upcoming_events",
          "view_users_tab", "view_roles_tab", "view_game_access",
          "view_chat", "send_messages", "delete_own_messages",
          "view_settings", "view_activity_log",
        ] as string[];
        const homeMemberPerms = [
          "view_calendar", "view_upcoming_events",
          "view_chat", "send_messages", "delete_own_messages",
        ] as string[];
        const homeDefaults = [
          { name: "Management", permissions: homeAllPerms, isSystem: true },
          { name: "Admin", permissions: homeStaffPerms, isSystem: true },
          { name: "Staff", permissions: homeStaffPerms, isSystem: true },
          { name: "Member", permissions: homeMemberPerms, isSystem: true },
        ];
        for (const d of homeDefaults) {
          await db.insert(roles).values({ teamId, name: d.name, permissions: d.permissions, isSystem: d.isSystem });
        }
        allRoles = await db.select().from(roles).where(and(...conditions));
      }

      res.json(allRoles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/roles", requireAuth, requirePermission("manage_roles"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      const { name, permissions } = req.body;
      const [role] = await db.insert(roles).values({
        teamId, gameId, rosterId, name, permissions: permissions || [], isSystem: false,
      }).returning();
      logActivity(req.session.userId!, "create_role", `Created role "${name}"`, "team", undefined, role.gameId, role.rosterId);
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
      if (existing.name === "Management" || existing.name === "Owner") return res.status(403).json({ message: "Cannot modify Management role" });
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (permissions !== undefined) updateData.permissions = permissions;
      const [updated] = await db.update(roles).set(updateData)
        .where(and(eq(roles.id, id), eq(roles.teamId, teamId)))
        .returning();
      logActivity(req.session.userId!, "edit_role", `Updated role "${updated.name}"`, "team", undefined, existing.gameId, existing.rosterId);
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
      logActivity(req.session.userId!, "delete_role", `Deleted role "${existing.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== STAFF MANAGEMENT ====================
  app.get("/api/staff", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const conditions: any[] = [eq(staffTable.teamId, teamId)];
      if (gid) conditions.push(eq(staffTable.gameId, gid));
      if (rid) conditions.push(eq(staffTable.rosterId, rid));
      const allStaff = await db.select().from(staffTable).where(and(...conditions));
      res.json(allStaff);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/staff", requireAuth, requirePermission("manage_staff"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const validatedData = insertStaffSchema.parse(req.body);
      const [newStaff] = await db.insert(staffTable).values({ ...validatedData, teamId, gameId: gid, rosterId: rid }).returning();
      logActivity(req.session.userId!, "add_staff", `Added staff member "${newStaff.name}"`, "team", undefined, newStaff.gameId, newStaff.rosterId);
      res.json(newStaff);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/staff/:id", requireAuth, requirePermission("manage_staff"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(staffTable).where(and(eq(staffTable.id, id), eq(staffTable.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Staff not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertStaffSchema.partial().parse(req.body));
      const [updated] = await db.update(staffTable).set(validatedData).where(and(eq(staffTable.id, id), eq(staffTable.teamId, teamId))).returning();
      if (!updated) return res.status(404).json({ message: "Staff not found" });
      logActivity(req.session.userId!, "edit_staff", `Updated staff member "${updated.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/staff/:id", requireAuth, requirePermission("manage_staff"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(staffTable).where(and(eq(staffTable.id, id), eq(staffTable.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Staff not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const [deleted] = await db.delete(staffTable).where(and(eq(staffTable.id, id), eq(staffTable.teamId, teamId))).returning();
      if (!deleted) return res.status(404).json({ message: "Staff not found" });
      logActivity(req.session.userId!, "remove_staff", `Removed staff member "${deleted.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CHAT CHANNELS & MESSAGES ====================
  app.get("/api/chat/channels", requireAuth, requirePermission("view_chat"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
      const isAdmin = currentUser && (currentUser.orgRole === "super_admin" || currentUser.orgRole === "org_admin");

      let channels;
      if (isAdmin) {
        channels = await db.select().from(chatChannels).where(eq(chatChannels.teamId, teamId));
      } else {
        const assignments = await db.select().from(userGameAssignments)
          .where(and(eq(userGameAssignments.userId, userId), eq(userGameAssignments.status, "approved"), eq(userGameAssignments.teamId, teamId)));
        if (assignments.length === 0) return res.json([]);
        const scopeConditions = assignments.map(a => {
          const conds: any[] = [eq(chatChannels.gameId, a.gameId)];
          if (a.rosterId) conds.push(or(isNull(chatChannels.rosterId), eq(chatChannels.rosterId, a.rosterId)));
          return and(...conds);
        });
        channels = await db.select().from(chatChannels).where(and(eq(chatChannels.teamId, teamId), or(...scopeConditions)));
      }

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
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const [channel] = await db.insert(chatChannels).values({ teamId, name, gameId: gid, rosterId: rid }).returning();
      logActivity(req.session.userId!, "create_channel", `Created chat channel "${channel.name}"`, "team", undefined, channel.gameId, channel.rosterId);
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
      const [existing] = await db.select().from(chatChannels).where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Channel not found" });
      if (!await verifyChatChannelScope(id, req, res)) return;
      const [updated] = await db.update(chatChannels)
        .set({ name: name.trim() })
        .where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Channel not found" });
      logActivity(req.session.userId!, "edit_channel", `Updated chat channel`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/chat/channels/:id", requireAuth, requirePermission("manage_channels"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(chatChannels).where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Channel not found" });
      if (!await verifyChatChannelScope(id, req, res)) return;
      await db.delete(chatChannels).where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId)));
      logActivity(req.session.userId!, "delete_channel", `Deleted chat channel`, "team", undefined, existing.gameId, existing.rosterId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/channels/:channelId/messages", requireAuth, requirePermission("view_chat"), async (req, res) => {
    try {
      const { channelId } = req.params;
      const teamId = getTeamId();
      if (!await verifyChatChannelScope(channelId, req, res)) return;
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
      if (!await verifyChatChannelScope(channelId, req, res)) return;
      const userId = req.session.userId!;
      const { message, attachmentUrl: rawAttachmentUrl, attachmentType, attachmentName, attachmentSize, mentions } = req.body;
      const SAFE_UPLOAD_PATTERN = /^\/uploads\/(chat|general)\/[a-f0-9-]+\.[a-zA-Z0-9]+$/;
      // Verify the file both matches the expected pattern AND exists on disk,
      // preventing references to files that were never actually uploaded.
      const attachmentUrl = (rawAttachmentUrl && SAFE_UPLOAD_PATTERN.test(rawAttachmentUrl) &&
        fs.existsSync(path.join(process.cwd(), rawAttachmentUrl))) ? rawAttachmentUrl : null;
      const [msg] = await db.insert(chatMessages).values({
        teamId, channelId, userId, message, attachmentUrl, attachmentType: attachmentUrl ? attachmentType : null,
        attachmentName: attachmentUrl ? (attachmentName || null) : null, attachmentSize: attachmentUrl ? (attachmentSize || null) : null,
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
      if (!await verifyChatChannelScope(msg.channelId, req, res)) return;

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const [userRole] = currentUser?.roleId
        ? await db.select().from(roles).where(eq(roles.id, currentUser.roleId)).limit(1)
        : [null];
      const perms = (userRole?.permissions as string[]) || [];
      const isOwner = userRole?.name === "Management" || userRole?.name === "Owner";
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

      const [msgChannel] = await db.select().from(chatChannels).where(and(eq(chatChannels.id, msg.channelId), eq(chatChannels.teamId, teamId))).limit(1);
      await db.delete(chatMessages).where(and(eq(chatMessages.id, id), eq(chatMessages.teamId, teamId)));
      logActivity(req.session.userId!, "delete_message", `Deleted chat message`, "team", undefined, msgChannel?.gameId || null, msgChannel?.rosterId || null);
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
      if (!await verifyChatChannelScope(channelId, req, res)) return;
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
      if (!await verifyChatChannelScope(channelId, req, res)) return;
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
      const [perm] = await db.select().from(chatChannelPermissions).where(and(eq(chatChannelPermissions.id, id), eq(chatChannelPermissions.teamId, teamId))).limit(1);
      if (!perm) return res.status(404).json({ message: "Permission not found" });
      if (!await verifyChatChannelScope(perm.channelId, req, res)) return;
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
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      const logTypeFilter = req.query.logType as string | undefined;
      const conditions: any[] = [eq(activityLogs.teamId, teamId)];
      if (gameId) {
        conditions.push(eq(activityLogs.gameId, gameId));
      }
      if (rosterId) {
        conditions.push(eq(activityLogs.rosterId, rosterId));
      }
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
      if (role?.name !== "Management" && role?.name !== "Owner") return res.status(403).json({ message: "Only Management can clear logs" });
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
      if (role?.name !== "Management" && role?.name !== "Owner") return res.status(403).json({ message: "Only Management can delete log entries" });
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
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const conditions: any[] = [eq(availabilitySlots.teamId, teamId)];
      if (gid) conditions.push(eq(availabilitySlots.gameId, gid));
      if (rid) conditions.push(eq(availabilitySlots.rosterId, rid));
      const slots = await db.select().from(availabilitySlots).where(and(...conditions));
      res.json(slots);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/availability-slots", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const validatedData = insertAvailabilitySlotSchema.parse(req.body);
      const [slot] = await db.insert(availabilitySlots).values({ ...validatedData, teamId, gameId: gid, rosterId: rid }).returning();
      logActivity(req.session.userId!, "add_availability_slot", `Added availability slot "${slot.label}"`, "team", undefined, slot.gameId, slot.rosterId);
      res.json(slot);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/availability-slots/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(availabilitySlots).where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Slot not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const { label, sortOrder } = req.body;
      const updateData: any = {};
      if (label !== undefined) updateData.label = label;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      const [updated] = await db.update(availabilitySlots).set(updateData).where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.teamId, teamId))).returning();
      if (!updated) return res.status(404).json({ message: "Slot not found" });
      logActivity(req.session.userId!, "edit_availability_slot", `Updated availability slot`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/availability-slots/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(availabilitySlots).where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Slot not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      await db.delete(availabilitySlots).where(and(eq(availabilitySlots.id, id), eq(availabilitySlots.teamId, teamId)));
      logActivity(req.session.userId!, "delete_availability_slot", `Deleted availability slot`, "team", undefined, existing.gameId, existing.rosterId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ROSTER ROLES ====================
  app.get("/api/roster-roles", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const conditions: any[] = [eq(rosterRoles.teamId, teamId)];
      if (gid) conditions.push(eq(rosterRoles.gameId, gid));
      if (rid) conditions.push(eq(rosterRoles.rosterId, rid));
      const rr = await db.select().from(rosterRoles).where(and(...conditions));
      res.json(rr);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/roster-roles", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const validatedData = insertRosterRoleSchema.parse(req.body);
      const [rr] = await db.insert(rosterRoles).values({ ...validatedData, teamId, gameId: gid, rosterId: rid }).returning();
      logActivity(req.session.userId!, "add_roster_role", `Added roster role "${rr.name}"`, "team", undefined, rr.gameId, rr.rosterId);
      res.json(rr);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/roster-roles/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(rosterRoles).where(and(eq(rosterRoles.id, id), eq(rosterRoles.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Roster role not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const { name, type, sortOrder } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (type !== undefined) updateData.type = type;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      const [updated] = await db.update(rosterRoles).set(updateData).where(and(eq(rosterRoles.id, id), eq(rosterRoles.teamId, teamId))).returning();
      if (!updated) return res.status(404).json({ message: "Roster role not found" });
      logActivity(req.session.userId!, "edit_roster_role", `Updated roster role "${updated.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/roster-roles/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(rosterRoles).where(and(eq(rosterRoles.id, id), eq(rosterRoles.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Roster role not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      await db.delete(rosterRoles).where(and(eq(rosterRoles.id, id), eq(rosterRoles.teamId, teamId)));
      logActivity(req.session.userId!, "delete_roster_role", `Deleted roster role`, "team", undefined, existing.gameId, existing.rosterId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== PLAYER AVAILABILITY ====================
  app.get("/api/player-availability", requireAuth, async (req, res) => {
    try {
      const records = await storage.getPlayerAvailabilities(getGameId(req), getRosterId(req));
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
      const perms = (userRole?.name === "Management" || userRole?.name === "Owner") ? [...allPermissions] : ((userRole?.permissions as string[]) || []);

      const hasEditAll = perms.includes("edit_all_availability");
      const hasEditOwn = perms.includes("edit_own_availability");
      const isOwnPlayer = currentUser.playerId === playerId;

      if (!hasEditAll && !(hasEditOwn && isOwnPlayer)) {
        return res.status(403).json({ message: "No permission to edit this player's availability" });
      }

      const record = await storage.savePlayerAvailability(playerId, day, availability, getGameId(req), getRosterId(req));
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
      const gid = getGameId(req);
      const [currentUser] = await db.select().from(users).where(and(eq(users.id, req.session.userId!), eq(users.teamId, teamId))).limit(1);
      if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

      const [userRole] = currentUser.roleId ? await db.select().from(roles).where(and(eq(roles.id, currentUser.roleId), eq(roles.teamId, teamId))).limit(1) : [];
      const perms = (userRole?.name === "Management" || userRole?.name === "Owner") ? [...allPermissions] : ((userRole?.permissions as string[]) || []);
      const hasEditAll = perms.includes("edit_all_availability");
      const hasEditOwn = perms.includes("edit_own_availability");

      const results = [];
      for (const { playerId, day, availability } of updates) {
        const isOwnPlayer = currentUser.playerId === playerId;
        if (!hasEditAll && !(hasEditOwn && isOwnPlayer)) {
          return res.status(403).json({ message: "No permission to edit this player's availability" });
        }
        const record = await storage.savePlayerAvailability(playerId, day, availability, gid, getRosterId(req));
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
      const records = await storage.getStaffAvailabilities(getGameId(req), getRosterId(req));
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
      const teamId = getTeamId();
      const [staffMember] = await db.select().from(staffTable).where(and(eq(staffTable.id, staffId), eq(staffTable.teamId, teamId))).limit(1);
      if (!staffMember) return res.status(403).json({ message: "Staff member not found in your authorized scope" });
      if (!await verifyObjectScope(req, res, staffMember.gameId, staffMember.rosterId)) return;
      const record = await storage.saveStaffAvailability(staffId, day, availability, staffMember.gameId, staffMember.rosterId);
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
      const teamId = getTeamId();
      const results = [];
      for (const { staffId, day, availability } of updates) {
        const [staffMember] = await db.select().from(staffTable).where(and(eq(staffTable.id, staffId), eq(staffTable.teamId, teamId))).limit(1);
        if (!staffMember) continue;
        const allowed = await verifyObjectScope(req, res, staffMember.gameId, staffMember.rosterId);
        if (!allowed) return;
        const record = await storage.saveStaffAvailability(staffId, day, availability, staffMember.gameId, staffMember.rosterId);
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

      const gid = getGameId(req);
      const rid = getRosterId(req);
      const schedule = await storage.getSchedule(
        weekStartDate as string, 
        weekEndDate as string,
        gid, rid
      );

      if (schedule) {
        return res.json(schedule);
      }

      const emptySchedule = await storage.saveSchedule({
        weekStartDate: weekStartDate as string,
        weekEndDate: weekEndDate as string,
        scheduleData: { players: [] } as any,
      }, gid, rid);

      return res.json(emptySchedule);
    } catch (error: any) {
      console.error('Error in GET /api/schedule:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/schedule", requireAuth, requirePermission("edit_all_availability"), async (req, res) => {
    try {
      const validatedData = insertScheduleSchema.parse(req.body);

      const schedule = await storage.saveSchedule(validatedData, getGameId(req), getRosterId(req));

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
      const players = await storage.getAllPlayers(getGameId(req), getRosterId(req));
      res.json(players);
    } catch (error: any) {
      console.error('Error in GET /api/players:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/players", requireAuth, requirePermission("add_players"), async (req, res) => {
    try {
      const validatedData = insertPlayerSchema.parse(req.body);
      const player = await storage.addPlayer(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_player", `Added player "${player.name}"`, "team", undefined, player.gameId, player.rosterId);
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
      const teamId = getTeamId();
      const [player] = await db.select().from(players).where(and(eq(players.id, id), eq(players.teamId, teamId))).limit(1);
      if (!player) return res.status(404).json({ error: "Player not found" });
      if (!await verifyObjectScope(req, res, player.gameId, player.rosterId)) return;
      const success = await storage.removePlayer(id);
      if (success) {
        logActivity(req.session.userId!, "remove_player", `Removed player`, "team", undefined, player.gameId, player.rosterId);
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
      const events = await storage.getAllEvents(getGameId(req), getRosterId(req));
      res.json(events);
    } catch (error: any) {
      console.error('Error in GET /api/events:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const [event] = await db.select().from(events).where(and(eq(events.id, req.params.id), eq(events.teamId, teamId))).limit(1);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (!await verifyObjectScope(req, res, event.gameId, event.rosterId)) return;
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/events", requireAuth, requirePermission("create_events"), async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.addEvent(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "create_event", `Created event "${event.title}"`, "team", undefined, event.gameId, event.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(events).where(and(eq(events.id, id), eq(events.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Event not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertEventSchema.partial().parse(req.body));
      const event = await storage.updateEvent(id, validatedData, existing.gameId, existing.rosterId);
      if (!event) return res.status(404).json({ error: "Event not found" });
      // Cascade opponentId change to child games whose opponentId is null OR matches the prior event opponentId
      if ("opponentId" in validatedData && validatedData.opponentId !== existing.opponentId) {
        const conds: any[] = [eq(games.eventId, id), eq(games.teamId, teamId)];
        if (existing.opponentId) {
          conds.push(or(isNull(games.opponentId), eq(games.opponentId, existing.opponentId)));
        } else {
          conds.push(isNull(games.opponentId));
        }
        await db.update(games).set({ opponentId: validatedData.opponentId ?? null }).where(and(...conds));
      }
      logActivity(req.session.userId!, "edit_event", `Updated event "${event.title}"`, "team", undefined, existing.gameId, existing.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(events).where(and(eq(events.id, id), eq(events.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Event not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeEvent(id, existing.gameId, existing.rosterId);
      if (success) {
        logActivity(req.session.userId!, "delete_event", `Deleted event`, "team", undefined, existing.gameId, existing.rosterId);
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
      const teamId = getTeamId();
      const [existingPlayer] = await db.select().from(players).where(and(eq(players.id, id), eq(players.teamId, teamId))).limit(1);
      if (!existingPlayer) return res.status(404).json({ error: "Player not found" });
      if (!await verifyObjectScope(req, res, existingPlayer.gameId, existingPlayer.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertPlayerSchema.partial().parse(req.body));
      const player = await storage.updatePlayer(id, validatedData);
      logActivity(req.session.userId!, "edit_player", `Updated player "${player.name}"`, "team", undefined, existingPlayer.gameId, existingPlayer.rosterId);
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
      const attendance = await storage.getAllAttendance(getGameId(req), getRosterId(req));
      res.json(attendance);
    } catch (error: any) {
      console.error('Error in GET /api/attendance:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/attendance", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const validatedData = insertAttendanceSchema.parse(req.body);
      if (!validatedData.playerId) validatedData.playerId = null;
      if (!validatedData.staffId) validatedData.staffId = null;
      const attendance = await storage.addAttendance(validatedData, getGameId(req), getRosterId(req));
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(attendance).where(and(eq(attendance.id, id), eq(attendance.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Attendance not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertAttendanceSchema.partial().parse(req.body));
      const updated = await storage.updateAttendance(id, validatedData);
      res.json(updated);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(attendance).where(and(eq(attendance.id, id), eq(attendance.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Attendance not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
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
      const notes = await storage.getTeamNotes(getGameId(req), getRosterId(req));
      res.json(notes);
    } catch (error: any) {
      console.error('Error in GET /api/team-notes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/team-notes", requireAuth, requirePermission("view_chat"), async (req, res) => {
    try {
      const validatedData = insertTeamNotesSchema.parse(req.body);
      const note = await storage.addTeamNote(validatedData, getGameId(req), getRosterId(req));
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
      const teamId = getTeamId();
      const [note] = await db.select().from(teamNotes).where(and(eq(teamNotes.id, id), eq(teamNotes.teamId, teamId))).limit(1);
      if (!note) return res.status(404).json({ error: "Team note not found" });
      if (!await verifyObjectScope(req, res, note.gameId, note.rosterId)) return;
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
      const teamId = getTeamId();
      const [event] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.teamId, teamId))).limit(1);
      if (!event) return res.status(404).json({ error: "Event not found" });
      if (!await verifyObjectScope(req, res, event.gameId, event.rosterId)) return;
      const gamesList = await storage.getGamesByEventId(eventId, event.gameId, event.rosterId);
      res.json(gamesList);
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
      const gamesWithEventType = await storage.getAllGamesWithEventType(scope, getGameId(req), getRosterId(req));
      res.json(gamesWithEventType);
    } catch (error: any) {
      console.error('Error in GET /api/games:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/games", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const validatedData = insertGameSchema.parse(req.body);
      const teamId = getTeamId();
      const ctxGameId = getGameId(req);
      const ctxRosterId = getRosterId(req);
      // Cascade: if game has no opponentId but its parent event does, default to event.opponentId
      if (!validatedData.opponentId && validatedData.eventId) {
        const [parentEvent] = await db.select().from(events)
          .where(and(eq(events.id, validatedData.eventId), eq(events.teamId, teamId))).limit(1);
        if (parentEvent && parentEvent.opponentId) {
          validatedData.opponentId = parentEvent.opponentId;
        }
      }
      // Validate selected HBS / MVS belong to the same (team, game, roster) scope as this game
      if (validatedData.heroBanSystemId && ctxGameId && ctxRosterId) {
        const [hbs] = await db.select().from(heroBanSystems).where(and(
          eq(heroBanSystems.id, validatedData.heroBanSystemId as string),
          eq(heroBanSystems.teamId, teamId),
          eq(heroBanSystems.gameId, ctxGameId),
          eq(heroBanSystems.rosterId, ctxRosterId),
        )).limit(1);
        if (!hbs) return res.status(400).json({ error: "Invalid hero ban system for this match scope" });
      } else if (validatedData.heroBanSystemId) {
        return res.status(400).json({ error: "Game context required to assign a hero ban system" });
      }
      if (validatedData.mapVetoSystemId && ctxGameId && ctxRosterId) {
        const [mvs] = await db.select().from(mapVetoSystems).where(and(
          eq(mapVetoSystems.id, validatedData.mapVetoSystemId as string),
          eq(mapVetoSystems.teamId, teamId),
          eq(mapVetoSystems.gameId, ctxGameId),
          eq(mapVetoSystems.rosterId, ctxRosterId),
        )).limit(1);
        if (!mvs) return res.status(400).json({ error: "Invalid map veto system for this match scope" });
      } else if (validatedData.mapVetoSystemId) {
        return res.status(400).json({ error: "Game context required to assign a map veto system" });
      }
      const game = await storage.addGame(validatedData, ctxGameId, ctxRosterId);
      logActivity(req.session.userId!, "add_game", `Added game to event`, "team", undefined, game.gameId, game.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertGameSchema.partial().parse(req.body));
      if (validatedData.heroBanSystemId) {
        const [hbs] = await db.select().from(heroBanSystems).where(and(
          eq(heroBanSystems.id, validatedData.heroBanSystemId as string),
          eq(heroBanSystems.teamId, teamId),
          eq(heroBanSystems.gameId, existing.gameId!),
          eq(heroBanSystems.rosterId, existing.rosterId!),
        )).limit(1);
        if (!hbs) return res.status(400).json({ error: "Invalid hero ban system for this match scope" });
      }
      if (validatedData.mapVetoSystemId) {
        const [mvs] = await db.select().from(mapVetoSystems).where(and(
          eq(mapVetoSystems.id, validatedData.mapVetoSystemId as string),
          eq(mapVetoSystems.teamId, teamId),
          eq(mapVetoSystems.gameId, existing.gameId!),
          eq(mapVetoSystems.rosterId, existing.rosterId!),
        )).limit(1);
        if (!mvs) return res.status(400).json({ error: "Invalid map veto system for this match scope" });
      }
      const game = await storage.updateGame(id, validatedData, existing.gameId, existing.rosterId);
      if (!game) return res.status(404).json({ error: "Game not found" });
      logActivity(req.session.userId!, "edit_game", `Updated game`, "team", undefined, existing.gameId, existing.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeGame(id, existing.gameId, existing.rosterId);
      if (success) {
        logActivity(req.session.userId!, "delete_game", `Deleted game`, "team", undefined, existing.gameId, existing.rosterId);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Game not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/games:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/event-categories", requireAuth, async (req, res) => {
    try {
      const cats = await storage.getAllEventCategories(getGameId(req), getRosterId(req));
      res.json(cats);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/event-categories", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const data = insertEventCategorySchema.parse(req.body);
      const cat = await storage.addEventCategory(data, getGameId(req), getRosterId(req));
      res.json(cat);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/event-categories/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const [existing] = await db.select().from(eventCategories).where(and(eq(eventCategories.id, req.params.id), eq(eventCategories.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Event category not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const { name, sortOrder, color } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ error: "Name is required" });
      const cat = await storage.updateEventCategory(req.params.id, { name, sortOrder: sortOrder ?? undefined, color: color ?? undefined }, existing.gameId, existing.rosterId);
      if (!cat) return res.status(404).json({ error: "Event category not found" });
      res.json(cat);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/event-categories/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const [existing] = await db.select().from(eventCategories).where(and(eq(eventCategories.id, req.params.id), eq(eventCategories.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Event category not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeEventCategory(req.params.id, existing.gameId, existing.rosterId);
      if (!success) return res.status(404).json({ error: "Event category not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/event-sub-types", requireAuth, async (req, res) => {
    try {
      const subs = await storage.getAllEventSubTypes(getGameId(req), getRosterId(req));
      res.json(subs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/event-categories/:categoryId/sub-types", requireAuth, async (req, res) => {
    try {
      const subs = await storage.getEventSubTypesByCategory(req.params.categoryId);
      res.json(subs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/event-sub-types", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const data = insertEventSubTypeSchema.parse(req.body);
      const sub = await storage.addEventSubType(data, getGameId(req), getRosterId(req));
      res.json(sub);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/event-sub-types/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const [existing] = await db.select().from(eventSubTypes).where(and(eq(eventSubTypes.id, req.params.id), eq(eventSubTypes.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Event sub-type not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const { name, sortOrder, color } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ error: "Name is required" });
      const sub = await storage.updateEventSubType(req.params.id, { name, sortOrder: sortOrder ?? undefined, color: color ?? undefined }, existing.gameId, existing.rosterId);
      if (!sub) return res.status(404).json({ error: "Event sub-type not found" });
      res.json(sub);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/event-sub-types/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const [existing] = await db.select().from(eventSubTypes).where(and(eq(eventSubTypes.id, req.params.id), eq(eventSubTypes.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Event sub-type not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeEventSubType(req.params.id, existing.gameId, existing.rosterId);
      if (!success) return res.status(404).json({ error: "Event sub-type not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/events/:eventId/attendance", requireAuth, requirePermission("view_events"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const [event] = await db.select().from(events).where(and(eq(events.id, req.params.eventId), eq(events.teamId, teamId))).limit(1);
      if (!event) return res.status(404).json({ error: "Event not found" });
      if (!await verifyObjectScope(req, res, event.gameId, event.rosterId)) return;
      const records = await storage.getAttendanceByEventId(req.params.eventId, event.gameId, event.rosterId);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/events/:eventId/attendance", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { playerId, staffId, status } = req.body;
      const validStatuses = ["attended", "late", "absent", "present"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be one of: attended, late, absent" });
      }
      if (!playerId && !staffId) {
        return res.status(400).json({ error: "Either playerId or staffId is required" });
      }
      if (playerId && staffId) {
        return res.status(400).json({ error: "Provide only one of playerId or staffId" });
      }
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const event = await db.select().from(events).where(
        and(
          eq(events.id, req.params.eventId),
          eq(events.teamId, getTeamId()),
          eq(events.gameId, gid),
          eq(events.rosterId, rid)
        )
      ).limit(1);
      if (event.length === 0) return res.status(404).json({ error: "Event not found" });
      const e = event[0];
      const existing = await db.select().from(attendance).where(
        and(
          eq(attendance.eventId, req.params.eventId),
          eq(attendance.teamId, getTeamId()),
          playerId ? eq(attendance.playerId, playerId) : eq(attendance.staffId, staffId)
        )
      );
      if (existing.length > 0) {
        const updated = await db.update(attendance).set({ status }).where(eq(attendance.id, existing[0].id)).returning();
        return res.json(updated[0]);
      }
      const record = await storage.addAttendance({
        playerId: playerId || null,
        staffId: staffId || null,
        date: e.date,
        eventId: req.params.eventId,
        status,
        notes: null,
        ringer: null,
      }, getGameId(req), getRosterId(req));
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/game-modes", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      const gameModes = await storage.getAllGameModes(gameId, getRosterId(req));
      res.json(gameModes);
    } catch (error: any) {
      console.error('Error in GET /api/game-modes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/game-modes", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertGameModeSchema.parse(req.body);
      const gameMode = await storage.addGameMode(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_game_mode", `Added game mode "${gameMode.name}"`, "team", undefined, gameMode.gameId, gameMode.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(gameModes).where(and(eq(gameModes.id, id), eq(gameModes.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Game mode not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertGameModeSchema.partial().parse(req.body));
      const gameMode = await storage.updateGameMode(id, validatedData, existing.gameId, existing.rosterId);
      if (!gameMode) return res.status(404).json({ error: "Game mode not found" });
      logActivity(req.session.userId!, "edit_game_mode", `Updated game mode "${gameMode.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(gameMode);
    } catch (error: any) {
      console.error('Error in PUT /api/game-modes:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid game mode data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/game-modes/:id/usage", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(gameModes).where(and(eq(gameModes.id, id), eq(gameModes.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Game mode not found" });
      // Match the destructive endpoint's authority: viewing usage informs a delete decision.
      if (!await verifyConfigWriteScope(req, res, existing.gameId, existing.rosterId)) return;
      const [{ count: gamesUsing }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(games)
        .where(and(eq(games.teamId, teamId), eq(games.gameModeId, id)));
      const [{ count: mapsCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(maps)
        .where(and(eq(maps.teamId, teamId), eq(maps.gameModeId, id)));
      const [{ count: statFieldsCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(statFieldsTable)
        .where(and(eq(statFieldsTable.teamId, teamId), eq(statFieldsTable.gameModeId, id)));
      res.json({ gamesUsing, mapsCount, statFieldsCount });
    } catch (error: any) {
      console.error('Error in GET /api/game-modes/:id/usage:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/game-modes/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(gameModes).where(and(eq(gameModes.id, id), eq(gameModes.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Game mode not found" });
      // Use the stricter check: a roster-scoped manager must NOT cascade-delete a game-wide mode
      // (which would wipe maps/stat fields shared by every roster).
      if (!await verifyConfigWriteScope(req, res, existing.gameId, existing.rosterId)) return;

      // Cascade in a transaction so the user never sees an FK error.
      // 1) Detach historical games from this mode (set game_mode_id NULL — preserves the games).
      // 2) Delete dependent stat_fields (FK is RESTRICT — must remove first).
      // 3) Delete dependent maps (FK is RESTRICT — must remove first; games.mapId is SET NULL).
      // 4) Delete the game mode itself.
      const result = await db.transaction(async (tx) => {
        const detached = await tx
          .update(games)
          .set({ gameModeId: null })
          .where(and(eq(games.teamId, teamId), eq(games.gameModeId, id)))
          .returning({ id: games.id });
        const removedStatFields = await tx
          .delete(statFieldsTable)
          .where(and(eq(statFieldsTable.teamId, teamId), eq(statFieldsTable.gameModeId, id)))
          .returning({ id: statFieldsTable.id });
        const removedMaps = await tx
          .delete(maps)
          .where(and(eq(maps.teamId, teamId), eq(maps.gameModeId, id)))
          .returning({ id: maps.id });
        const deletedMode = await tx
          .delete(gameModes)
          .where(and(eq(gameModes.id, id), eq(gameModes.teamId, teamId)))
          .returning({ id: gameModes.id });
        return {
          modeDeleted: deletedMode.length > 0,
          gamesDetached: detached.length,
          statFieldsDeleted: removedStatFields.length,
          mapsDeleted: removedMaps.length,
        };
      });

      if (!result.modeDeleted) return res.status(404).json({ error: "Game mode not found" });
      logActivity(
        req.session.userId!,
        "delete_game_mode",
        `Deleted game mode "${existing.name}" (detached ${result.gamesDetached} game(s), removed ${result.mapsDeleted} map(s), ${result.statFieldsDeleted} stat field(s))`,
        "team",
        undefined,
        existing.gameId,
        existing.rosterId,
      );
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error in DELETE /api/game-modes:', error);
      res.status(500).json({ error: "Could not delete game mode. Please try again." });
    }
  });

  app.get("/api/heroes", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      const rosterId = getRosterId(req);
      let existing = await storage.getAllHeroes(gameId, rosterId);

      if (existing.length === 0 && rosterId && gameId) {
        // Resolve the game once; only seed if we have a known defaults source.
        const [game] = await db.select().from(supportedGames).where(eq(supportedGames.id, gameId)).limit(1);
        let defaultsSource: { name: string; role: string; sortOrder: number }[] | null = null;
        if (game?.slug === MARVEL_RIVALS_GAME_SLUG) {
          defaultsSource = MARVEL_RIVALS_DEFAULT_HEROES;
        } else if (game?.slug === OVERWATCH_GAME_SLUG) {
          defaultsSource = OVERWATCH_DEFAULT_HEROES;
        }
        if (defaultsSource) {
          // No outer flag gate — heroes count is the authoritative truth. The flag is only
          // an optimization; a stale flag with empty heroes must still self-heal.
          const teamId = getTeamId();
          await db.transaction(async (tx) => {
            // Serialize against any concurrent seeder (boot or other lazy req) for this exact (game, roster).
            await tx.execute(sql`SELECT pg_advisory_xact_lock(${HEROES_SEED_LOCK_KEY}::int, hashtext(${rosterId})::int)`);
            // Re-check inside the lock with full (team, game, roster) scope — another process may have seeded while we waited.
            const recheck = await tx.execute<{ cnt: number }>(
              sql`SELECT COUNT(*)::int AS cnt FROM heroes WHERE team_id = ${teamId} AND game_id = ${gameId} AND (roster_id IS NULL OR roster_id = ${rosterId})`
            );
            if (Number((recheck.rows as any[])[0]?.cnt || 0) > 0) return;

            const rows = defaultsSource!.map(h => ({
              teamId,
              gameId,
              rosterId,
              name: h.name,
              role: h.role,
              imageUrl: null,
              isActive: true,
              sortOrder: h.sortOrder,
            }));
            await tx.insert(heroes).values(rows).onConflictDoNothing();

            // Set the seeded flag AFTER the insert succeeds — atomic with the insert.
            const existingFlag = await tx.select().from(settings).where(and(
              eq(settings.teamId, teamId),
              eq(settings.gameId, gameId),
              eq(settings.rosterId, rosterId),
              eq(settings.key, HEROES_SEEDED_SETTING_KEY),
            )).limit(1);
            if (existingFlag.length === 0) {
              await tx.insert(settings).values({
                teamId, gameId, rosterId,
                key: HEROES_SEEDED_SETTING_KEY,
                value: "true",
              });
            } else {
              await tx.update(settings).set({ value: "true" }).where(and(
                eq(settings.teamId, teamId),
                eq(settings.gameId, gameId),
                eq(settings.rosterId, rosterId),
                eq(settings.key, HEROES_SEEDED_SETTING_KEY),
              ));
            }
          });
          existing = await storage.getAllHeroes(gameId, rosterId);
        }
      }

      res.json(existing);
    } catch (error: any) {
      console.error('Error in GET /api/heroes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/heroes", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertHeroSchema.parse(req.body);
      const hero = await storage.addHero(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_hero", `Added hero "${hero.name}"`, "team", undefined, hero.gameId, hero.rosterId);
      res.json(hero);
    } catch (error: any) {
      console.error('Error in POST /api/heroes:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid hero data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/heroes/reorder", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const reorderSchema = z.array(z.object({ id: z.string(), sortOrder: z.number().int() }));
      const items = reorderSchema.parse(req.body);
      const teamId = getTeamId();
      for (const item of items) {
        await db.update(heroes).set({ sortOrder: item.sortOrder }).where(and(eq(heroes.id, item.id), eq(heroes.teamId, teamId)));
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error in PUT /api/heroes/reorder:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid reorder data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/heroes/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(heroes).where(and(eq(heroes.id, id), eq(heroes.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Hero not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertHeroSchema.partial().parse(req.body));
      const hero = await storage.updateHero(id, validatedData, existing.gameId, existing.rosterId);
      if (!hero) return res.status(404).json({ error: "Hero not found" });
      logActivity(req.session.userId!, "edit_hero", `Updated hero "${hero.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(hero);
    } catch (error: any) {
      console.error('Error in PUT /api/heroes:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid hero data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/heroes/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(heroes).where(and(eq(heroes.id, id), eq(heroes.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Hero not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeHero(id, existing.gameId, existing.rosterId);
      if (success) {
        logActivity(req.session.userId!, "delete_hero", `Deleted hero "${existing.name}"`, "team", undefined, existing.gameId, existing.rosterId);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Hero not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/heroes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Hero Role Configs (per-game) =====
  app.get("/api/hero-role-configs", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      if (!await verifyObjectScope(req, res, gameId, null)) return;
      const list = await storage.getAllHeroRoleConfigs(gameId);
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      res.json(list);
    } catch (error: any) {
      console.error('Error in GET /api/hero-role-configs:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/hero-role-configs", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      if (!await verifyObjectScope(req, res, gameId, null)) return;
      const validated = insertHeroRoleConfigSchema.parse(req.body);
      const valuesWithColor = {
        ...validated,
        color: (validated as any).color ?? defaultColorForSortOrder(validated.sortOrder ?? 0),
      };
      const row = await storage.addHeroRoleConfig(valuesWithColor as any, gameId);
      logActivity(req.session.userId!, "add_hero_role_config", `Added hero role "${row.name}"`, "team", undefined, gameId, null);
      res.json(row);
    } catch (error: any) {
      console.error('Error in POST /api/hero-role-configs:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid data", details: error.errors });
      if (error.code === '23505') return res.status(409).json({ error: "A role with this name already exists for this game" });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/hero-role-configs/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(heroRoleConfigs).where(and(eq(heroRoleConfigs.id, id), eq(heroRoleConfigs.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Hero role config not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, null)) return;
      const validated = insertHeroRoleConfigSchema.partial().parse(req.body);
      const oldName = existing.name;
      // Atomic: update the config row, and (if renamed) cascade hero.role in one transaction.
      const row = await db.transaction(async (tx) => {
        const [updated] = await tx.update(heroRoleConfigs)
          .set(validated)
          .where(and(
            eq(heroRoleConfigs.id, id),
            eq(heroRoleConfigs.teamId, teamId),
            eq(heroRoleConfigs.gameId, existing.gameId),
          ))
          .returning();
        if (updated && validated.name && validated.name !== oldName) {
          await tx.update(heroes)
            .set({ role: updated.name })
            .where(and(
              eq(heroes.teamId, teamId),
              eq(heroes.gameId, existing.gameId),
              eq(heroes.role, oldName),
            ));
        }
        return updated;
      });
      if (!row) return res.status(404).json({ error: "Hero role config not found" });
      logActivity(req.session.userId!, "edit_hero_role_config", `Updated hero role "${oldName}" -> "${row.name}"`, "team", undefined, existing.gameId, null);
      res.json(row);
    } catch (error: any) {
      console.error('Error in PUT /api/hero-role-configs:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid data", details: error.errors });
      if (error.code === '23505') return res.status(409).json({ error: "A role with this name already exists for this game" });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Safe delete: requires ?reassignTo=<roleConfigId> when heroes still use this role.
  app.delete("/api/hero-role-configs/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const reassignTo = typeof req.query.reassignTo === "string" ? req.query.reassignTo : null;
      const teamId = getTeamId();
      const [existing] = await db.select().from(heroRoleConfigs).where(and(eq(heroRoleConfigs.id, id), eq(heroRoleConfigs.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Hero role config not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, null)) return;

      // Count heroes in this (team, game) currently using this role name.
      const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` })
        .from(heroes)
        .where(and(
          eq(heroes.teamId, teamId),
          eq(heroes.gameId, existing.gameId),
          eq(heroes.role, existing.name),
        ));
      const usedBy = Number(cnt) || 0;

      let replacementName: string | null = null;
      if (usedBy > 0) {
        if (!reassignTo) {
          return res.status(409).json({
            error: "Role is in use by heroes. Provide ?reassignTo=<roleConfigId> to migrate them, or rename heroes first.",
            heroesAffected: usedBy,
          });
        }
        if (reassignTo === id) {
          return res.status(400).json({ error: "Cannot reassign to the role being deleted" });
        }
        const [target] = await db.select().from(heroRoleConfigs).where(and(
          eq(heroRoleConfigs.id, reassignTo),
          eq(heroRoleConfigs.teamId, teamId),
          eq(heroRoleConfigs.gameId, existing.gameId),
        )).limit(1);
        if (!target) return res.status(400).json({ error: "Reassignment target role not found in this game" });
        replacementName = target.name;
      }

      await db.transaction(async (tx) => {
        if (replacementName !== null) {
          await tx.update(heroes)
            .set({ role: replacementName })
            .where(and(
              eq(heroes.teamId, teamId),
              eq(heroes.gameId, existing.gameId),
              eq(heroes.role, existing.name),
            ));
        }
        await tx.delete(heroRoleConfigs).where(and(
          eq(heroRoleConfigs.id, id),
          eq(heroRoleConfigs.teamId, teamId),
        ));
      });

      logActivity(
        req.session.userId!,
        "delete_hero_role_config",
        replacementName
          ? `Deleted hero role "${existing.name}" (reassigned ${usedBy} hero(es) to "${replacementName}")`
          : `Deleted hero role "${existing.name}"`,
        "team",
        undefined,
        existing.gameId,
        null,
      );
      res.json({ success: true, heroesReassigned: usedBy, replacement: replacementName });
    } catch (error: any) {
      console.error('Error in DELETE /api/hero-role-configs:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Opponents =====
  app.get("/api/opponents", requireAuth, async (req, res) => {
    try {
      const list = await storage.getAllOpponents(getGameId(req), getRosterId(req));
      res.json(list);
    } catch (error: any) {
      console.error('Error in GET /api/opponents:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/opponents", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertOpponentSchema.parse(req.body);
      const opp = await storage.addOpponent(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_opponent", `Added opponent "${opp.name}"`, "team", undefined, opp.gameId, opp.rosterId);
      res.json(opp);
    } catch (error: any) {
      console.error('Error in POST /api/opponents:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid opponent data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/opponents/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getOpponent(id);
      if (!existing) return res.status(404).json({ error: "Opponent not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertOpponentSchema.partial().parse(req.body));
      const updated = await storage.updateOpponent(id, validatedData, existing.gameId, existing.rosterId);
      if (!updated) return res.status(404).json({ error: "Opponent not found" });
      logActivity(req.session.userId!, "edit_opponent", `Updated opponent "${updated.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/opponents:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid opponent data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/opponents/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getOpponent(id);
      if (!existing) return res.status(404).json({ error: "Opponent not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeOpponent(id, existing.gameId, existing.rosterId);
      if (success) {
        logActivity(req.session.userId!, "delete_opponent", `Deleted opponent "${existing.name}"`, "team", undefined, existing.gameId, existing.rosterId);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Opponent not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/opponents:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Opponent Players =====
  app.get("/api/opponents/:id/players", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getOpponent(id);
      if (!existing) return res.status(404).json({ error: "Opponent not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const list = await storage.getOpponentPlayersByOpponentId(id);
      res.json(list);
    } catch (error: any) {
      console.error('Error in GET /api/opponents/:id/players:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/opponents/:id/players", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getOpponent(id);
      if (!existing) return res.status(404).json({ error: "Opponent not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = insertOpponentPlayerSchema.parse({ ...req.body, opponentId: id });
      const player = await storage.addOpponentPlayer(validatedData, existing.gameId, existing.rosterId);
      logActivity(req.session.userId!, "add_opponent_player", `Added opponent player "${player.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(player);
    } catch (error: any) {
      console.error('Error in POST /api/opponents/:id/players:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid opponent player data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/opponent-players/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getOpponentPlayer(id);
      if (!existing) return res.status(404).json({ error: "Opponent player not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertOpponentPlayerSchema.partial().parse(req.body));
      const updated = await storage.updateOpponentPlayer(id, validatedData);
      if (!updated) return res.status(404).json({ error: "Opponent player not found" });
      res.json(updated);
    } catch (error: any) {
      console.error('Error in PUT /api/opponent-players:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid opponent player data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/opponent-players/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getOpponentPlayer(id);
      if (!existing) return res.status(404).json({ error: "Opponent player not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeOpponentPlayer(id);
      if (success) res.json({ success: true });
      else res.status(404).json({ error: "Opponent player not found" });
    } catch (error: any) {
      console.error('Error in DELETE /api/opponent-players:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Game Heroes (replace-all) =====
  app.get("/api/games/:id/heroes", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rows = await storage.getGameHeroesByMatchId(id);
      res.json(rows);
    } catch (error: any) {
      console.error('Error in GET /api/games/:id/heroes:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/games/:id/heroes", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rowsSchema = z.array(insertGameHeroSchema.omit({ matchId: true }));
      const rows = rowsSchema.parse(req.body);
      const saved = await storage.replaceGameHeroes(id, rows, game.gameId, game.rosterId);
      res.json(saved);
    } catch (error: any) {
      console.error('Error in PUT /api/games/:id/heroes:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid hero data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Game Participation (per-side roster + DNP) =====
  app.get("/api/games/:id/participation", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const participants = await storage.getMatchParticipants(id);
      res.json(participants);
    } catch (error: any) {
      console.error('Error in GET /api/games/:id/participation:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/games/:id/participation", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rowsSchema = z.array(insertMatchParticipantSchema.omit({ matchId: true }));
      const rows = rowsSchema.parse(req.body);
      const saved = await storage.replaceMatchParticipants(id, rows, game.gameId, game.rosterId);
      res.json(saved);
    } catch (error: any) {
      console.error('Error in PUT /api/games/:id/participation:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid participation data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Opponent player stats per game =====
  app.get("/api/games/:id/opponent-player-stats", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const stats = await storage.getOpponentPlayerGameStats(id);
      res.json(stats);
    } catch (error: any) {
      console.error('Error in GET /api/games/:id/opponent-player-stats:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/games/:id/opponent-player-stats", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rowsSchema = z.array(insertOpponentPlayerGameStatSchema.omit({ matchId: true }));
      const rows = rowsSchema.parse(req.body);
      const saved = await storage.saveOpponentPlayerGameStats(id, rows.map(r => ({ ...r, matchId: id })), game.gameId);
      res.json(saved);
    } catch (error: any) {
      console.error('Error in POST /api/games/:id/opponent-player-stats:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid opponent stats data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Hero Ban Systems (roster-scoped config) =====
  app.get("/api/hero-ban-systems", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      const teamId = getTeamId();
      const [user] = await db.select().from(users).where(and(eq(users.id, req.session.userId!), eq(users.teamId, teamId))).limit(1);
      const isAdmin = user && (user.orgRole === "super_admin" || user.orgRole === "org_admin");
      if (!isAdmin && !gameId) {
        return res.status(403).json({ error: "Game context required" });
      }
      if (gameId && !await verifyObjectScope(req, res, gameId, rosterId)) return;
      let list = await storage.getAllHeroBanSystems(gameId, rosterId);
      if (!isAdmin && gameId && !rosterId) {
        const assigns = await db.select().from(userGameAssignments).where(and(
          eq(userGameAssignments.userId, req.session.userId!),
          eq(userGameAssignments.gameId, gameId),
          eq(userGameAssignments.status, "approved"),
          eq(userGameAssignments.teamId, teamId),
        ));
        const hasGameWide = assigns.some(a => a.rosterId === null);
        if (!hasGameWide) {
          const allowedRosters = new Set(assigns.map(a => a.rosterId).filter((r): r is string => !!r));
          list = list.filter(s => s.rosterId === null || (s.rosterId && allowedRosters.has(s.rosterId)));
        }
      }
      res.json(list);
    } catch (error: any) {
      console.error('Error in GET /api/hero-ban-systems:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/hero-ban-systems", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      if (!await verifyConfigWriteScope(req, res, gameId, rosterId)) return;
      const validated = insertHeroBanSystemSchema.parse(req.body);
      const row = await storage.addHeroBanSystem(validated, gameId, rosterId);
      logActivity(req.session.userId!, "add_hero_ban_system", `Added Hero Ban System "${row.name}"`, "team", undefined, row.gameId, row.rosterId);
      res.json(row);
    } catch (error: any) {
      console.error('Error in POST /api/hero-ban-systems:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/hero-ban-systems/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(heroBanSystems).where(and(eq(heroBanSystems.id, id), eq(heroBanSystems.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Hero Ban System not found" });
      if (!await verifyConfigWriteScope(req, res, existing.gameId, existing.rosterId)) return;
      const validated = await sanitizeScopeFields(req, insertHeroBanSystemSchema.partial().parse(req.body));
      const row = await storage.updateHeroBanSystem(id, validated, existing.gameId, existing.rosterId);
      if (!row) return res.status(404).json({ error: "Hero Ban System not found" });
      logActivity(req.session.userId!, "edit_hero_ban_system", `Updated Hero Ban System "${row.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(row);
    } catch (error: any) {
      console.error('Error in PUT /api/hero-ban-systems:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/hero-ban-systems/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(heroBanSystems).where(and(eq(heroBanSystems.id, id), eq(heroBanSystems.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Hero Ban System not found" });
      if (!await verifyConfigWriteScope(req, res, existing.gameId, existing.rosterId)) return;
      const ok = await storage.removeHeroBanSystem(id, existing.gameId, existing.rosterId);
      if (ok) {
        logActivity(req.session.userId!, "delete_hero_ban_system", `Deleted Hero Ban System "${existing.name}"`, "team", undefined, existing.gameId, existing.rosterId);
        return res.json({ success: true });
      }
      res.status(404).json({ error: "Hero Ban System not found" });
    } catch (error: any) {
      console.error('Error in DELETE /api/hero-ban-systems:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Map Veto Systems (roster-scoped config) =====
  app.get("/api/map-veto-systems", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      const teamId = getTeamId();
      const [user] = await db.select().from(users).where(and(eq(users.id, req.session.userId!), eq(users.teamId, teamId))).limit(1);
      const isAdmin = user && (user.orgRole === "super_admin" || user.orgRole === "org_admin");
      if (!isAdmin && !gameId) {
        return res.status(403).json({ error: "Game context required" });
      }
      if (gameId && !await verifyObjectScope(req, res, gameId, rosterId)) return;
      let list = await storage.getAllMapVetoSystems(gameId, rosterId);
      if (!isAdmin && gameId && !rosterId) {
        const assigns = await db.select().from(userGameAssignments).where(and(
          eq(userGameAssignments.userId, req.session.userId!),
          eq(userGameAssignments.gameId, gameId),
          eq(userGameAssignments.status, "approved"),
          eq(userGameAssignments.teamId, teamId),
        ));
        const hasGameWide = assigns.some(a => a.rosterId === null);
        if (!hasGameWide) {
          const allowedRosters = new Set(assigns.map(a => a.rosterId).filter((r): r is string => !!r));
          list = list.filter(s => s.rosterId === null || (s.rosterId && allowedRosters.has(s.rosterId)));
        }
      }
      res.json(list);
    } catch (error: any) {
      console.error('Error in GET /api/map-veto-systems:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/map-veto-systems", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      if (!await verifyConfigWriteScope(req, res, gameId, rosterId)) return;
      const validated = insertMapVetoSystemSchema.parse(req.body);
      const row = await storage.addMapVetoSystem(validated, gameId, rosterId);
      logActivity(req.session.userId!, "add_map_veto_system", `Added Map Veto System "${row.name}"`, "team", undefined, row.gameId, row.rosterId);
      res.json(row);
    } catch (error: any) {
      console.error('Error in POST /api/map-veto-systems:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/map-veto-systems/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(mapVetoSystems).where(and(eq(mapVetoSystems.id, id), eq(mapVetoSystems.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Map Veto System not found" });
      if (!await verifyConfigWriteScope(req, res, existing.gameId, existing.rosterId)) return;
      const validated = await sanitizeScopeFields(req, insertMapVetoSystemSchema.partial().parse(req.body));
      const row = await storage.updateMapVetoSystem(id, validated, existing.gameId, existing.rosterId);
      if (!row) return res.status(404).json({ error: "Map Veto System not found" });
      logActivity(req.session.userId!, "edit_map_veto_system", `Updated Map Veto System "${row.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(row);
    } catch (error: any) {
      console.error('Error in PUT /api/map-veto-systems:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/map-veto-systems/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(mapVetoSystems).where(and(eq(mapVetoSystems.id, id), eq(mapVetoSystems.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Map Veto System not found" });
      if (!await verifyConfigWriteScope(req, res, existing.gameId, existing.rosterId)) return;
      const ok = await storage.removeMapVetoSystem(id, existing.gameId, existing.rosterId);
      if (ok) {
        logActivity(req.session.userId!, "delete_map_veto_system", `Deleted Map Veto System "${existing.name}"`, "team", undefined, existing.gameId, existing.rosterId);
        return res.json({ success: true });
      }
      res.status(404).json({ error: "Map Veto System not found" });
    } catch (error: any) {
      console.error('Error in DELETE /api/map-veto-systems:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Per-game hero ban actions =====
  app.get("/api/games/:id/hero-ban-actions", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rows = await storage.getHeroBanActionsByMatchId(id);
      res.json(rows);
    } catch (error: any) {
      console.error('Error in GET /api/games/:id/hero-ban-actions:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/games/:id/hero-ban-actions", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rowsSchema = z.array(insertGameHeroBanActionSchema.omit({ matchId: true }).extend({
        actionType: z.enum(heroBanActionTypes),
        actingTeam: z.enum(banVetoTeamSlots),
      }));
      const rows = rowsSchema.parse(req.body);
      if (rows.length > 40) return res.status(400).json({ error: "Hero ban sequence cannot exceed 40 steps" });
      const heroIds = Array.from(new Set(rows.map(r => r.heroId).filter((x): x is string => !!x)));
      if (heroIds.length > 0) {
        const valid = await db.select({ id: heroes.id }).from(heroes).where(and(
          inArray(heroes.id, heroIds),
          eq(heroes.teamId, teamId),
          eq(heroes.gameId, game.gameId!),
          eq(heroes.rosterId, game.rosterId!),
        ));
        if (valid.length !== heroIds.length) {
          return res.status(400).json({ error: "One or more heroes are out of scope for this match" });
        }
      }
      const saved = await storage.replaceHeroBanActions(id, rows, game.gameId, game.rosterId);
      res.json(saved);
    } catch (error: any) {
      console.error('Error in PUT /api/games/:id/hero-ban-actions:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid hero ban data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Per-game map veto rows =====
  app.get("/api/games/:id/map-veto-rows", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rows = await storage.getMapVetoRowsByMatchId(id);
      res.json(rows);
    } catch (error: any) {
      console.error('Error in GET /api/games/:id/map-veto-rows:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/games/:id/map-veto-rows", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rowsSchema = z.array(insertGameMapVetoRowSchema.omit({ matchId: true }).extend({
        actionType: z.enum(mapVetoActionTypes),
        actingTeam: z.enum(banVetoTeamSlots),
      }));
      const rows = rowsSchema.parse(req.body);
      if (rows.length > 40) return res.status(400).json({ error: "Map veto cannot exceed 40 rows" });
      const mapIds = Array.from(new Set(rows.map(r => r.mapId).filter((x): x is string => !!x)));
      if (mapIds.length > 0) {
        const mapConditions = [
          inArray(maps.id, mapIds),
          eq(maps.teamId, teamId),
          eq(maps.gameId, game.gameId!),
        ];
        if (game.rosterId) {
          mapConditions.push(or(isNull(maps.rosterId), eq(maps.rosterId, game.rosterId))!);
        }
        const valid = await db.select({ id: maps.id }).from(maps).where(and(...mapConditions));
        if (valid.length !== mapIds.length) {
          return res.status(400).json({ error: "One or more maps are out of scope for this match" });
        }
      }
      const sideIds = Array.from(new Set(rows.map(r => r.sideId).filter((x): x is string => !!x)));
      if (sideIds.length > 0) {
        const sideConditions = [
          inArray(sides.id, sideIds),
          eq(sides.teamId, teamId),
          eq(sides.gameId, game.gameId!),
        ];
        if (game.rosterId) {
          sideConditions.push(or(isNull(sides.rosterId), eq(sides.rosterId, game.rosterId))!);
        }
        const valid = await db.select({ id: sides.id }).from(sides).where(and(...sideConditions));
        if (valid.length !== sideIds.length) {
          return res.status(400).json({ error: "One or more sides are out of scope for this match" });
        }
      }
      const saved = await storage.replaceMapVetoRows(id, rows, game.gameId, game.rosterId);
      res.json(saved);
    } catch (error: any) {
      console.error('Error in PUT /api/games/:id/map-veto-rows:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid map veto data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/maps", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      const maps = await storage.getAllMaps(gameId, getRosterId(req));
      res.json(maps);
    } catch (error: any) {
      console.error('Error in GET /api/maps:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Single-mode game toggle =====
  // Stored in `settings` (key="single_mode_game") at (team, game, roster=null).
  // When true, the Maps / Stat Fields / Score Config UIs should hide the game-mode
  // dimension and treat all rows for the game as one flat list. No data is
  // deleted when this flag flips — existing modes/maps/stat-fields are preserved.
  app.get("/api/game-config/single-mode", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      const v = await storage.getSetting("single_mode_game", gameId, null);
      res.json({ singleMode: v === "true" });
    } catch (error: any) {
      console.error('Error in GET /api/game-config/single-mode:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/game-config/single-mode", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      const { singleMode } = z.object({ singleMode: z.boolean() }).parse(req.body);
      await storage.setSetting("single_mode_game", singleMode ? "true" : "false", gameId, null);
      logActivity(
        req.session.userId!,
        singleMode ? "enable_single_mode_game" : "disable_single_mode_game",
        singleMode ? "Switched game to single-mode layout" : "Switched game back to multi-mode layout",
        "team", undefined, gameId, null
      );
      res.json({ singleMode });
    } catch (error: any) {
      console.error('Error in PUT /api/game-config/single-mode:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid payload", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Game Templates (super_admin only) =====
  // Reusable per-game configuration packs (modes/maps/heroes/stat-fields/score/
  // categories/availability/opponents). Stored as JSONB on `game_templates`.
  // Apply replaces a roster's config in a single transaction. NEVER touches
  // players, games, events, attendance, or history.
  app.get("/api/game-templates", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const list = await storage.getAllGameTemplates();
      res.json(list);
    } catch (error: any) {
      console.error('Error in GET /api/game-templates:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/game-templates/:id", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const tpl = await storage.getGameTemplate(req.params.id);
      if (!tpl) return res.status(404).json({ error: "Template not found" });
      res.json(tpl);
    } catch (error: any) {
      console.error('Error in GET /api/game-templates/:id:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Lookup-by-code is intentionally available to anyone with manage_game_config
  // so an org_admin can preview/apply a code shared with them. We still enforce
  // super_admin on create/update/delete.
  app.get("/api/game-templates/by-code/:code", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const code = String(req.params.code || "").trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "Code required" });
      const tpl = await storage.getGameTemplateByCode(code);
      if (!tpl) return res.status(404).json({ error: "Template not found" });
      res.json(tpl);
    } catch (error: any) {
      console.error('Error in GET /api/game-templates/by-code:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/game-templates", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const body = z.object({
        name: z.string().min(1).max(100),
        gameId: z.string().uuid(),
        code: z.string().min(3).max(40),
        config: z.any().optional(),
      }).parse(req.body);
      const code = body.code.trim().toUpperCase();
      const existing = await storage.getGameTemplateByCode(code);
      if (existing) return res.status(400).json({ error: "Code already in use" });
      const tpl = await storage.createGameTemplate(body.name, body.gameId, code, body.config ?? {});
      logActivity(req.session.userId!, "create_game_template",
        `Created game template "${tpl.name}" (${tpl.code})`, "team", undefined, body.gameId, null);
      res.json(tpl);
    } catch (error: any) {
      console.error('Error in POST /api/game-templates:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid payload", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/game-templates/:id", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const body = z.object({
        name: z.string().min(1).max(100).optional(),
        config: z.any().optional(),
      }).parse(req.body);
      const tpl = await storage.updateGameTemplate(req.params.id, body);
      if (!tpl) return res.status(404).json({ error: "Template not found" });
      logActivity(req.session.userId!, "update_game_template",
        `Updated game template "${tpl.name}" (${tpl.code})`, "team", undefined, tpl.gameId, null);
      res.json(tpl);
    } catch (error: any) {
      console.error('Error in PUT /api/game-templates/:id:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid payload", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/game-templates/:id", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const existing = await storage.getGameTemplate(req.params.id);
      if (!existing) return res.status(404).json({ error: "Template not found" });
      const ok = await storage.deleteGameTemplate(req.params.id);
      if (!ok) return res.status(404).json({ error: "Template not found" });
      logActivity(req.session.userId!, "delete_game_template",
        `Deleted game template "${existing.name}" (${existing.code})`, "team", undefined, existing.gameId, null);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Error in DELETE /api/game-templates/:id:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Apply a template (by id OR by code) to the CURRENT roster context.
  // Caller must hold manage_game_config (also required for the regular config tabs).
  app.post("/api/game-templates/apply", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const body = z.object({
        templateId: z.string().uuid().optional(),
        code: z.string().optional(),
      }).parse(req.body);
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      if (!gameId || !rosterId) {
        return res.status(400).json({ error: "Game and roster context required" });
      }
      // Enforce that the caller actually has access to this game+roster (not just
      // any roster for which they hold manage_game_config). Mirrors verifyObjectScope
      // used by the other config write endpoints.
      if (!await verifyObjectScope(req, res, gameId, rosterId)) return;
      let tpl;
      if (body.templateId) {
        tpl = await storage.getGameTemplate(body.templateId);
      } else if (body.code) {
        tpl = await storage.getGameTemplateByCode(body.code.trim().toUpperCase());
      } else {
        return res.status(400).json({ error: "templateId or code required" });
      }
      if (!tpl) return res.status(404).json({ error: "Template not found" });
      if (tpl.gameId !== gameId) {
        return res.status(400).json({ error: "Template is for a different game than the current roster" });
      }
      await storage.applyGameTemplate(tpl.id, rosterId, gameId);
      logActivity(req.session.userId!, "apply_game_template",
        `Applied template "${tpl.name}" (${tpl.code}) to roster`, "team", undefined, gameId, rosterId);
      res.json({ ok: true, templateName: tpl.name, code: tpl.code });
    } catch (error: any) {
      console.error('Error in POST /api/game-templates/apply:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid payload", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ── Media Library (super_admin only) ──────────────────────────────────
  // Aggregates every image URL stored on the platform (map images, hero
  // images, opponent logos, scoreboard uploads) into a structure that the
  // Media Library UI can render. Read-only — never deletes anything.
  app.get("/api/media-library", requireAuth, requireOrgRole("super_admin"), async (_req, res) => {
    try {
      const teamId = getTeamId();
      const [allGames, mapsRows, heroesRows, oppsRows, scoreboardRows, foldersRows, itemsRows] = await Promise.all([
        db.select().from(supportedGames),
        db.select({ id: maps.id, name: maps.name, url: maps.imageUrl, gameId: maps.gameId, rosterId: maps.rosterId })
          .from(maps).where(and(eq(maps.teamId, teamId), sql`${maps.imageUrl} IS NOT NULL AND ${maps.imageUrl} <> ''`)),
        db.select({ id: heroes.id, name: heroes.name, url: heroes.imageUrl, gameId: heroes.gameId, rosterId: heroes.rosterId })
          .from(heroes).where(and(eq(heroes.teamId, teamId), sql`${heroes.imageUrl} IS NOT NULL AND ${heroes.imageUrl} <> ''`)),
        db.select({ id: opponents.id, name: opponents.name, url: opponents.logoUrl, gameId: opponents.gameId, rosterId: opponents.rosterId })
          .from(opponents).where(and(eq(opponents.teamId, teamId), sql`${opponents.logoUrl} IS NOT NULL AND ${opponents.logoUrl} <> ''`)),
        db.select({ id: games.id, name: games.gameCode, url: games.imageUrl, gameId: games.gameId, rosterId: games.rosterId })
          .from(games).where(and(eq(games.teamId, teamId), sql`${games.imageUrl} IS NOT NULL AND ${games.imageUrl} <> ''`)),
        db.select().from(mediaFolders).where(eq(mediaFolders.teamId, teamId)),
        db.select().from(mediaItems).where(eq(mediaItems.teamId, teamId)),
      ]);

      type Item = { id: string; name: string; url: string; rosterId: string | null };
      const grouped = allGames.map((g) => ({
        gameId: g.id,
        gameSlug: g.slug,
        gameName: g.name,
        gameIconUrl: g.iconUrl,
        sortOrder: g.sortOrder,
        categories: {
          maps: mapsRows.filter(r => r.gameId === g.id).map(r => ({ id: r.id, name: r.name, url: r.url!, rosterId: r.rosterId })) as Item[],
          heroes: heroesRows.filter(r => r.gameId === g.id).map(r => ({ id: r.id, name: r.name, url: r.url!, rosterId: r.rosterId })) as Item[],
          opponents: oppsRows.filter(r => r.gameId === g.id).map(r => ({ id: r.id, name: r.name, url: r.url!, rosterId: r.rosterId })) as Item[],
          scoreboards: scoreboardRows.filter(r => r.gameId === g.id).map(r => ({ id: r.id, name: r.name, url: r.url!, rosterId: r.rosterId })) as Item[],
        },
      }));
      // Build a recursive folder tree. A folder appears under its `parentId`,
      // or — when it has none — under either the "Custom Folders" root
      // (`gameId === null`) or the matching game's group (`gameId !== null`).
      type FolderNode = {
        id: string;
        name: string;
        sortOrder: number;
        items: { id: string; name: string; url: string }[];
        subfolders: FolderNode[];
      };
      const sortFolders = (rows: typeof foldersRows) =>
        [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
      // Cycle guard: a corrupted row (legacy data, race) could form a
      // parent->child loop; without this, recursion would never terminate.
      // Defensive: tolerate being called via `.map(buildNode)` (which would
      // pass the array index as the 2nd arg) by accepting anything that
      // isn't a Set and starting a fresh visited set.
      const buildNode = (f: typeof foldersRows[number], visited?: Set<string>): FolderNode => {
        const seen: Set<string> = visited instanceof Set ? visited : new Set();
        if (seen.has(f.id)) {
          return { id: f.id, name: f.name, sortOrder: f.sortOrder ?? 0, items: [], subfolders: [] };
        }
        const nextVisited = new Set(seen);
        nextVisited.add(f.id);
        return {
          id: f.id,
          name: f.name,
          sortOrder: f.sortOrder ?? 0,
          items: itemsRows
            .filter(it => it.folderId === f.id)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
            .map(it => ({ id: it.id, name: it.name, url: it.url })),
          subfolders: sortFolders(foldersRows.filter(c => c.parentId === f.id)).map(c => buildNode(c, nextVisited)),
        };
      };

      // "Custom Folders" root = folders with no game and no parent.
      // NOTE: `.map(buildNode)` would pass the array index as the 2nd arg
      // and clobber `visited`. Always invoke with an explicit arrow.
      const customFolders = sortFolders(
        foldersRows.filter(f => !f.gameId && !f.parentId),
      ).map(f => buildNode(f));

      // Per-game custom subfolder roots.
      const gameRootFolders = (gameId: string) =>
        sortFolders(foldersRows.filter(f => f.gameId === gameId && !f.parentId)).map(f => buildNode(f));

      // Re-emit `grouped` with games whose roots include either built-in
      // image categories or any custom folder.
      const groupedWithFolders = grouped.map(g => ({
        ...g,
        customFolders: gameRootFolders(g.gameId),
      }));
      const filteredWithFolders = groupedWithFolders.filter(g =>
        g.categories.maps.length + g.categories.heroes.length +
        g.categories.opponents.length + g.categories.scoreboards.length +
        g.customFolders.length > 0,
      );

      res.json({ games: filteredWithFolders, customFolders });
    } catch (error: any) {
      console.error('Error in GET /api/media-library:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ── Custom Media Folders (super-admin only, team-scoped) ──
  app.post("/api/media-folders", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const data = insertMediaFolderSchema.parse(req.body);
      // If creating a subfolder, the parent must belong to this team. We
      // also inherit the parent's gameId so a subfolder can never escape
      // its tree (e.g. a child of a Valorant folder must remain Valorant).
      let gameId = data.gameId ?? null;
      if (data.parentId) {
        const [parent] = await db.select().from(mediaFolders)
          .where(and(eq(mediaFolders.id, data.parentId), eq(mediaFolders.teamId, teamId))).limit(1);
        if (!parent) return res.status(400).json({ error: "Parent folder not found" });
        gameId = parent.gameId ?? null;
      }
      const [row] = await db.insert(mediaFolders).values({
        ...data, teamId, gameId,
      }).returning();
      res.json(row);
    } catch (error: any) {
      console.error('Error in POST /api/media-folders:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid folder data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/media-folders/:id", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { id } = req.params;
      const data = insertMediaFolderSchema.partial().parse(req.body);

      // Make sure the folder exists in this team before we touch anything.
      const [existing] = await db.select().from(mediaFolders)
        .where(and(eq(mediaFolders.id, id), eq(mediaFolders.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Folder not found" });

      // Lock down which fields can move around. We never let `gameId` be
      // rewritten directly — it's derived from the parent at create time
      // and stays put — and we validate any new parentId hard against
      // (a) same team, (b) not self, (c) not a descendant (cycle).
      const updates: Record<string, unknown> = {};
      if (typeof data.name === "string") updates.name = data.name;
      if (typeof data.sortOrder === "number") updates.sortOrder = data.sortOrder;

      if ("parentId" in data) {
        const newParentId = data.parentId ?? null;
        if (newParentId === id) return res.status(400).json({ error: "Folder cannot be its own parent" });
        let inheritedGameId: string | null = existing.gameId ?? null;
        if (newParentId) {
          const [parent] = await db.select().from(mediaFolders)
            .where(and(eq(mediaFolders.id, newParentId), eq(mediaFolders.teamId, teamId))).limit(1);
          if (!parent) return res.status(400).json({ error: "Parent folder not found" });
          // Cycle check: walk the candidate parent's ancestor chain — if
          // we ever land on `id`, this move would form a loop.
          const allTeamFolders = await db.select({ id: mediaFolders.id, parentId: mediaFolders.parentId })
            .from(mediaFolders).where(eq(mediaFolders.teamId, teamId));
          const parentOf = new Map(allTeamFolders.map(f => [f.id, f.parentId ?? null]));
          let cursor: string | null = parent.id;
          const seen = new Set<string>();
          while (cursor) {
            if (cursor === id) return res.status(400).json({ error: "Cannot move folder into its own descendant" });
            if (seen.has(cursor)) break;
            seen.add(cursor);
            cursor = parentOf.get(cursor) ?? null;
          }
          inheritedGameId = parent.gameId ?? null;
        }
        updates.parentId = newParentId;
        updates.gameId = inheritedGameId;
      }

      if (Object.keys(updates).length === 0) return res.json(existing);
      const [row] = await db.update(mediaFolders).set(updates)
        .where(and(eq(mediaFolders.id, id), eq(mediaFolders.teamId, teamId))).returning();
      res.json(row);
    } catch (error: any) {
      console.error('Error in PUT /api/media-folders/:id:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid folder data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/media-folders/:id", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { id } = req.params;
      // Recursively collect every descendant folder so we can purge the
      // whole subtree. mediaItems cascade automatically via their FK, but
      // child folders don't (parentId has no DB-level FK because we add it
      // late and don't want to risk a hard cascade on existing rows).
      const allTeamFolders = await db.select({ id: mediaFolders.id, parentId: mediaFolders.parentId })
        .from(mediaFolders).where(eq(mediaFolders.teamId, teamId));
      const childrenOf = new Map<string, string[]>();
      for (const f of allTeamFolders) {
        const key = f.parentId ?? "__root__";
        if (!childrenOf.has(key)) childrenOf.set(key, []);
        childrenOf.get(key)!.push(f.id);
      }
      const toDelete: string[] = [];
      const seen = new Set<string>();
      const queue = [id];
      // visited guard so a corrupted cycle in legacy data can't loop forever.
      while (queue.length) {
        const cur = queue.shift()!;
        if (seen.has(cur)) continue;
        seen.add(cur);
        toDelete.push(cur);
        for (const child of childrenOf.get(cur) ?? []) queue.push(child);
      }
      const result = await db.delete(mediaFolders)
        .where(and(inArray(mediaFolders.id, toDelete), eq(mediaFolders.teamId, teamId))).returning();
      if (result.length === 0) return res.status(404).json({ error: "Folder not found" });
      res.json({ ok: true, deletedCount: result.length });
    } catch (error: any) {
      console.error('Error in DELETE /api/media-folders/:id:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/media-items", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const data = insertMediaItemSchema.parse(req.body);
      // Verify the folder exists and belongs to this team.
      const [folder] = await db.select().from(mediaFolders)
        .where(and(eq(mediaFolders.id, data.folderId), eq(mediaFolders.teamId, teamId))).limit(1);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const [row] = await db.insert(mediaItems).values({ ...data, teamId }).returning();
      res.json(row);
    } catch (error: any) {
      console.error('Error in POST /api/media-items:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid item data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/media-items/:id", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { id } = req.params;
      const data = insertMediaItemSchema.partial().omit({ folderId: true }).parse(req.body);
      const [row] = await db.update(mediaItems).set(data)
        .where(and(eq(mediaItems.id, id), eq(mediaItems.teamId, teamId))).returning();
      if (!row) return res.status(404).json({ error: "Item not found" });
      res.json(row);
    } catch (error: any) {
      console.error('Error in PUT /api/media-items/:id:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid item data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/media-items/:id", requireAuth, requireOrgRole("super_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { id } = req.params;
      const result = await db.delete(mediaItems)
        .where(and(eq(mediaItems.id, id), eq(mediaItems.teamId, teamId))).returning();
      if (result.length === 0) return res.status(404).json({ error: "Item not found" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error('Error in DELETE /api/media-items/:id:', error);
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
      const map = await storage.addMap(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_map", `Added map "${map.name}"`, "team", undefined, map.gameId, map.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(maps).where(and(eq(maps.id, id), eq(maps.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Map not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertMapSchema.partial().parse(req.body));
      // Cross-game safety: if a new gameModeId is provided, ensure that mode belongs to the same game.
      if (validatedData.gameModeId && validatedData.gameModeId !== existing.gameModeId) {
        const [targetMode] = await db
          .select()
          .from(gameModes)
          .where(and(eq(gameModes.id, validatedData.gameModeId), eq(gameModes.teamId, teamId)))
          .limit(1);
        if (!targetMode) return res.status(400).json({ error: "Target game mode not found" });
        if (targetMode.gameId !== existing.gameId) {
          return res.status(400).json({ error: "Cannot move a map to a game mode in a different game" });
        }
      }
      const map = await storage.updateMap(id, validatedData, existing.gameId, existing.rosterId);
      if (!map) return res.status(404).json({ error: "Map not found" });
      logActivity(req.session.userId!, "edit_map", `Updated map "${map.name}"`, "team", undefined, existing.gameId, existing.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(maps).where(and(eq(maps.id, id), eq(maps.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Map not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeMap(id, existing.gameId, existing.rosterId);
      if (success) {
        logActivity(req.session.userId!, "delete_map", `Deleted map`, "team", undefined, existing.gameId, existing.rosterId);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Map not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/maps:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Sides (per-roster Attack/Defense config) =====
  app.get("/api/sides", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      const rosterId = getRosterId(req);
      let sidesList = await storage.getAllSides(gameId, rosterId);
      // Auto-seed default sides for the roster if none exist and we have a roster scope
      if (sidesList.length === 0 && rosterId) {
        await storage.addSide({ name: "Attack", sortOrder: "0", rosterId }, gameId, rosterId);
        await storage.addSide({ name: "Defense", sortOrder: "1", rosterId }, gameId, rosterId);
        sidesList = await storage.getAllSides(gameId, rosterId);
      }
      sidesList.sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
      res.json(sidesList);
    } catch (error: any) {
      console.error('Error in GET /api/sides:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/sides", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const data = insertSideSchema.parse(req.body);
      const side = await storage.addSide(data, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_side", `Added side "${side.name}"`, "team", undefined, side.gameId, side.rosterId);
      res.json(side);
    } catch (error: any) {
      console.error('Error in POST /api/sides:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid side data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/sides/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(sides).where(and(eq(sides.id, id), eq(sides.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Side not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const data = await sanitizeScopeFields(req, insertSideSchema.partial().parse(req.body));
      const side = await storage.updateSide(id, data, existing.gameId, existing.rosterId);
      if (!side) return res.status(404).json({ error: "Side not found" });
      logActivity(req.session.userId!, "edit_side", `Updated side "${side.name}"`, "team", undefined, existing.gameId, existing.rosterId);
      res.json(side);
    } catch (error: any) {
      console.error('Error in PUT /api/sides:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid side data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.delete("/api/sides/:id", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const [existing] = await db.select().from(sides).where(and(eq(sides.id, id), eq(sides.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Side not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeSide(id, existing.gameId, existing.rosterId);
      if (success) {
        logActivity(req.session.userId!, "delete_side", `Deleted side "${existing.name}"`, "team", undefined, existing.gameId, existing.rosterId);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Side not found" });
      }
    } catch (error: any) {
      console.error('Error in DELETE /api/sides:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // ===== Game Rounds (per-game multi-round score data) =====
  app.get("/api/games/:matchId/rounds", requireAuth, async (req, res) => {
    try {
      const { matchId } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, matchId), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const rounds = await storage.getRoundsForGame(matchId);
      rounds.sort((a, b) => a.roundNumber - b.roundNumber);
      res.json(rounds);
    } catch (error: any) {
      console.error('Error in GET /api/games/:matchId/rounds:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.put("/api/games/:matchId/rounds", requireAuth, requirePermission("edit_events"), async (req, res) => {
    try {
      const { matchId } = req.params;
      const teamId = getTeamId();
      const [game] = await db.select().from(games).where(and(eq(games.id, matchId), eq(games.teamId, teamId))).limit(1);
      if (!game) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, game.gameId, game.rosterId)) return;
      const roundSchema = insertGameRoundSchema.omit({ matchId: true } as any);
      const parsedRounds = z.array(roundSchema).parse(req.body);
      const saved = await storage.replaceRoundsForGame(matchId, parsedRounds as any, game.gameId, game.rosterId);
      logActivity(req.session.userId!, "edit_rounds", `Updated rounds for game`, "team", undefined, game.gameId, game.rosterId);
      res.json(saved);
    } catch (error: any) {
      console.error('Error in PUT /api/games/:matchId/rounds:', error);
      if (error.name === 'ZodError') return res.status(400).json({ error: "Invalid rounds data", details: error.errors });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Object-storage-backed upload so files persist across deploys.
  // Uses in-memory multer + ObjectStorageService.uploadBuffer; returns a
  // stable /objects/uploads/<id>.<ext> URL served by the public objects route.
  const objectUploadMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return cb(new Error(`File type ${ext} is not allowed`));
      }
      cb(null, true);
    },
  });
  app.post("/api/objects/upload", requireAuth, objectUploadMemory.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const ext = path.extname(req.file.originalname).toLowerCase() || "";
      const mime = req.file.mimetype || "application/octet-stream";
      const allowedImageMimes = new Set([
        "image/png", "image/jpeg", "image/jpg", "image/gif",
        "image/webp", "image/bmp", "image/svg+xml",
        "image/x-icon", "image/vnd.microsoft.icon",
      ]);

      // Always go to object storage — returns a short, stable
      // /objects/uploads/<id>.<ext> URL that lives in GCS via the Replit
      // sidecar and survives every redeploy / container restart. We
      // intentionally do NOT fall back to base64-in-the-DB anymore: those
      // payloads were causing 413s on save and brutal lag in the editor.
      // If object storage is unreachable, surface a clean 503 so the user
      // can retry rather than corrupt the row with megabytes of base64.
      try {
        const { ObjectStorageService } = await import("./objectStorage");
        const svc = new ObjectStorageService();
        const url = await svc.uploadBuffer(req.file.buffer, mime, ext);
        return res.json({ url, path: url });
      } catch (osErr: any) {
        console.error('[upload] Object storage failed:',
          { name: osErr?.name, message: osErr?.message, code: osErr?.code });

        // Non-images in dev only: keep local-disk fallback so contributors
        // working offline can still upload e.g. CSVs. Images NEVER fall
        // back to local disk because that disk is wiped on redeploy.
        if (!allowedImageMimes.has(mime) && process.env.NODE_ENV !== "production") {
          const dir = path.join(UPLOAD_DIR, "general");
          fs.mkdirSync(dir, { recursive: true });
          const filename = `${randomUUID()}${ext}`;
          fs.writeFileSync(path.join(dir, filename), req.file.buffer);
          const filePath = `/uploads/general/${filename}`;
          return res.json({ url: filePath, path: filePath });
        }

        return res.status(503).json({
          error: "Image storage is temporarily unavailable. Please try again in a moment.",
        });
      }
    } catch (error: any) {
      console.error('Error in POST /api/objects/upload:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Serve files from object storage. URLs returned by the upload endpoint
  // look like /objects/uploads/<id>.<ext>; this streams them back through
  // ObjectStorageService.downloadObject (handles content-type, length,
  // cache headers).
  app.get("/objects/uploads/:filename", requireAuth, async (req, res) => {
    try {
      const { filename } = req.params;
      if (!filename || filename.includes("/") || filename.includes("..")) {
        return res.status(400).json({ error: "Invalid object path" });
      }
      // Allowlist of MIME types we render inline (images only). Anything
      // else gets forced to attachment to prevent stored-XSS-style abuse
      // via crafted content-type metadata. Always set nosniff so the
      // browser cannot upgrade an arbitrary blob to HTML/JS.
      const INLINE_OK = new Set([
        "image/png", "image/jpeg", "image/jpg", "image/gif",
        "image/webp", "image/bmp", "image/svg+xml",
        "image/x-icon", "image/vnd.microsoft.icon",
      ]);
      const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
      const svc = new ObjectStorageService();
      try {
        const file = await svc.getObjectEntityFile(`/objects/uploads/${filename}`);
        const [meta] = await file.getMetadata();
        const ct = (meta.contentType || "application/octet-stream").toLowerCase();
        res.setHeader("X-Content-Type-Options", "nosniff");
        if (!INLINE_OK.has(ct)) {
          res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`);
        }
        await svc.downloadObject(file, res, 86400);
      } catch (e: any) {
        if (e instanceof ObjectNotFoundError) {
          return res.status(404).json({ error: "Object not found" });
        }
        throw e;
      }
    } catch (error: any) {
      console.error('Error serving /objects/uploads/:filename:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Internal server error" });
      }
    }
  });

  // Seasons API endpoints
  app.get("/api/seasons", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      const seasons = await storage.getAllSeasons(gameId, getRosterId(req));
      res.json(seasons);
    } catch (error: any) {
      console.error('Error in GET /api/seasons:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/seasons", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertSeasonSchema.parse(req.body);
      const season = await storage.addSeason(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_season", `Added season "${season.name}"`, "team", undefined, season.gameId, season.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(seasons).where(and(eq(seasons.id, id), eq(seasons.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Season not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertSeasonSchema.partial().parse(req.body));
      const season = await storage.updateSeason(id, validatedData, existing.gameId, existing.rosterId);
      if (!season) return res.status(404).json({ error: "Season not found" });
      logActivity(req.session.userId!, "edit_season", `Updated season "${season.name}"`, "team", undefined, existing.gameId, existing.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(seasons).where(and(eq(seasons.id, id), eq(seasons.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Season not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeSeason(id, existing.gameId, existing.rosterId);
      if (success) {
        logActivity(req.session.userId!, "delete_season", `Deleted season`, "team", undefined, existing.gameId, existing.rosterId);
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
      const offDays = await storage.getAllOffDays(getGameId(req), getRosterId(req));
      res.json(offDays);
    } catch (error: any) {
      console.error('Error in GET /api/off-days:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/off-days", requireAuth, requirePermission("create_events"), async (req, res) => {
    try {
      const validatedData = insertOffDaySchema.parse(req.body);
      const offDay = await storage.addOffDay(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_off_day", `Added off day on ${offDay.date}`, "team", undefined, offDay.gameId, offDay.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(offDays).where(and(eq(offDays.id, id), eq(offDays.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Off day not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeOffDayById(id);
      if (success) {
        logActivity(req.session.userId!, "remove_off_day", `Removed off day`, "team", undefined, existing.gameId, existing.rosterId);
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
      const success = await storage.removeOffDay(date, getGameId(req), getRosterId(req));
      if (success) {
        logActivity(req.session.userId!, "remove_off_day", `Removed off day on ${date}`, "team", undefined, getGameId(req), getRosterId(req));
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
      const teamId = getTeamId();
      const [sourceEvent] = await db.select().from(events).where(and(eq(events.id, id), eq(events.teamId, teamId))).limit(1);
      if (!sourceEvent) return res.status(404).json({ error: "Event not found" });
      if (!await verifyObjectScope(req, res, sourceEvent.gameId, sourceEvent.rosterId)) return;
      const duplicatedEvent = await storage.duplicateEvent(id, sourceEvent.gameId, sourceEvent.rosterId);
      res.json(duplicatedEvent);
    } catch (error: any) {
      console.error('Error in POST /api/events/:id/duplicate:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/stat-fields", requireAuth, async (req, res) => {
    try {
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ error: "Game context required" });
      const statFields = await storage.getAllStatFields(gameId, getRosterId(req));
      res.json(statFields);
    } catch (error: any) {
      console.error('Error in GET /api/stat-fields:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/stat-fields", requireAuth, requirePermission("manage_game_config"), async (req, res) => {
    try {
      const validatedData = insertStatFieldSchema.parse(req.body);
      const statField = await storage.addStatField(validatedData, getGameId(req), getRosterId(req));
      logActivity(req.session.userId!, "add_stat_field", `Added stat field "${statField.name}"`, "team", undefined, statField.gameId, statField.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(statFieldsTable).where(and(eq(statFieldsTable.id, id), eq(statFieldsTable.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Stat field not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const validatedData = await sanitizeScopeFields(req, insertStatFieldSchema.partial().parse(req.body));
      const statField = await storage.updateStatField(id, validatedData, existing.gameId, existing.rosterId);
      if (!statField) return res.status(404).json({ error: "Stat field not found" });
      logActivity(req.session.userId!, "edit_stat_field", `Updated stat field`, "team", undefined, existing.gameId, existing.rosterId);
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
      const teamId = getTeamId();
      const [existing] = await db.select().from(statFieldsTable).where(and(eq(statFieldsTable.id, id), eq(statFieldsTable.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ error: "Stat field not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const success = await storage.removeStatField(id, existing.gameId, existing.rosterId);
      if (success) {
        logActivity(req.session.userId!, "delete_stat_field", `Deleted stat field`, "team", undefined, existing.gameId, existing.rosterId);
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
      const teamId = getTeamId();
      const [matchGame] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!matchGame) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, matchGame.gameId, matchGame.rosterId)) return;
      const stats = await storage.getPlayerGameStats(id, matchGame.gameId, matchGame.rosterId);
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
      const teamId = getTeamId();
      const [matchGame] = await db.select().from(games).where(and(eq(games.id, id), eq(games.teamId, teamId))).limit(1);
      if (!matchGame) return res.status(404).json({ error: "Game not found" });
      if (!await verifyObjectScope(req, res, matchGame.gameId, matchGame.rosterId)) return;
      const saved = await storage.savePlayerGameStats(id, stats, matchGame.gameId, matchGame.rosterId);
      res.json(saved);
    } catch (error: any) {
      console.error('Error in POST /api/games/:id/player-stats:', error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/player-stats-summary", requireAuth, requirePermission("view_player_stats"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const gid = getGameId(req);
      const rid = getRosterId(req);
      const allPlayers = await storage.getAllPlayers(gid, rid);
      const sfConditions: any[] = [eq(statFieldsTable.teamId, teamId)];
      if (gid) sfConditions.push(eq(statFieldsTable.gameId, gid));
      const allStatFields = await db.select().from(statFieldsTable).where(and(...sfConditions));
      const pgsConditions: any[] = [eq(playerGameStats.teamId, teamId)];
      if (gid) pgsConditions.push(eq(playerGameStats.gameId, gid));
      const allPlayerGameStats = await db.select().from(playerGameStats).where(and(...pgsConditions));
      const allGames = await storage.getAllGamesWithEventType(undefined, gid, rid);
      const allEvents = await storage.getAllEvents(gid, rid);
      const allGameModes = await storage.getAllGameModes(gid, rid);

      const allMaps = await storage.getAllMaps(gid, rid);

      const summary = allPlayers.map(player => {
        const playerStats = allPlayerGameStats.filter(s => s.playerId === player.id);
        const gameIds = Array.from(new Set(playerStats.map(s => s.matchId)));
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

        const opponentStats: Record<string, {
          opponent: string; wins: number; losses: number; draws: number; gamesPlayed: number;
          stats: Record<string, { fieldName: string; total: number; count: number; avg: number }>;
          byMode: Record<string, { modeName: string; wins: number; losses: number; draws: number; gamesPlayed: number; stats: Record<string, { fieldName: string; total: number; count: number; avg: number }> }>;
          byMap: Record<string, { mapName: string; wins: number; losses: number; draws: number; gamesPlayed: number; stats: Record<string, { fieldName: string; total: number; count: number; avg: number }> }>;
          bySubType: Record<string, { subTypeName: string; wins: number; losses: number; draws: number; gamesPlayed: number; stats: Record<string, { fieldName: string; total: number; count: number; avg: number }> }>;
        }> = {};
        for (const gameId of gameIds) {
          const game = allGames.find(g => g.id === gameId);
          if (!game) continue;
          const event = allEvents.find(e => e.id === game.eventId);
          if (!event || !event.opponentName) continue;
          const opp = event.opponentName;
          if (!opponentStats[opp]) {
            opponentStats[opp] = { opponent: opp, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, stats: {}, byMode: {}, byMap: {}, bySubType: {} };
          }
          opponentStats[opp].gamesPlayed++;
          if (game.result === "win") opponentStats[opp].wins++;
          else if (game.result === "loss") opponentStats[opp].losses++;
          else if (game.result === "draw") opponentStats[opp].draws++;

          const modeId = game.gameModeId || "unknown";
          const modeObj = allGameModes.find(m => m.id === modeId);
          const modeName = modeObj?.name || "Unknown";
          if (!opponentStats[opp].byMode[modeId]) {
            opponentStats[opp].byMode[modeId] = { modeName, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, stats: {} };
          }
          opponentStats[opp].byMode[modeId].gamesPlayed++;
          if (game.result === "win") opponentStats[opp].byMode[modeId].wins++;
          else if (game.result === "loss") opponentStats[opp].byMode[modeId].losses++;
          else if (game.result === "draw") opponentStats[opp].byMode[modeId].draws++;

          const mapId = game.mapId || "unknown";
          const mapObj = allMaps.find(m => m.id === mapId);
          const mapName = mapObj?.name || "Unknown";
          if (!opponentStats[opp].byMap[mapId]) {
            opponentStats[opp].byMap[mapId] = { mapName, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, stats: {} };
          }
          opponentStats[opp].byMap[mapId].gamesPlayed++;
          if (game.result === "win") opponentStats[opp].byMap[mapId].wins++;
          else if (game.result === "loss") opponentStats[opp].byMap[mapId].losses++;
          else if (game.result === "draw") opponentStats[opp].byMap[mapId].draws++;

          const subType = event.eventSubType || "Unknown";
          if (!opponentStats[opp].bySubType[subType]) {
            opponentStats[opp].bySubType[subType] = { subTypeName: subType, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, stats: {} };
          }
          opponentStats[opp].bySubType[subType].gamesPlayed++;
          if (game.result === "win") opponentStats[opp].bySubType[subType].wins++;
          else if (game.result === "loss") opponentStats[opp].bySubType[subType].losses++;
          else if (game.result === "draw") opponentStats[opp].bySubType[subType].draws++;

          const gameStats = playerStats.filter(s => s.matchId === gameId);
          for (const gs of gameStats) {
            const field = allStatFields.find(f => f.id === gs.statFieldId);
            if (!field) continue;
            const fname = field.name;
            const val = parseFloat(gs.value) || 0;
            if (!opponentStats[opp].stats[fname]) {
              opponentStats[opp].stats[fname] = { fieldName: fname, total: 0, count: 0, avg: 0 };
            }
            opponentStats[opp].stats[fname].total += val;
            opponentStats[opp].stats[fname].count += 1;

            if (!opponentStats[opp].byMode[modeId].stats[fname]) {
              opponentStats[opp].byMode[modeId].stats[fname] = { fieldName: fname, total: 0, count: 0, avg: 0 };
            }
            opponentStats[opp].byMode[modeId].stats[fname].total += val;
            opponentStats[opp].byMode[modeId].stats[fname].count += 1;

            if (!opponentStats[opp].byMap[mapId].stats[fname]) {
              opponentStats[opp].byMap[mapId].stats[fname] = { fieldName: fname, total: 0, count: 0, avg: 0 };
            }
            opponentStats[opp].byMap[mapId].stats[fname].total += val;
            opponentStats[opp].byMap[mapId].stats[fname].count += 1;

            if (!opponentStats[opp].bySubType[subType].stats[fname]) {
              opponentStats[opp].bySubType[subType].stats[fname] = { fieldName: fname, total: 0, count: 0, avg: 0 };
            }
            opponentStats[opp].bySubType[subType].stats[fname].total += val;
            opponentStats[opp].bySubType[subType].stats[fname].count += 1;
          }
        }
        for (const opp of Object.values(opponentStats)) {
          for (const st of Object.values(opp.stats)) {
            st.avg = st.count > 0 ? Math.round((st.total / st.count) * 100) / 100 : 0;
          }
          for (const mode of Object.values(opp.byMode)) {
            for (const st of Object.values(mode.stats)) {
              st.avg = st.count > 0 ? Math.round((st.total / st.count) * 100) / 100 : 0;
            }
          }
          for (const map of Object.values(opp.byMap)) {
            for (const st of Object.values(map.stats)) {
              st.avg = st.count > 0 ? Math.round((st.total / st.count) * 100) / 100 : 0;
            }
          }
          for (const sub of Object.values(opp.bySubType)) {
            for (const st of Object.values(sub.stats)) {
              st.avg = st.count > 0 ? Math.round((st.total / st.count) * 100) / 100 : 0;
            }
          }
        }

        const statsByMode: Record<string, { modeName: string; stats: { fieldName: string; total: number; count: number; avg: number }[] }> = {};
        for (const stat of playerStats) {
          const field = allStatFields.find(f => f.id === stat.statFieldId);
          if (!field) continue;
          const game = allGames.find(g => g.id === stat.matchId);
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

        const statsByMap: Record<string, { mapName: string; stats: { fieldName: string; total: number; count: number; avg: number }[] }> = {};
        for (const stat of playerStats) {
          const field = allStatFields.find(f => f.id === stat.statFieldId);
          if (!field) continue;
          const game = allGames.find(g => g.id === stat.matchId);
          const mapId = game?.mapId || "unknown";
          const mapObj = allMaps.find(m => m.id === mapId);
          const mapName = mapObj?.name || "Unknown";
          if (!statsByMap[mapId]) {
            statsByMap[mapId] = { mapName, stats: [] };
          }
          let mapStat = statsByMap[mapId].stats.find(s => s.fieldName === field.name);
          if (!mapStat) {
            mapStat = { fieldName: field.name, total: 0, count: 0, avg: 0 };
            statsByMap[mapId].stats.push(mapStat);
          }
          const val = parseFloat(stat.value) || 0;
          mapStat.total += val;
          mapStat.count += 1;
        }
        for (const mapEntry of Object.values(statsByMap)) {
          for (const st of mapEntry.stats) {
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

        const statsBySubType: Record<string, { subTypeName: string; wins: number; losses: number; draws: number; gamesPlayed: number; stats: Record<string, { fieldName: string; total: number; count: number; avg: number }> }> = {};
        for (const gameId of gameIds) {
          const game = allGames.find(g => g.id === gameId);
          if (!game) continue;
          const event = allEvents.find(e => e.id === game.eventId);
          const subType = event?.eventSubType || "Unknown";
          if (!statsBySubType[subType]) {
            statsBySubType[subType] = { subTypeName: subType, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, stats: {} };
          }
          statsBySubType[subType].gamesPlayed++;
          if (game.result === "win") statsBySubType[subType].wins++;
          else if (game.result === "loss") statsBySubType[subType].losses++;
          else if (game.result === "draw") statsBySubType[subType].draws++;

          const gameStats = playerStats.filter(s => s.matchId === gameId);
          for (const gs of gameStats) {
            const field = allStatFields.find(f => f.id === gs.statFieldId);
            if (!field) continue;
            const fname = field.name;
            const val = parseFloat(gs.value) || 0;
            if (!statsBySubType[subType].stats[fname]) {
              statsBySubType[subType].stats[fname] = { fieldName: fname, total: 0, count: 0, avg: 0 };
            }
            statsBySubType[subType].stats[fname].total += val;
            statsBySubType[subType].stats[fname].count += 1;
          }
        }
        for (const sub of Object.values(statsBySubType)) {
          for (const st of Object.values(sub.stats)) {
            st.avg = st.count > 0 ? Math.round((st.total / st.count) * 100) / 100 : 0;
          }
        }

        const opponentsList = Object.values(opponentStats).map(o => ({
          ...o,
          stats: Object.values(o.stats),
          byMode: Object.values(o.byMode).map(m => ({ ...m, stats: Object.values(m.stats) })),
          byMap: Object.values(o.byMap).map(m => ({ ...m, stats: Object.values(m.stats) })),
          bySubType: Object.values(o.bySubType).map(s => ({ ...s, stats: Object.values(s.stats) })),
        }));

        return {
          player: { id: player.id, name: player.name, role: player.role },
          gamesPlayed,
          stats: Object.values(statAggregatesByName),
          statsByMode: Object.values(statsByMode),
          statsByMap: Object.values(statsByMap),
          statsBySubType: Object.values(statsBySubType).map(s => ({ ...s, stats: Object.values(s.stats) })),
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

  // ==================== SUPPORTED GAMES ====================
  app.get("/api/supported-games", async (req, res) => {
    try {
      const teamId = getTeamId();
      const allGamesData = await storage.getSupportedGames();
      const teamRosters = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
      const activeGameIds = new Set(teamRosters.map(r => r.gameId));
      let activeGames = allGamesData.filter(g => activeGameIds.has(g.id));

      const userId = (req.session as any)?.userId;
      if (userId) {
        const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (currentUser && currentUser.orgRole !== "super_admin") {
          const userAssignments = await db.select().from(userGameAssignments)
            .where(and(
              eq(userGameAssignments.teamId, teamId),
              eq(userGameAssignments.userId, userId),
              eq(userGameAssignments.status, "approved"),
            ));
          const allowedGameIds = new Set(userAssignments.map(a => a.gameId));
          activeGames = activeGames.filter(g => allowedGameIds.has(g.id));
        }
      }
      res.json(activeGames);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== USER GAME ASSIGNMENTS ====================
  app.post("/api/game-assignments", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { userId, gameId, rosterId, assignedRole } = req.body;
      if (!userId || !gameId) return res.status(400).json({ message: "userId and gameId required" });

      const existing = await db.select().from(userGameAssignments)
        .where(and(
          eq(userGameAssignments.userId, userId),
          eq(userGameAssignments.gameId, gameId),
          eq(userGameAssignments.teamId, teamId),
          rosterId ? eq(userGameAssignments.rosterId, rosterId) : sql`TRUE`
        ))
        .limit(1);
      if (existing.length > 0) return res.status(400).json({ message: "User already has this game assignment" });

      const [assignment] = await db.insert(userGameAssignments)
        .values({
          teamId,
          userId,
          gameId,
          rosterId: rosterId || null,
          assignedRole: assignedRole || "player",
          status: "approved",
          approvalGameStatus: "approved",
          approvalOrgStatus: "approved",
        })
        .returning();

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user && user.status === "pending") {
        await db.update(users).set({ status: "active" }).where(eq(users.id, userId));
      }

      logActivity(req.session.userId!, "assign_game", `Assigned ${user?.username} to game`, "team", undefined, assignment.gameId, assignment.rosterId);
      res.json(assignment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/game-assignments/:id", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const [deleted] = await db.delete(userGameAssignments)
        .where(eq(userGameAssignments.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Assignment not found" });

      const [user] = await db.select().from(users).where(eq(users.id, deleted.userId)).limit(1);
      logActivity(req.session.userId!, "remove_game_access", `Removed ${user?.username}'s game access`, "team", undefined, deleted.gameId, deleted.rosterId);
      res.json(deleted);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/game-assignments/bulk", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { orgRole, assignments } = req.body;
      if (!orgRole || !Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ message: "orgRole and assignments array required" });
      }
      for (const a of assignments) {
        if (!a.gameId || !a.rosterId) {
          return res.status(400).json({ message: "Each assignment must have gameId and rosterId" });
        }
      }
      const targetUsers = await db.select().from(users)
        .where(and(eq(users.teamId, teamId), eq(users.orgRole, orgRole)));
      console.log(`[bulk-assign] role="${orgRole}" → ${targetUsers.length} target user(s); rosters:`, assignments.map(a => `${a.gameId}/${a.rosterId}`));

      const allRolesArr = await db.select().from(roles).where(eq(roles.teamId, teamId));
      const roleNameForOrgRole = (or: string | null | undefined): string => {
        if (or === "staff" || or === "coach_analyst" || or === "management") return "Staff";
        if (or === "org_admin") return "Management";
        return "Member";
      };
      const assignedRoleForOrgRole = (or: string | null | undefined): string => {
        if (or === "staff" || or === "coach_analyst" || or === "management") return "staff";
        if (or === "org_admin") return "management";
        return "player";
      };

      let created = 0;
      for (const user of targetUsers) {
        const targetRoleName = roleNameForOrgRole(user.orgRole);
        const targetRole = allRolesArr.find(r => r.name === targetRoleName) || allRolesArr.find(r => r.name === "Member");
        const desiredAssignedRole = assignedRoleForOrgRole(user.orgRole);
        for (const { gameId, rosterId } of assignments) {
          const existing = await db.select().from(userGameAssignments)
            .where(and(
              eq(userGameAssignments.userId, user.id),
              eq(userGameAssignments.gameId, gameId),
              eq(userGameAssignments.teamId, teamId),
              rosterId ? eq(userGameAssignments.rosterId, rosterId) : sql`TRUE`
            ))
            .limit(1);
          if (existing.length === 0) {
            await db.insert(userGameAssignments).values({
              teamId,
              userId: user.id,
              gameId,
              rosterId: rosterId || null,
              assignedRole: desiredAssignedRole,
              status: "approved",
              approvalGameStatus: "approved",
              approvalOrgStatus: "approved",
            });
            created++;
          }
        }
        if (targetRole && user.roleId !== targetRole.id) {
          await db.update(users).set({ roleId: targetRole.id }).where(eq(users.id, user.id));
        }
      }
      logActivity(req.session.userId!, "bulk_assign_game", `Bulk assigned ${created} access entries for role ${orgRole}`, "team");
      res.json({ created, users: targetUsers.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/game-assignments/pending", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const gameId = req.query.gameId as string | undefined;
      const rosterId = req.query.rosterId as string | undefined;
      const results = await storage.getAllPendingAssignments(gameId || null, rosterId || null);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/game-assignments/:id/approve-game", requireAuth, requireOrgRole("org_admin", "game_manager"), async (req, res) => {
    try {
      const [existing] = await db.select().from(userGameAssignments).where(eq(userGameAssignments.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Assignment not found" });

      const [updated] = await db.update(userGameAssignments)
        .set({ approvalGameStatus: "approved" })
        .where(eq(userGameAssignments.id, req.params.id))
        .returning();

      const teamId = getTeamId();
      const [user] = await db.select().from(users).where(eq(users.id, updated.userId)).limit(1);
      const [game] = await db.select().from(supportedGames).where(eq(supportedGames.id, updated.gameId)).limit(1);

      if (updated.approvalGameStatus === "approved" && updated.approvalOrgStatus === "approved") {
        await db.update(userGameAssignments).set({ status: "approved" }).where(eq(userGameAssignments.id, updated.id));
        if (user && user.status === "pending") {
          await db.update(users).set({ status: "active" }).where(eq(users.id, user.id));
        }
        await storage.createNotification(teamId, updated.userId, `Your access to ${game?.name || "a game"} has been fully approved!`, "approval", updated.id);
      } else {
        await storage.createNotification(teamId, updated.userId, `Your access to ${game?.name || "a game"} has been approved at the game level. Awaiting org approval.`, "info", updated.id);
      }

      logActivity(req.session.userId!, "approve_assignment_game", `Game-approved ${user?.username}'s access to ${game?.name}`, "team", undefined, updated.gameId, updated.rosterId);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/game-assignments/:id/approve-org", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const [existing] = await db.select().from(userGameAssignments).where(eq(userGameAssignments.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Assignment not found" });

      const [updated] = await db.update(userGameAssignments)
        .set({ approvalOrgStatus: "approved" })
        .where(eq(userGameAssignments.id, req.params.id))
        .returning();

      const teamId = getTeamId();
      const [user] = await db.select().from(users).where(eq(users.id, updated.userId)).limit(1);
      const [game] = await db.select().from(supportedGames).where(eq(supportedGames.id, updated.gameId)).limit(1);

      if (updated.approvalGameStatus === "approved" && updated.approvalOrgStatus === "approved") {
        await db.update(userGameAssignments).set({ status: "approved" }).where(eq(userGameAssignments.id, updated.id));
        if (user && user.status === "pending") {
          await db.update(users).set({ status: "active" }).where(eq(users.id, user.id));
        }
        await storage.createNotification(teamId, updated.userId, `Your access to ${game?.name || "a game"} has been fully approved!`, "approval", updated.id);
      } else {
        await storage.createNotification(teamId, updated.userId, `Your access to ${game?.name || "a game"} has been approved at the org level. Awaiting game-level approval.`, "info", updated.id);
      }

      logActivity(req.session.userId!, "approve_assignment_org", `Org-approved ${user?.username}'s access to ${game?.name}`, "team", undefined, updated.gameId, updated.rosterId);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/game-assignments/:id/approve", requireAuth, requireOrgRole("org_admin", "game_manager"), async (req, res) => {
    try {
      const [updated] = await db.update(userGameAssignments)
        .set({ status: "approved", approvalGameStatus: "approved", approvalOrgStatus: "approved" })
        .where(eq(userGameAssignments.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Assignment not found" });

      const teamId = getTeamId();
      const [user] = await db.select().from(users).where(eq(users.id, updated.userId)).limit(1);
      if (user && user.status === "pending") {
        await db.update(users).set({ status: "active" }).where(eq(users.id, user.id));
      }

      const allRolesArr = await db.select().from(roles).where(eq(roles.teamId, teamId));
      let targetRoleName = "Member";
      if (user?.orgRole === "staff" || user?.orgRole === "coach_analyst") targetRoleName = "Staff";
      else if (user?.orgRole === "management" || user?.orgRole === "org_admin") targetRoleName = "Management";
      const targetRole = allRolesArr.find(r => r.name === targetRoleName) || allRolesArr.find(r => r.name === "Member");
      if (targetRole && user) {
        await db.update(users).set({ roleId: targetRole.id }).where(eq(users.id, user.id));
      }
      const desiredAssignedRole = user?.orgRole === "staff" || user?.orgRole === "coach_analyst" ? "staff"
        : user?.orgRole === "management" || user?.orgRole === "org_admin" ? "management"
        : "player";
      if (updated.assignedRole !== desiredAssignedRole) {
        await db.update(userGameAssignments).set({ assignedRole: desiredAssignedRole }).where(eq(userGameAssignments.id, updated.id));
      }

      const [game] = await db.select().from(supportedGames).where(eq(supportedGames.id, updated.gameId)).limit(1);
      await storage.createNotification(teamId, updated.userId, `Your access to ${game?.name || "a game"} has been approved!`, "approval", updated.id);

      logActivity(req.session.userId!, "approve_assignment", `Approved ${user?.username}'s access to ${game?.name}`, "team", undefined, updated.gameId, updated.rosterId);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/game-assignments/:id/reject", requireAuth, requireOrgRole("org_admin", "game_manager"), async (req, res) => {
    try {
      const assignment = await storage.rejectUserGameAssignment(req.params.id);
      if (!assignment) return res.status(404).json({ message: "Assignment not found" });

      const teamId = getTeamId();
      const [game] = await db.select().from(supportedGames).where(eq(supportedGames.id, assignment.gameId)).limit(1);
      await storage.createNotification(
        teamId,
        assignment.userId,
        `Your request to access ${game?.name || "a game"} was not approved.`,
        "rejection",
        assignment.id
      );

      logActivity(req.session.userId!, "reject_assignment", `Rejected access request for ${game?.name}`, "team", undefined, assignment.gameId, assignment.rosterId);
      res.json(assignment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== NOTIFICATIONS ====================
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifs = await storage.getNotifications(req.session.userId!);
      res.json(notifs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notif = await storage.markNotificationRead(req.params.id, req.session.userId!);
      res.json(notif);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.session.userId!);
      res.json({ message: "All notifications marked as read" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/public-rosters", async (_req, res) => {
    try {
      const teamId = getTeamId();
      const allGamesList = await db.select().from(supportedGames);
      const result: Record<string, any[]> = {};
      for (const game of allGamesList) {
        const gameRosters = await db.select().from(rosters)
          .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, game.id)));
        if (gameRosters.length > 0) {
          result[game.id] = gameRosters.map(r => ({ id: r.id, name: r.name, slug: r.slug, customName: r.customName }));
        }
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ALL ROSTERS (for home page) ====================
  app.get("/api/all-rosters", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
      const isAdmin = currentUser && (currentUser.orgRole === "super_admin" || currentUser.orgRole === "org_admin");

      type AssignmentScope = { gameId: string; rosterId: string | null };
      let scopedAssignments: AssignmentScope[] | null = null;
      if (!isAdmin) {
        const assignments = await db.select().from(userGameAssignments)
          .where(and(eq(userGameAssignments.userId, userId), eq(userGameAssignments.status, "approved"), eq(userGameAssignments.teamId, teamId)));
        scopedAssignments = assignments.map(a => ({ gameId: a.gameId, rosterId: a.rosterId }));
      }

      const allGamesList = await db.select().from(supportedGames);
      const result: Record<string, any[]> = {};

      for (const game of allGamesList) {
        if (scopedAssignments !== null) {
          const gameAssignments = scopedAssignments.filter(a => a.gameId === game.id);
          if (gameAssignments.length === 0) continue;
          const hasGameWideAccess = gameAssignments.some(a => a.rosterId === null);
          if (hasGameWideAccess) {
            const gameRosters = await db.select().from(rosters)
              .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, game.id)))
              .orderBy(rosters.sortOrder);
            result[game.id] = gameRosters;
          } else {
            const allowedRosterIds = gameAssignments.map(a => a.rosterId!).filter(Boolean);
            const gameRosters = await db.select().from(rosters)
              .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, game.id)))
              .orderBy(rosters.sortOrder);
            result[game.id] = gameRosters.filter(r => allowedRosterIds.includes(r.id));
          }
        } else {
          const gameRosters = await db.select().from(rosters)
            .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, game.id)))
            .orderBy(rosters.sortOrder);
          result[game.id] = gameRosters;
        }
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/all-event-categories", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
      const isAdmin = currentUser && (currentUser.orgRole === "super_admin" || currentUser.orgRole === "org_admin");
      if (isAdmin) {
        const cats = await db.select().from(eventCategories).where(eq(eventCategories.teamId, teamId));
        return res.json(cats);
      }
      const assignments = await db.select().from(userGameAssignments)
        .where(and(eq(userGameAssignments.userId, userId), eq(userGameAssignments.status, "approved"), eq(userGameAssignments.teamId, teamId)));
      if (assignments.length === 0) return res.json([]);
      const conditions = assignments.map(a => {
        const conds: any[] = [eq(eventCategories.gameId, a.gameId)];
        if (a.rosterId) conds.push(or(isNull(eventCategories.rosterId), eq(eventCategories.rosterId, a.rosterId)));
        return and(...conds);
      });
      const cats = await db.select().from(eventCategories).where(and(eq(eventCategories.teamId, teamId), or(...conditions)));
      res.json(cats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/all-event-sub-types", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
      const isAdmin = currentUser && (currentUser.orgRole === "super_admin" || currentUser.orgRole === "org_admin");
      if (isAdmin) {
        const subs = await db.select().from(eventSubTypes).where(eq(eventSubTypes.teamId, teamId));
        return res.json(subs);
      }
      const assignments = await db.select().from(userGameAssignments)
        .where(and(eq(userGameAssignments.userId, userId), eq(userGameAssignments.status, "approved"), eq(userGameAssignments.teamId, teamId)));
      if (assignments.length === 0) return res.json([]);
      const conditions = assignments.map(a => {
        const conds: any[] = [eq(eventSubTypes.gameId, a.gameId)];
        if (a.rosterId) conds.push(or(isNull(eventSubTypes.rosterId), eq(eventSubTypes.rosterId, a.rosterId)));
        return and(...conds);
      });
      const subs = await db.select().from(eventSubTypes).where(and(eq(eventSubTypes.teamId, teamId), or(...conditions)));
      res.json(subs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/all-events", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.teamId, teamId))).limit(1);
      const isAdmin = currentUser && (currentUser.orgRole === "super_admin" || currentUser.orgRole === "org_admin");

      type AssignmentScope = { gameId: string; rosterId: string | null };
      let scopedAssignments: AssignmentScope[] | null = null;
      if (!isAdmin) {
        const assignments = await db.select().from(userGameAssignments)
          .where(and(eq(userGameAssignments.userId, userId), eq(userGameAssignments.status, "approved"), eq(userGameAssignments.teamId, teamId)));
        scopedAssignments = assignments.map(a => ({ gameId: a.gameId, rosterId: a.rosterId }));
      }

      const allGamesList = await db.select().from(supportedGames);
      const allRostersRows = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
      let allEvents = await db.select().from(events).where(eq(events.teamId, teamId));
      if (scopedAssignments !== null) {
        allEvents = allEvents.filter(e => {
          if (!e.gameId) return false;
          const gameAssignments = scopedAssignments!.filter(a => a.gameId === e.gameId);
          if (gameAssignments.length === 0) return false;
          const hasGameWideAccess = gameAssignments.some(a => a.rosterId === null);
          if (hasGameWideAccess) return true;
          if (!e.rosterId) return false;
          return gameAssignments.some(a => a.rosterId === e.rosterId);
        });
      }
      const enriched = allEvents.map(e => {
        const game = allGamesList.find(g => g.id === e.gameId);
        const roster = allRostersRows.find(r => r.id === e.rosterId);
        return {
          ...e,
          gameName: game?.name || "Unknown",
          gameSlug: game?.slug || "",
          rosterName: roster?.name || "",
        };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ROSTERS ====================
  app.get("/api/rosters", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ message: "gameId required" });

      let allRosters = await db.select().from(rosters)
        .where(and(eq(rosters.teamId, teamId), eq(rosters.gameId, gameId)))
        .orderBy(rosters.sortOrder);

      const userId = (req.session as any)?.userId;
      if (userId) {
        const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (currentUser && currentUser.orgRole !== "super_admin") {
          const userAssignments = await db.select().from(userGameAssignments)
            .where(and(
              eq(userGameAssignments.teamId, teamId),
              eq(userGameAssignments.userId, userId),
              eq(userGameAssignments.gameId, gameId),
              eq(userGameAssignments.status, "approved"),
            ));
          const allowedRosterIds = new Set(userAssignments.map(a => a.rosterId).filter(Boolean) as string[]);
          allRosters = allRosters.filter(r => allowedRosterIds.has(r.id));
        }
      }

      res.json(allRosters);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/rosters", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const gameId = getGameId(req);
      if (!gameId) return res.status(400).json({ message: "gameId required" });

      const { name, slug } = req.body;
      if (!name || !slug) return res.status(400).json({ message: "name and slug are required" });

      const [roster] = await db.insert(rosters)
        .values({ teamId, gameId, name, slug: slug.toLowerCase().replace(/\s+/g, '-'), code: generateRosterCode() })
        .returning();
      res.json(roster);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/rosters/:id", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const { name, customName } = req.body;
      const updates: any = {};
      if (typeof name === "string") updates.name = name;
      if (customName !== undefined) updates.customName = customName === null || customName === "" ? null : String(customName);
      if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No fields to update" });
      const [updated] = await db.update(rosters)
        .set(updates)
        .where(and(eq(rosters.id, req.params.id), eq(rosters.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Roster not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/rosters/:id", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const [deleted] = await db.delete(rosters)
        .where(eq(rosters.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Roster not found" });
      res.json({ message: "Roster deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ORG DASHBOARD ====================
  app.get("/api/org-dashboard", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const allSupportedGames = await storage.getSupportedGames();
      const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
      const allAssignments = await db.select().from(userGameAssignments).where(eq(userGameAssignments.teamId, teamId));
      const allRostersRows = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
      const pendingAssignments = await storage.getAllPendingAssignments();

      const rosterSummaries = [];
      for (const game of allSupportedGames) {
        const gameRosters = allRostersRows.filter(r => r.gameId === game.id);
        const gameEvents = await db.select().from(events).where(and(eq(events.teamId, teamId), eq(events.gameId, game.id)));
        const gameAttendance = await db.select().from(attendance).where(and(eq(attendance.teamId, teamId), eq(attendance.gameId, game.id)));
        const gamePlayers = await db.select().from(players).where(and(eq(players.teamId, teamId), eq(players.gameId, game.id)));

        for (const roster of gameRosters) {
          const rosterAttendance = gameAttendance.filter(a => a.rosterId === roster.id);
          const rosterEvents = gameEvents.filter(e => e.rosterId === roster.id);
          const rosterPlayers = gamePlayers.filter(p => p.rosterId === roster.id);
          const rosterAssignments = allAssignments.filter(a => a.gameId === game.id && a.rosterId === roster.id && a.status === "approved");

          const attended = rosterAttendance.filter(a => a.status === "attended").length;
          const late = rosterAttendance.filter(a => a.status === "late").length;
          const absent = rosterAttendance.filter(a => a.status === "absent").length;

          const now = new Date().toISOString().split("T")[0];
          const pastEvents = rosterEvents.filter(e => e.date && e.date <= now).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          const upcomingEvents = rosterEvents.filter(e => e.date && e.date > now).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

          const recentResults = pastEvents.slice(0, 3).map(e => ({ title: e.title, result: e.result, date: e.date }));
          const nextEvents = upcomingEvents.slice(0, 3).map(e => ({ title: e.title, date: e.date, time: e.time }));

          const members = rosterPlayers.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
          }));

          rosterSummaries.push({
            gameId: game.id,
            gameName: game.name,
            gameSlug: game.slug,
            rosterId: roster.id,
            rosterName: roster.name,
            rosterSlug: roster.slug,
            attendance: { attended, late, absent },
            recentResults,
            nextEvents,
            memberCount: rosterAssignments.length + rosterPlayers.length,
            members,
          });
        }
      }

      const usersWithRoles = allUsers.map(u => {
        const { passwordHash, ...safe } = u;
        return {
          ...safe,
          games: allAssignments.filter(a => a.userId === u.id && a.status === "approved"),
        };
      });

      res.json({
        rosterSummaries,
        users: usersWithRoles,
        pendingRegistrations: pendingAssignments,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ORG-LEVEL MANAGEMENT CHAT (no gameId) ====================
  async function ensureOrgDefaultChannel(teamId: string) {
    let [channel] = await db.select().from(chatChannels)
      .where(and(eq(chatChannels.teamId, teamId), isNull(chatChannels.gameId), isNull(chatChannels.rosterId), eq(chatChannels.name, "Management")))
      .limit(1);
    if (!channel) {
      [channel] = await db.insert(chatChannels).values({ teamId, gameId: null, rosterId: null, name: "Management" }).returning();
    }
    return channel;
  }

  app.get("/api/org-chat/channels", requireAuth, requirePermission("view_chat"), async (req, res) => {
    try {
      const teamId = getTeamId();
      await ensureOrgDefaultChannel(teamId);
      const list = await db.select().from(chatChannels)
        .where(and(eq(chatChannels.teamId, teamId), isNull(chatChannels.gameId), isNull(chatChannels.rosterId)))
        .orderBy(chatChannels.name);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/org-chat/channels", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const orgRole = currentUser?.orgRole || "";
      if (orgRole !== "super_admin" && orgRole !== "org_admin") {
        return res.status(403).json({ message: "Only Admin or Super Admin can create channels" });
      }
      const name = (req.body?.name || "").trim();
      if (!name) return res.status(400).json({ message: "Channel name is required" });
      const [channel] = await db.insert(chatChannels).values({ teamId, name, gameId: null, rosterId: null }).returning();
      res.json(channel);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/org-chat/channels/:id", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const orgRole = currentUser?.orgRole || "";
      if (orgRole !== "super_admin" && orgRole !== "org_admin") {
        return res.status(403).json({ message: "Only Admin or Super Admin can rename channels" });
      }
      const { id } = req.params;
      const name = (req.body?.name || "").trim();
      if (!name) return res.status(400).json({ message: "Channel name is required" });
      const [updated] = await db.update(chatChannels)
        .set({ name })
        .where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId), isNull(chatChannels.gameId), isNull(chatChannels.rosterId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Channel not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/org-chat/channels/:id", requireAuth, async (req, res) => {
    try {
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const orgRole = currentUser?.orgRole || "";
      if (orgRole !== "super_admin" && orgRole !== "org_admin") {
        return res.status(403).json({ message: "Only Admin or Super Admin can delete channels" });
      }
      const { id } = req.params;
      const [existing] = await db.select().from(chatChannels)
        .where(and(eq(chatChannels.id, id), eq(chatChannels.teamId, teamId), isNull(chatChannels.gameId), isNull(chatChannels.rosterId)))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Channel not found" });
      if (existing.name === "Management") {
        return res.status(400).json({ message: "Cannot delete the default Management channel" });
      }
      await db.delete(chatChannels).where(eq(chatChannels.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/org-chat/messages", requireAuth, requirePermission("view_chat"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const requestedChannelId = (req.query.channelId as string | undefined) || undefined;
      let channel: typeof chatChannels.$inferSelect | undefined;
      if (requestedChannelId) {
        [channel] = await db.select().from(chatChannels)
          .where(and(eq(chatChannels.id, requestedChannelId), eq(chatChannels.teamId, teamId), isNull(chatChannels.gameId), isNull(chatChannels.rosterId)))
          .limit(1);
      }
      if (!channel) {
        channel = await ensureOrgDefaultChannel(teamId);
      }
      const msgs = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.teamId, teamId), eq(chatMessages.channelId, channel.id)))
        .orderBy(chatMessages.createdAt)
        .limit(200);
      const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
      const enriched = msgs.map(m => {
        const sender = allUsers.find(u => u.id === m.userId);
        return { ...m, senderName: sender?.username || "Unknown" };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/org-chat/messages", requireAuth, requirePermission("send_messages"), uploadChat.single("file"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const content = req.body.content || req.body.message || "";
      const requestedChannelId = (req.body.channelId as string | undefined) || (req.query.channelId as string | undefined) || undefined;
      let channel: typeof chatChannels.$inferSelect | undefined;
      if (requestedChannelId) {
        [channel] = await db.select().from(chatChannels)
          .where(and(eq(chatChannels.id, requestedChannelId), eq(chatChannels.teamId, teamId), isNull(chatChannels.gameId), isNull(chatChannels.rosterId)))
          .limit(1);
      }
      if (!channel) {
        channel = await ensureOrgDefaultChannel(teamId);
      }

      let attachmentUrl: string | null = null;
      let attachmentType: string | null = null;
      let attachmentName: string | null = null;
      let attachmentSize: number | null = null;

      if (req.file) {
        attachmentUrl = `/uploads/chat/${req.file.filename}`;
        attachmentType = req.file.mimetype;
        attachmentName = req.file.originalname;
        attachmentSize = req.file.size;
      }

      if (!content.trim() && !attachmentUrl) {
        return res.status(400).json({ message: "Message content or file required" });
      }

      const [msg] = await db.insert(chatMessages).values({
        teamId, gameId: null, channelId: channel.id,
        userId: req.session.userId!,
        message: content.trim() || null,
        attachmentUrl, attachmentType, attachmentName, attachmentSize,
      }).returning();
      const [sender] = await db.select().from(users).where(eq(users.id, req.session.userId!));
      res.json({ ...msg, senderName: sender?.username || "Unknown" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/org-chat/messages/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      const userId = req.session.userId!;
      const [msg] = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.id, id), eq(chatMessages.teamId, teamId)))
        .limit(1);
      if (!msg) return res.status(404).json({ message: "Message not found" });

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const orgRole = currentUser?.orgRole || "";
      const isAdmin = orgRole === "super_admin" || orgRole === "org_admin";
      const isOwnMessage = msg.userId === userId;

      if (!isAdmin && !isOwnMessage) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      await db.delete(chatMessages).where(and(eq(chatMessages.id, id), eq(chatMessages.teamId, teamId)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ORG SETTINGS (no gameId) ====================
  app.get("/api/org-setting/:key", requireAuth, async (req, res) => {
    try {
      const { key } = req.params;
      const value = await storage.getSetting(key, null);
      res.json(value);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/org-setting/:key", requireAuth, requirePermission("manage_settings"), async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      if (typeof value !== "string") return res.status(400).json({ message: "value must be a string" });
      const setting = await storage.setSetting(key, value, null);
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== STAFF USER LINKING ====================
  app.put("/api/staff/:id/link-user", requireAuth, requirePermission("manage_staff"), async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const teamId = getTeamId();
      const [existing] = await db.select().from(staffTable).where(and(eq(staffTable.id, id), eq(staffTable.teamId, teamId))).limit(1);
      if (!existing) return res.status(404).json({ message: "Staff not found" });
      if (!await verifyObjectScope(req, res, existing.gameId, existing.rosterId)) return;
      const [updated] = await db
        .update(staffTable)
        .set({ userId: userId || null })
        .where(and(eq(staffTable.id, id), eq(staffTable.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Staff not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== USER MANAGEMENT ====================
  app.post("/api/users/:id/approve", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.update(users).set({ status: "active" }).where(and(eq(users.id, id), eq(users.teamId, teamId)));
      await db.update(userGameAssignments)
        .set({ status: "approved", approvalGameStatus: "approved", approvalOrgStatus: "approved" })
        .where(and(eq(userGameAssignments.userId, id), eq(userGameAssignments.teamId, teamId), eq(userGameAssignments.status, "pending")));

      const [user] = await db.select().from(users).where(and(eq(users.id, id), eq(users.teamId, teamId))).limit(1);
      if (user) {
        const allRolesArr = await db.select().from(roles).where(eq(roles.teamId, teamId));
        const assignments = await db.select().from(userGameAssignments).where(and(eq(userGameAssignments.userId, id), eq(userGameAssignments.teamId, teamId)));
        const assignedRole = assignments[0]?.assignedRole || "player";
        let targetRoleName = "Member";
        if (assignedRole === "coach_analyst" || assignedRole === "staff") targetRoleName = "Staff";
        else if (assignedRole === "org_admin" || assignedRole === "management") targetRoleName = "Management";
        const targetRole = allRolesArr.find(r => r.name === targetRoleName) || allRolesArr.find(r => r.name === "Member");
        if (targetRole) {
          await db.update(users).set({ roleId: targetRole.id }).where(eq(users.id, id));
        }
      }

      logActivity(req.session.userId!, "approve_user", `Approved user ${user?.username}`, "team", undefined, getGameId(req), getRosterId(req));
      res.json({ message: "User approved" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/org-users", requireAuth, requirePermission("view_users_tab"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
      const allAssignments = await db.select().from(userGameAssignments).where(eq(userGameAssignments.teamId, teamId));
      const safeUsers = allUsers.map(u => {
        const { passwordHash, ...safe } = u;
        return { ...safe, games: allAssignments.filter(a => a.userId === u.id) };
      });
      res.json(safeUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/users/:id/org-role", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { orgRole } = req.body;
      const teamId = getTeamId();
      const validRoles = ["member", "player", "staff", "coach_analyst", "management", "game_manager", "org_admin"];
      if (!validRoles.includes(orgRole)) return res.status(400).json({ message: "Invalid role" });
      await db.update(users).set({ orgRole }).where(and(eq(users.id, id), eq(users.teamId, teamId)));
      logActivity(req.session.userId!, "change_org_role", `Changed user role to ${orgRole}`, "team", undefined, getGameId(req), getRosterId(req));
      res.json({ message: "Role updated" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/org-activity-logs", requireAuth, requirePermission("view_activity_log"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const logs = await db.select().from(activityLogs)
        .where(and(eq(activityLogs.teamId, teamId), isNull(activityLogs.gameId)))
        .orderBy(activityLogs.createdAt)
        .limit(100);
      res.json(logs.reverse());
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== FORGOT PASSWORD REQUESTS ====================
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ message: "Username is required" });
      const teamId = getTeamId();
      const [user] = await db.select().from(users)
        .where(and(ilike(users.username, username), eq(users.teamId, teamId)))
        .limit(1);
      if (!user) return res.status(404).json({ message: "Username not found" });
      await db.execute(sql`INSERT INTO password_reset_requests (team_id, username) VALUES (${teamId}, ${user.username})`);
      res.json({ message: "Password reset request submitted. An admin will review it." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/password-reset-requests", requireAuth, requirePermission("view_dashboard"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const requests = await db.execute(sql`SELECT * FROM password_reset_requests WHERE team_id = ${teamId} ORDER BY created_at DESC LIMIT 50`);
      res.json(requests.rows || []);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/password-reset-requests/:id/resolve", requireAuth, requirePermission("manage_users"), async (req, res) => {
    try {
      const { id } = req.params;
      const teamId = getTeamId();
      await db.execute(sql`UPDATE password_reset_requests SET status = 'resolved', resolved_at = NOW(), resolved_by = ${req.session.userId} WHERE id = ${id} AND team_id = ${teamId}`);
      res.json({ message: "Request marked as resolved" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== GAME MANAGEMENT ====================
  app.post("/api/supported-games", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const { name, slug, abbreviation } = req.body;
      if (!name || !slug) return res.status(400).json({ message: "Name and slug are required" });
      const [game] = await db.insert(supportedGames)
        .values({ name, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'), sortOrder: 999 })
        .returning();
      const teamId = getTeamId();
      const defaultRosters = [
        { name: "Team 1", slug: "team-1", sortOrder: 0 },
        { name: "Team 2", slug: "team-2", sortOrder: 1 },
        { name: "Team 3", slug: "team-3", sortOrder: 2 },
        { name: "Team 4", slug: "team-4", sortOrder: 3 },
      ];
      for (const r of defaultRosters) {
        await db.insert(rosters).values({ teamId, gameId: game.id, name: r.name, slug: r.slug, sortOrder: r.sortOrder, code: generateRosterCode() });
      }
      logActivity(req.session.userId!, "add_game", `Added game "${name}"`, "system");
      res.json(game);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/supported-games/:id", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const { name, slug, abbreviation, iconUrl } = req.body;
      const updates: any = {};
      if (name) updates.name = name;
      if (slug) updates.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (iconUrl !== undefined) updates.iconUrl = iconUrl;
      const [updated] = await db.update(supportedGames)
        .set(updates)
        .where(eq(supportedGames.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Game not found" });
      logActivity(req.session.userId!, "edit_game", `Edited game "${updated.name}"`, "system");
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/supported-games/:id/icon", requireAuth, requireOrgRole("org_admin"), uploadGameIcon.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const filePath = `/uploads/game-icons/${req.file.filename}`;
      const [updated] = await db.update(supportedGames)
        .set({ iconUrl: filePath })
        .where(eq(supportedGames.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Game not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/supported-games/:id", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const [deleted] = await db.delete(supportedGames)
        .where(eq(supportedGames.id, req.params.id))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Game not found" });
      logActivity(req.session.userId!, "delete_game", `Deleted game "${deleted.name}"`, "system");
      res.json({ message: "Game deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Roster management
  app.post("/api/supported-games/:gameId/rosters", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const { name, slug } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const teamId = getTeamId();
      const rosterSlug = (slug || name).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const [roster] = await db.insert(rosters)
        .values({ teamId, gameId: req.params.gameId, name, slug: rosterSlug, sortOrder: 99, code: generateRosterCode() })
        .returning();
      res.json(roster);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/rosters/:id/rename", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const teamId = getTeamId();
      const [updated] = await db.update(rosters)
        .set({ name })
        .where(and(eq(rosters.id, req.params.id), eq(rosters.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Roster not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/rosters/:id", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const [deleted] = await db.delete(rosters)
        .where(and(eq(rosters.id, req.params.id), eq(rosters.teamId, teamId)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Roster not found" });
      res.json({ message: "Roster deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== PLATFORM ROLE MANAGEMENT ====================
  app.get("/api/platform-roles", requireAuth, requirePermission("view_roles_tab"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const allRoles = await db.select().from(roles).where(and(eq(roles.teamId, teamId), isNull(roles.gameId)));
      res.json(allRoles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platform-roles", requireAuth, requirePermission("manage_roles"), async (req, res) => {
    try {
      const { name, permissions: perms } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const teamId = getTeamId();
      const [role] = await db.insert(roles)
        .values({ teamId, name, isSystem: false, permissions: perms || [] })
        .returning();
      logActivity(req.session.userId!, "create_role", `Created role "${name}"`, "system");
      res.json(role);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/platform-roles/:id", requireAuth, requirePermission("manage_roles"), async (req, res) => {
    try {
      const { name, permissions: perms } = req.body;
      const teamId = getTeamId();
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (perms !== undefined) updates.permissions = perms;
      const [updated] = await db.update(roles)
        .set(updates)
        .where(and(eq(roles.id, req.params.id), eq(roles.teamId, teamId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Role not found" });
      logActivity(req.session.userId!, "edit_role", `Updated role "${updated.name}"`, "system");
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/platform-roles/:id", requireAuth, requirePermission("manage_roles"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const [role] = await db.select().from(roles)
        .where(and(eq(roles.id, req.params.id), eq(roles.teamId, teamId)))
        .limit(1);
      if (!role) return res.status(404).json({ message: "Role not found" });
      if (role.isSystem) return res.status(400).json({ message: "Cannot delete system roles" });
      await db.delete(roles).where(eq(roles.id, req.params.id));
      logActivity(req.session.userId!, "delete_role", `Deleted role "${role.name}"`, "system");
      res.json({ message: "Role deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== ALL USERS (admin) ====================
  app.get("/api/all-users", requireAuth, requireOrgRole("org_admin"), async (req, res) => {
    try {
      const teamId = getTeamId();
      const allUsers = await db.select().from(users).where(eq(users.teamId, teamId));
      const allRolesArr = await db.select().from(roles).where(eq(roles.teamId, teamId));
      const allAssignments = await db.select().from(userGameAssignments).where(eq(userGameAssignments.teamId, teamId));
      const allGames = await db.select().from(supportedGames);
      const allRosters = await db.select().from(rosters).where(eq(rosters.teamId, teamId));
      const result = allUsers.map(u => ({
        ...u,
        passwordHash: undefined,
        role: allRolesArr.find(r => r.id === u.roleId) || null,
        gameAssignments: allAssignments.filter(a => a.userId === u.id).map(a => ({
          ...a,
          gameName: allGames.find(g => g.id === a.gameId)?.name || "Unknown",
          rosterName: allRosters.find(r => r.id === a.rosterId)?.name || null,
        })),
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
