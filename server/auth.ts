import bcrypt from "bcryptjs";
import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { eq, and, sql, isNull, or } from "drizzle-orm";
import { db, pool } from "./db";
import { getTeamId } from "./storage";
import { roles, users, allPermissions, supportedGames, userGameAssignments, subscriptions, SUPPORTED_GAMES_LIST, type Permission, type SubscriptionStatus } from "@shared/schema";
import { desc } from "drizzle-orm";
import type { Express, Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  app.set("trust proxy", 1);

  app.use(
    session({
      store: new PgStore({
        pool: pool as any,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || require("crypto").randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
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
    await db.execute(sql`ALTER TABLE rosters ADD COLUMN IF NOT EXISTS code VARCHAR`);
    await db.execute(sql`ALTER TABLE user_game_assignments ADD COLUMN IF NOT EXISTS roster_id VARCHAR REFERENCES rosters(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE user_game_assignments ADD COLUMN IF NOT EXISTS approval_game_status TEXT NOT NULL DEFAULT 'pending'`);
    await db.execute(sql`ALTER TABLE user_game_assignments ADD COLUMN IF NOT EXISTS approval_org_status TEXT NOT NULL DEFAULT 'pending'`);
    await db.execute(sql`UPDATE user_game_assignments SET approval_game_status = 'approved', approval_org_status = 'approved' WHERE status = 'approved' AND approval_game_status = 'pending'`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT`);
    await db.execute(sql`ALTER TABLE supported_games ADD COLUMN IF NOT EXISTS icon_url TEXT`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR,
        username TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolved_by VARCHAR
      )
    `);
    const rosterIdTables = [
      "roles", "chat_channels", "settings", "stat_fields", "game_modes",
      "maps", "games", "off_days", "seasons", "team_notes",
    ];
    for (const t of rosterIdTables) {
      await db.execute(sql.raw(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS roster_id VARCHAR REFERENCES rosters(id) ON DELETE SET NULL`));
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS event_categories (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR,
        game_id VARCHAR,
        roster_id VARCHAR REFERENCES rosters(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS event_sub_types (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR,
        game_id VARCHAR,
        roster_id VARCHAR REFERENCES rosters(id) ON DELETE SET NULL,
        category_id VARCHAR NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      )
    `);
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS event_sub_type TEXT`);
    await db.execute(sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS staff_id VARCHAR REFERENCES staff(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE event_categories ADD COLUMN IF NOT EXISTS color TEXT`);
    await db.execute(sql`ALTER TABLE event_sub_types ADD COLUMN IF NOT EXISTS color TEXT`);
    await db.execute(sql`ALTER TABLE hero_role_configs ADD COLUMN IF NOT EXISTS color TEXT`);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_team_game_roster ON events(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_players_team_game_roster ON players(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_staff_team_game_roster ON staff(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_attendance_team_game_roster ON attendance(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_player_game_stats_team_game ON player_game_stats(team_id, game_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_player_avail_team_game_roster ON player_availability(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_staff_avail_team_game_roster ON staff_availability(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_channels_team_game_roster ON chat_channels(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_off_days_team_game_roster ON off_days(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_event_categories_team_game_roster ON event_categories(team_id, game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_event_sub_types_category ON event_sub_types(category_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_game_assignments_user ON user_game_assignments(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_game_assignments_game ON user_game_assignments(game_id, roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_games_team_game ON games(team_id, game_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_games_event_id ON games(event_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_attendance_event_id ON attendance(event_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pgs_match_id ON player_game_stats(match_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pgs_player_id ON player_game_stats(player_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_events_roster_id ON events(roster_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_games_roster_id ON games(roster_id)`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'trial',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        manual_active_override BOOLEAN,
        notes TEXT,
        created_at TEXT DEFAULT now(),
        updated_at TEXT DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_team_id ON subscriptions(team_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);

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

  const envPassword = process.env.ADMIN_INITIAL_PASSWORD;
  const isProduction = process.env.NODE_ENV === "production";

  if (!envPassword && isProduction) {
    throw new Error(
      "[SECURITY] ADMIN_INITIAL_PASSWORD environment variable must be set before first production deploy. " +
      "Set it to a strong secret to bootstrap the admin account securely."
    );
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
      name: "Management",
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

  const initialPassword = envPassword || crypto.randomBytes(16).toString("hex");
  const passwordHash = await bcrypt.hash(initialPassword, 10);

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

  if (envPassword) {
    console.log("[SECURITY] Default admin account created (username: Admin). Password set from ADMIN_INITIAL_PASSWORD env var.");
  } else {
    console.log("[SECURITY] Default admin account created (username: Admin).");
    console.log(`[SECURITY] One-time temporary password: ${initialPassword}`);
    console.log("[SECURITY] Set ADMIN_INITIAL_PASSWORD env var before first production deploy to avoid credential exposure in logs.");
  }
  console.log("[SECURITY] Change the admin password immediately after first login.");
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

/**
 * Compute current subscription status for a user.
 * - super_admin: always active (bypass)
 * - manualActiveOverride === true: active
 * - manualActiveOverride === false: inactive
 * - else: active iff today <= endDate (date-only comparison, inclusive)
 */
export async function getSubscriptionStatus(userId: string, orgRole: string | null | undefined): Promise<SubscriptionStatus> {
  const isSuperAdmin = orgRole === "super_admin";

  const teamId = getTeamId();
  const [latest] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.teamId, teamId)))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!latest) {
    return {
      hasSubscription: false,
      status: isSuperAdmin ? "active" : "inactive",
      type: null,
      startDate: null,
      endDate: null,
      manualActiveOverride: null,
      daysRemaining: null,
      bypass: isSuperAdmin,
    };
  }

  // Day-precision comparison: parse YYYY-MM-DD as a local date (avoid UTC drift
  // that would make end-date appear off-by-one in non-UTC timezones).
  const parseLocalDate = (s: string): Date => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = parseLocalDate(latest.endDate);
  end.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.round((end.getTime() - today.getTime()) / msPerDay);

  let active: boolean;
  if (latest.manualActiveOverride === true) active = true;
  else if (latest.manualActiveOverride === false) active = false;
  else active = daysRemaining >= 0;

  return {
    hasSubscription: true,
    status: isSuperAdmin || active ? "active" : "inactive",
    type: (latest.type as "trial" | "paid"),
    startDate: latest.startDate,
    endDate: latest.endDate,
    manualActiveOverride: latest.manualActiveOverride ?? null,
    daysRemaining,
    bypass: isSuperAdmin,
  };
}

/**
 * Middleware: blocks the request if the user does not have an active subscription.
 * super_admin always bypasses. All other roles (including org_admin) must have an active sub.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const teamId = getTeamId();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, req.session.userId), eq(users.teamId, teamId)))
    .limit(1);
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  if (user.orgRole === "super_admin") return next();

  const status = await getSubscriptionStatus(user.id, user.orgRole);
  if (status.status !== "active") {
    return res.status(402).json({
      message: "Subscription required",
      subscription: status,
    });
  }
  next();
}

/**
 * Routes the subscription gate should NOT block. These cover the auth handshake,
 * the subscription block screen's own data fetches, branding/preview assets,
 * and explicit logout/account-management surfaces.
 */
const SUBSCRIPTION_GATE_ALLOWLIST = [
  "/api/auth/me",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/settings",
  "/api/subscriptions",            // covers /api/subscriptions/me + super-admin CRUD (which is also role-gated)
  "/api/org-setting",              // org logo / theme / name shown on the block screen
  "/api/notifications",            // header bell — kept lightweight
  "/api/push-tokens",              // mobile push registration / opt-in toggle
];

/**
 * Global gate: applied to all /api/* routes. If the user is logged in and
 * does not have an active subscription, return 402 — except for paths in the
 * allowlist above (which the block screen still needs to function).
 */
export function subscriptionGate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api/")) return next();
    if (!req.session.userId) return next(); // requireAuth handles unauth on each route
    if (SUBSCRIPTION_GATE_ALLOWLIST.some(p => req.path === p || req.path.startsWith(p + "/"))) {
      return next();
    }
    const teamId = getTeamId();
    const [user] = await db.select().from(users)
      .where(and(eq(users.id, req.session.userId), eq(users.teamId, teamId)))
      .limit(1);
    if (!user) return next();
    if (user.orgRole === "super_admin") return next();

    const status = await getSubscriptionStatus(user.id, user.orgRole);
    if (status.status === "active") return next();

    return res.status(402).json({
      message: "Subscription required",
      subscription: status,
    });
  };
}

export async function requireGameAccess(req: Request, res: Response, next: NextFunction) {
  const gameId = (req.query.gameId as string) || null;
  const rosterId = (req.query.rosterId as string) || null;

  if (!req.session.userId) {
    return next(); // requireAuth on each route handles unauthenticated requests
  }

  const teamId = getTeamId();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, req.session.userId), eq(users.teamId, teamId)))
    .limit(1);

  if (!user) {
    return next(); // requireAuth will reject
  }

  if (user.orgRole === "super_admin" || user.orgRole === "org_admin") {
    return next();
  }

  // Non-admin users must provide a gameId to scope their request
  if (!gameId) {
    return res.status(403).json({ message: "Game scope required" });
  }

  // Check for an approved assignment covering the requested game (and optionally roster).
  // When no rosterId is provided the caller must hold a game-wide assignment
  // (rosterId IS NULL). Roster-scoped users must always supply their rosterId so
  // that storage filters are properly scoped and cross-roster data leakage is prevented.
  const [assignment] = await db.select().from(userGameAssignments)
    .where(and(
      eq(userGameAssignments.userId, user.id),
      eq(userGameAssignments.gameId, gameId),
      eq(userGameAssignments.status, "approved"),
      eq(userGameAssignments.teamId, teamId),
      rosterId
        ? or(isNull(userGameAssignments.rosterId), eq(userGameAssignments.rosterId, rosterId))
        : isNull(userGameAssignments.rosterId),
    ))
    .limit(1);

  if (!assignment) {
    return res.status(403).json({ message: rosterId ? "You do not have access to this roster" : "You do not have access to this game" });
  }

  next();
}
