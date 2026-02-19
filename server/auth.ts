import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { eq, and } from "drizzle-orm";
import { db, pool } from "./db";
import { getTeamId } from "./storage";
import { roles, users, allPermissions } from "@shared/schema";
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

export async function bootstrapDefaultAdmin() {
  const teamId = getTeamId();

  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.teamId, teamId))
    .limit(1);

  if (existingUsers.length > 0) {
    return;
  }

  const ownerPermissions = [...allPermissions];
  const adminPermissions = allPermissions.filter(
    (p) => p !== "manage_roles"
  );
  const memberPermissions = [
    "view_schedule",
    "edit_own_availability",
    "access_chat",
    "view_stats",
  ];

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

  const passwordHash = bcrypt.hashSync("Admin", 10);

  await db.insert(users).values({
    teamId,
    username: "Admin",
    passwordHash,
    roleId: ownerRole.id,
    status: "active",
  });

  console.log("Default admin user created (username: Admin, password: Admin)");
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
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

    if (!user || !user.roleId) {
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
