# Vicious Esports Multi-Game Management Platform

## Overview

This application is a comprehensive multi-game esports management platform for "The Vicious" organization. It supports 29 different games with full per-game data isolation and multiple rosters per game (First Team, Academy, Women). Features include: team scheduling and availability tracking, event calendar and results, player and staff management, role-based access control with org-level and game-level roles, two-step registration approval workflow (game-level + org-level), a Discord-style team chat, statistics dashboards, and seasonal management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Game Structure
The platform is organized around a central home page showing roster-level cards grouped by game. Each game has 3 default rosters (First Team, Academy, Women) shown as independent cards. Users are assigned to specific games via `user_game_assignments` with optional `rosterId` scoping. All game data is isolated by `gameId` and `rosterId`. Routes are prefixed by game slug: `/:gameSlug/*` (e.g., `/valorant/players`).

The 29 supported games: Dota 2, Counter-Strike, VALORANT, Mobile Legends, League of Legends, Rocket League, PUBG Mobile, Overwatch, Rainbow Six, Apex Legends, Fighting Games, PUBG, Honor of Kings, Brawl Stars, Call of Duty, Marvel Rivals, EA Sports FC, Free Fire, Fortnite, Teamfight Tactics, CrossFire, Deadlock, Trackmania, The Finals, Warzone, eFootball, Free Fire Mobile, Honor of Kings Mobile, Call of Duty Mobile.

### Roster System
Each game supports multiple rosters (First Team, Academy, Women by default). Rosters are auto-seeded when first accessed via `/api/rosters` or `/api/all-rosters`. Data isolation: players, events, attendance, staff, availability, schedules are all filterable by `rosterId`. A roster selector in the sidebar allows switching between rosters. The `rosters` table stores: id, teamId, gameId, name, slug, sortOrder. On the home page, each roster appears as an independent card grouped under its game.

### Role System
- **super_admin**: Superuser access (reserved for platform owner)
- **org_admin** (Management): Full access to all games, org dashboard, approve/reject registrations
- **game_manager**: Manages assigned games, can approve/reject for their games
- **coach_analyst** (Staff): Read-heavy access to assigned games
- **player**: Minimal access (own availability, view schedule)

Role hierarchy for game-level roles: Owner(4) > Admin(3) > Staff(2) > Member(1). Only higher ranks can modify lower ranks' roles. Default game roles (Owner, Admin, Staff, Member) auto-seed when first accessed.

### Authentication & Authorization
Session-based authentication with `bcrypt` for password hashing, using `express-session` and `connect-pg-simple`. Registration requires game selection, role selection, and admin approval. New registrations create `user_game_assignments` with `status: "pending"` and two-step approval fields (`approvalGameStatus`, `approvalOrgStatus`). Both must be "approved" for user access. The `requireAuth`, `requirePermission`, `requireOrgRole`, and `requireGameAccess` middleware chain enforces all access rules.

### Permission Hierarchy Enforcement
Rank system: super_admin(6) > org_admin(5) > Owner(4) > Admin(3) > Staff(2) > Member(1). `getUserRank()` combines orgRole and system role. `checkRankGuard()` blocks lower-ranked users from modifying higher-ranked users across all actions: delete, rename, force logout, create user, and status change.

### Permission System
32 granular permissions grouped into 8 categories: Schedule, Events, Results, Players, Statistics, Chat, Staff, and Dashboard. Each role has a predefined set of permissions, and custom roles with granular permissions are also supported.

### Frontend Routing
- `/`: Multi-game home page with 26 game cards + Dashboard tab (for org_admin/game_manager)
- `/:gameSlug`: Schedule/availability for that game
- `/:gameSlug/events`: Events calendar
- `/:gameSlug/events/:id`: Event details
- `/:gameSlug/results`: Event results
- `/:gameSlug/players`: Player management
- `/:gameSlug/staff`: Staff management
- `/:gameSlug/chat`: Team chat
- `/:gameSlug/dashboard`: Admin panel
- `/:gameSlug/stats`, `/:gameSlug/player-stats`, etc.: Analytics pages
- `/account`: User account settings

### Game Context
The `GameProvider` component reads `:gameSlug` from the URL via the `useGame` hook, providing the current game and current roster to all child components. All API calls include the current game's `gameId` and `rosterId`. Cache is cleared when switching games or rosters to prevent stale data.

### Sidebar Navigation
The `AppSidebar` adapts based on context:
- On the home page: shows org logo/name, navigation to home/account
- Within a game: shows game icon/name, roster selector, back button, and game-specific navigation
Game icons use react-icons/si for supported games (VALORANT, LoL, CS, Dota2, PUBG, EA, Activision, Epic, Ubisoft, Riot), colored abbreviations for others.

### Registration Flow
1. User visits `/auth`, selects username/password, chooses role (Player/Staff/Management), and selects game(s)
2. Account created with `status: "pending"`, game assignments created with `status: "pending"`
3. User sees a "Request Under Review" waiting page
4. Org Admin or Game Manager approves/rejects via Dashboard tab on home page
5. On approval, user can access their assigned games

### Staff User Linking
Staff records can be linked to user accounts via `PUT /api/staff/:id/link-user`. This connects the staff profile to an authenticated user, enabling identity tracking.

### Org Settings
Org-level settings (not game-scoped) stored with `gameId = null` in the settings table. Key settings:
- `org_name`: Organization display name (shown in availability page subtitle)
- `org_logo`: URL to organization logo (shown in sidebar)

### Key Files
- `shared/schema.ts`: All database models, insert schemas, and types
- `server/routes.ts`: All API routes
- `server/storage.ts`: Database access layer with gameId and rosterId isolation
- `server/auth.ts`: Auth middleware and bootstrap (seeds default admin + 26 games)
- `client/src/App.tsx`: Frontend routing with `/:gameSlug/*` patterns
- `client/src/hooks/use-game.tsx`: Game context provider with roster support
- `client/src/hooks/use-auth.tsx`: Auth context with orgRole and game assignments
- `client/src/pages/GamesHome.tsx`: Multi-game home page with game cards and dashboard
- `client/src/components/app-sidebar.tsx`: Adaptive sidebar with game icons, roster selector, and org logo
- `client/src/lib/queryClient.ts`: API client with gameId/rosterId auto-injection

### Database Tables
Core: `users`, `supported_games`, `user_game_assignments`, `notifications`, `rosters`
Game-scoped (all have `gameId`): `players`, `attendance`, `events`, `seasons`, `game_modes`, `maps`, `games`, `off_days`, `stat_fields`, `player_game_stats`, `staff`, `schedules`, `settings`, `chat_channels`, `chat_messages`, `chat_channel_permissions`, `player_availability`, `staff_availability`, `availability_slots`, `roster_roles`, `team_notes`
Roster-scoped (have `rosterId`): `players`, `attendance`, `events`, `staff`, `schedules`, `availability_slots`, `roster_roles`, `player_availability`, `staff_availability`

### Chat Features
Channel-based messaging with file uploads via object storage (presigned URLs), @mentions with autocomplete, clickable URL detection, and user role display. Video attachments and file download links supported.

### UI/UX
Modern sidebar layout with dark mode support. Uses Shadcn UI components throughout. Game-specific colored icons. Responsive grid layout for game cards (2-6 columns depending on screen width).
