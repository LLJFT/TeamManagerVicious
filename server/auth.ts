import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { eq, and } from "drizzle-orm";
import { db, pool } from "./db";
import { getTeamId } from "./storage";
import { roles, users, allPermissions, availabilitySlots, rosterRoles, chatChannels, type Permission } from "@shared/schema";
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

async function seedDefaults(teamId: string) {
  const existingSlots = await db.select().from(availabilitySlots).where(eq(availabilitySlots.teamId, teamId)).limit(1);
  if (existingSlots.length === 0) {
    const defaultSlots = [
      { label: "18:00-20:00", sortOrder: 0 },
      { label: "20:00-22:00", sortOrder: 1 },
      { label: "All Blocks", sortOrder: 2 },
      { label: "Unknown", sortOrder: 3 },
      { label: "Can't", sortOrder: 4 },
    ];
    await db.insert(availabilitySlots).values(
      defaultSlots.map((s) => ({ teamId, label: s.label, sortOrder: s.sortOrder }))
    );
    console.log("Default availability slots seeded");
  }

  const existingRosterRoles = await db.select().from(rosterRoles).where(eq(rosterRoles.teamId, teamId)).limit(1);
  if (existingRosterRoles.length === 0) {
    const defaultPlayerRoles = [
      { name: "Tank", type: "player", sortOrder: 0 },
      { name: "DPS", type: "player", sortOrder: 1 },
      { name: "Support", type: "player", sortOrder: 2 },
      { name: "Flex", type: "player", sortOrder: 3 },
    ];
    const defaultStaffRoles = [
      { name: "Coach", type: "staff", sortOrder: 0 },
      { name: "Analyst", type: "staff", sortOrder: 1 },
      { name: "Manager", type: "staff", sortOrder: 2 },
    ];
    await db.insert(rosterRoles).values(
      [...defaultPlayerRoles, ...defaultStaffRoles].map((r) => ({ teamId, name: r.name, type: r.type, sortOrder: r.sortOrder }))
    );
    console.log("Default roster roles seeded");
  }

  const existingChannels = await db.select().from(chatChannels).where(eq(chatChannels.teamId, teamId)).limit(1);
  if (existingChannels.length === 0) {
    await db.insert(chatChannels).values({ teamId, name: "general" });
    console.log("Default chat channel 'general' seeded");
  }
}

export async function bootstrapDefaultAdmin() {
  const teamId = getTeamId();

  await seedDefaults(teamId);

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
