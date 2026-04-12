# Vicious Esports Multi-Game Management Platform

## Overview

This application is a comprehensive multi-game esports management platform designed for "The Vicious" organization. It supports 29 different games, each with isolated data and 4 rosters per game (Team 1, Team 2, Team 3, Team 4 — 116 total rosters). The platform provides functionalities for team scheduling, event management, player and staff administration, role-based access control, a two-step registration approval workflow, team chat, statistics dashboards, and seasonal management. The project aims to streamline the operational aspects of a multi-game esports organization, enhancing efficiency and communication across various teams and titles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Game and Roster Structure
The platform features a centralized home page displaying roster-level cards grouped by game. Each game automatically includes four rosters: Team 1, Team 2, Team 3, Team 4. Data is strictly isolated by `gameId` and `rosterId` to ensure independence between different games and rosters. Each roster has a unique 10-digit numeric `code` column used in URLs (e.g., `/valorant/8738524018`). Routes use the format `/<game-slug>/<roster-code>`. Game icons are managed centrally, utilizing image assets where available and falling back to React icons for others. A `GameProvider` component manages the current game and roster context for all child components, ensuring API calls are correctly scoped. Invalid roster codes in URLs show a "Page Not Found" message and redirect to home. Access control in `GameAccessGate` shows an "Access Denied" UI before redirecting unauthorized users.

### Authentication, Authorization, and Permissions
The system uses session-based authentication with `bcrypt` for password hashing. Registration involves a two-step approval process (game-level and organization-level) and leads to the creation of a display name with a game/roster suffix. A robust role-based access control system is implemented with roles like `super_admin`, `org_admin`, `game_manager`, `coach_analyst`, and `player`. `org_admin` and `super_admin` bypass all permission checks (both server-side `requirePermission` and client-side `hasPermission`). A hierarchical permission system, enforced by rank guards, prevents lower-ranked users from modifying higher-ranked users. Granular permissions (39 types across 9 categories including "Home" category) are assigned to roles, and custom roles are supported. Home-level permissions (view_calendar, view_users_tab, view_roles_tab, view_game_access, view_settings, manage_settings, view_upcoming_events) gate sidebar navigation and API routes using `requirePermission` instead of `requireOrgRole`. Default home roles (Management/Admin/Staff/Member) are auto-seeded with appropriate home permissions. Banning a user at the organization level propagates to all their game assignments and invalidates sessions.

### Frontend and UI/UX
The frontend uses a modern sidebar layout with dark mode support and Shadcn UI components. The `AppSidebar` adapts its navigation based on whether the user is on the home page or within a specific game context. The home page (`GamesHome`) shows a clean full-width grid of roster cards grouped by game (no calendar/events — those live on the dedicated Calendar page). An `OrgDashboard` (accessible to `org_admin`) provides an overview of pending registrations, password reset requests, and roster details. The `CalendarPage` features a full monthly grid calendar with color-coded event previews in day cells, month navigation (prev/next/Today), and a right sidebar panel showing selected day events and upcoming events list. The `RolesPage` has two tabs: "User Roles" (static display of Player/Staff/Management registration types with auto-assignment info) and "User Permissions" (CRUD for home permission roles with granular checkbox permissions that auto-save). Org-level settings, including organization name, logo, and a dynamic theme system that extracts colors from the uploaded logo, are managed on a dedicated `SettingsPage`.

### Core Features
- **Display Name System**: Automatically generates a unique display name for users based on their selected game and roster, while preserving their original username for login.
- **Role Management**: Allows for creation, editing, and deletion of roles with fine-grained control over permissions.
- **User and Game Access Management**: Comprehensive tools for managing users, their roles, and access to specific game rosters. Game Access page features per-user game-collapsible roster checkboxes and a "Grant Access by Role" bulk assignment section for Management users. Users page includes a "Manage User Permissions" tab for assigning platform permission roles.
- **Chat System**: Channel-based messaging with file uploads, @mentions, URL detection, and support for video, audio, and attachments.
- **Activity Logging**: Detailed activity logs are maintained, with isolation for game-scoped and organization-level actions.
- **Forgot Password Flow**: Secure process for users to request password resets, managed by administrators.
- **Manageable Event Type System**: Dynamic event categories and sub-types managed via Dashboard "Event Types" tab with color pickers. Tables: `event_categories` (parent categories with `color` field) and `event_sub_types` (child sub-types per category with optional `color` that inherits from parent). EventDialog dynamically uses categories from DB if any exist, falling back to static defaults. Color dots shown in event type/sub-type selectors. CalendarPage prioritizes sub-type colors over category colors for event badges (fetches from `/api/all-event-sub-types`). Default categories (Scrim, Tournament, Meetings) auto-seeded per roster with distinct colors and sub-types. API endpoints: `/api/event-categories`, `/api/event-sub-types`, `/api/all-event-categories`, `/api/all-event-sub-types`.
- **Attendance Tracking**: Per-event attendance for players and staff with attended/late/absent statuses. Tracked in EventDetails page with dedicated attendance card. Backend: `attendance.staffId` field + `GET/POST /api/events/:eventId/attendance`. OrgDashboard shows attendance rates per roster. Players page has full attendance management for both players AND staff (Add Attendance button, collapsible records with filters/sorting/pagination). Attendance form supports both `playerId` and `staffId` fields.
- **Statistics Filter**: Stats page features collapsible category groups with per-subtype checkboxes for filtering event/game statistics. All metrics (Quick Summary, by-type breakdowns, mode/map stats) update based on selected sub-types.
- **Player Stats By Map + Opponent Breakdowns**: Player Statistics page includes three tabs: Overall, By Mode, and By Map. Backend `/api/player-stats-summary` returns `statsByMap` alongside `statsByMode`. Opponent section includes sub-tabs: Stats, By Mode, By Map, By Type — each showing W/L/D records and per-stat averages/totals.
- **Opponents Expand Arrow**: Opponents page cards have expand/collapse chevrons showing event history per opponent with W/L/D badges, game scores, dates, and links to event details.
- **Loading Skeletons**: All major pages (Players, Stats, Opponents, Events, EventDetails, PlayerStats, Home) display skeleton placeholders while data loads via `PageSkeleton.tsx` shared component.
- **Share Button**: Clipboard-only share for event results. Format: `[Roster] vs [Opponent] - [Score] - [RESULT] | [Date]\n[EventURL]`.
- **In-App Tutorial**: Onboarding guide shown on first visit (localStorage-based). Help button in header re-triggers the guide. Covers Events, Players/Staff, Statistics, Dashboard/Config, Chat, and Sharing.
- **Data Safety**: No auto-delete or auto-expire logic for user data. Session expiration is standard auth behavior. Object storage cache TTL is caching only.
- **Remix-Proofing**: Upload directories auto-created at startup (`./uploads/{logos,game-icons,chat,general}/`). `.gitkeep` files in each. `bootstrapDefaultAdmin` is idempotent (skips if users exist). All migrations use `ADD COLUMN IF NOT EXISTS`. `seedRosterDefaults` auto-seeds availability slots, roster roles, event categories/sub-types, staff, and chat channels per roster on first access.
- **Roster Roles**: Dashboard Roster Roles dialog locks Type to "player" (staff are managed separately). Form uses hidden input with hardcoded "player" value.
- **Roster Ordering**: Rosters sorted by `sortOrder` in both `/api/rosters` and `/api/all-rosters` endpoints.
- **Test Data**: 498 players, 464 staff, 3405 events, 14488 matches, 214013 stats across all 116 rosters. 119 user accounts (5 admin + 114 player-linked). All results normalized to lowercase (`win/loss/draw`), attendance to `attended/late/absent`. Per-roster auto-seeding includes 4 staff roles, 3 chat channels, 5 availability slots, 4 roster roles, and 3 event categories with sub-types.
- **User-Player Linking**: `PUT /api/users/:id/player` validates that the playerId belongs to the same team before linking. Security: team-scoped ownership check prevents cross-tenant data leaks.

### Database Structure
The database design incorporates core tables for users, games, and rosters, with extensive game-scoped tables (e.g., `players`, `events`, `schedules`) and roster-scoped tables (e.g., `attendance`, `staff_availability`), ensuring data integrity and isolation.

### Startup Pipeline
On every server start (`server/index.ts`), the following runs in order:
1. `bootstrapDefaultAdmin()` — Migrations, supported games, default admin + roles (idempotent)
2. `registerRoutes()` — All API endpoints; `seedRosterDefaults()` runs per-roster on first access
3. `seedComprehensiveTestData()` — Adds player availability, staff availability, off days, chat if missing (idempotent)
4. `fixupTestData()` — Ensures event sub-types, opponents, chat channels/messages for all rosters (idempotent)
5. `runHealthCheck()` — 12-point verification printed to console (DB, games, users, roles, rosters, players, events, matches, stats, attendance, channels, messages)

### Deployment
- **Target**: Autoscale deployment via Replit (or Vercel + Neon — see `DEPLOYMENT.md`)
- **Build**: `npm run build` (Vite frontend build + esbuild server bundle)
- **Run**: `npm run start` (Node.js production server at `dist/index.js`)
- **Static assets**: Served from `dist/public/`
- **Modules**: nodejs-20, web, postgresql-16 (no Python, no Playwright)
- **Note**: Removed `playwright`, `passport`, `next-themes` and 33 Chromium/X11 system packages that were causing deployment timeouts
- **Vercel**: `vercel.json` included for API routing, rewrites, and static asset caching

## External Dependencies

- **PostgreSQL**: Primary database for all application data (Neon serverless driver).
- **bcrypt**: For secure password hashing (bcryptjs, pure JS).
- **express-session**: Session management for Express.js.
- **connect-pg-simple**: PostgreSQL-backed session store.
- **react-icons/si**: Used as a fallback for game icons where specific image assets are not available.
- **Shadcn UI**: Frontend component library for building the user interface.
- **Local Filesystem Uploads**: All file uploads (logos, game icons, chat media, general) use multer with diskStorage under `./uploads/{logos,game-icons,chat,general}/`. Served statically via `express.static("uploads")`. Blocked extensions: .html, .js, .php, etc. Max file size: 10MB.
- **emoji-picker-react**: Emoji picker for chat functionality.
- **multer**: Multipart form data handling for file uploads with disk storage and file type filtering.