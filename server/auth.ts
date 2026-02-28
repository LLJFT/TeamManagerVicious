import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { eq, and, sql } from "drizzle-orm";
import { db, pool } from "./db";
import { getTeamId } from "./storage";
import { roles, users, allPermissions, supportedGames, userGameAssignments, SUPPORTED_GAMES_LIST, type Permission } from "@shared/schema";
import type { Express, Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  app.use(
    session({
      store: new PgStore({
        pool: pool as any,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "default-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );
}

async function seedSupportedGames() {
  const existing = await db.select().from(supportedGames);
  const existingSlugs = new Set(existing.map(g => g.slug));

  for (const game of SUPPORTED_GAMES_LIST) {
    if (!existingSlugs.has(game.slug)) {
      await db.insert(supportedGames)
        .values({ slug: game.slug, name: game.name, sortOrder: game.sortOrder })
        .onConflictDoNothing();
    }
  }
  if (existing.length === 0) console.log("Supported games seeded");
}

async function runMigrations() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rosters (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR,
        game_id VARCHAR NOT NULL REFERENCES supported_games(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      )
    `);
    await db.execute(sql`ALTER TABLE user_game_assignments ADD COLUMN IF NOT EXISTS roster_id VARCHAR REFERENCES rosters(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE user_game_assignments ADD COLUMN IF NOT EXISTS approval_game_status TEXT NOT NULL DEFAULT 'pending'`);
    await db.execute(sql`ALTER TABLE user_game_assignments ADD COLUMN IF NOT EXISTS approval_org_status TEXT NOT NULL DEFAULT 'pending'`);
    await db.execute(sql`UPDATE user_game_assignments SET approval_game_status = 'approved', approval_org_status = 'approved' WHERE status = 'approved' AND approval_game_status = 'pending'`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`);
    console.log("[migrations] Schema migrations applied successfully");
  } catch (e: any) {
    console.error("[migrations] Migration error:", e.message);
  }
}

export async function bootstrapDefaultAdmin() {
  const teamId = getTeamId();

  await runMigrations();
  await seedSupportedGames();

  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.teamId, teamId))
    .limit(1);

  if (existingUsers.length > 0) {
    return;
  }

  const ownerPermissions = [...allPermissions] as Permission[];
  const adminPermissions = allPermissions.filter(
    (p) => p !== "manage_roles"
  ) as Permission[];
  const memberPermissions: Permission[] = [];

  const [ownerRole] = await db
    .insert(roles)
    .values({
      teamId,
      name: "Owner",
      isSystem: true,
      permissions: ownerPermissions,
    })
    .returning();

  await db.insert(roles).values({
    teamId,
    name: "Admin",
    isSystem: true,
    permissions: adminPermissions,
  });

  await db.insert(roles).values({
    teamId,
    name: "Member",
    isSystem: true,
    permissions: memberPermissions,
  });

  const passwordHash = bcrypt.hashSync("admin", 10);

  const [adminUser] = await db.insert(users).values({
    teamId,
    username: "Admin",
    passwordHash,
    roleId: ownerRole.id,
    orgRole: "super_admin",
    status: "active",
  }).returning();

  const allGames = await db.select().from(supportedGames);
  for (const game of allGames) {
    await db.insert(userGameAssignments).values({
      teamId,
      userId: adminUser.id,
      gameId: game.id,
      assignedRole: "super_admin",
      status: "approved",
    });
  }

  console.log("Default admin user created (username: Admin, password: Admin)");
}

export function parseUserAgent(ua: string): string {
  let os = "Unknown";
  let browser = "Unknown";

  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac OS/i.test(ua)) os = "Mac";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";

  return `${os} — ${browser}`;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const teamId = getTeamId();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, req.session.userId), eq(users.teamId, teamId)))
    .limit(1);

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (user.status === "banned") {
    req.session.destroy(() => {});
    return res.status(403).json({ message: "Your account has been banned" });
  }

  if (user.status === "pending") {
    return res.status(403).json({ message: "Your account is pending approval" });
  }

  const userAgent = req.headers["user-agent"] || "";
  const deviceInfo = parseUserAgent(userAgent);
  db.update(users)
    .set({ lastSeen: new Date().toISOString(), lastUserAgent: deviceInfo })
    .where(eq(users.id, user.id))
    .then(() => {})
    .catch(() => {});

  next();
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const teamId = getTeamId();
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.session.userId), eq(users.teamId, teamId)))
      .limit(1);

    if (!user) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (user.orgRole === "super_admin" || user.orgRole === "org_admin") {
      return next();
    }

    if (!user.roleId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, user.roleId), eq(roles.teamId, teamId)))
      .limit(1);

    if (!role) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (role.name === "Owner") {
      return next();
    }

    const permissions = role.permissions as string[];
    if (!permissions.includes(permission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

export function requireOrgRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const teamId = getTeamId();
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.session.userId), eq(users.teamId, teamId)))
      .limit(1);

    if (!user) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (user.orgRole === "super_admin") {
      return next();
    }

    if (!allowedRoles.includes(user.orgRole || "")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

export async function requireGameAccess(req: Request, res: Response, next: NextFunction) {
  const gameId = (req.query.gameId as string) || null;
  if (!gameId || !req.session.userId) {
    return next();
  }

  const teamId = getTeamId();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, req.session.userId), eq(users.teamId, teamId)))
    .limit(1);

  if (!user) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (user.orgRole === "super_admin" || user.orgRole === "org_admin") {
    return next();
  }

  const [assignment] = await db.select().from(userGameAssignments)
    .where(and(
      eq(userGameAssignments.userId, user.id),
      eq(userGameAssignments.gameId, gameId),
      eq(userGameAssignments.status, "approved"),
      eq(userGameAssignments.teamId, teamId)
    ))
    .limit(1);

  if (!assignment) {
    return res.status(403).json({ message: "You do not have access to this game" });
  }

  next();
}
