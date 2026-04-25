# Vicious Esports Multi-Game Management Platform

## Overview

This project is a comprehensive multi-game esports management platform for "The Vicious" organization, supporting 29 games and 4 rosters per game (116 total). It provides features for team scheduling, event management, player/staff administration, role-based access control, a two-step registration approval workflow, team chat, statistics dashboards, and seasonal management. The platform aims to centralize and streamline operations for a multi-game esports entity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Game and Roster Structure
The platform displays roster-level cards grouped by game. Each game includes four fixed rosters (Team 1-4). Data is strictly isolated by `gameId` and `rosterId`. Rosters have unique 10-digit numeric codes for URL access (`/<game-slug>/<roster-code>`). A `GameProvider` manages the current game/roster context, scoping API calls. Invalid roster codes or unauthorized access result in "Page Not Found" or "Access Denied" messages with redirection.

### Authentication, Authorization, and Permissions
Session-based authentication uses `bcrypt` for password hashing. Registration is a two-step approval process. A robust role-based access control system includes `super_admin`, `org_admin`, `game_manager`, `coach_analyst`, and `player` roles. `org_admin` and `super_admin` bypass all permission checks. A hierarchical system prevents lower-ranked users from modifying higher-ranked users. Granular permissions (39 types across 9 categories) are assigned to roles, with support for custom roles. Banning a user at the organization level invalidates all their sessions and game assignments.

### Frontend and UI/UX
The frontend uses a modern sidebar layout with dark mode and Shadcn UI components. The `AppSidebar` adapts navigation based on context (home or game-specific). The home page (`GamesHome`) shows a grid of roster cards. An `OrgDashboard` provides an overview for `org_admin`. The `CalendarPage` features a monthly grid with color-coded event previews and a right sidebar for event details. The `RolesPage` manages user roles and granular permissions via a CRUD interface. A `SettingsPage` allows for organization-level configuration, including dynamic theming based on the uploaded logo. Pages use loading skeletons for better user experience.

### Core Features
- **Display Name System**: Automatic generation of unique display names based on game/roster.
- **Role & Access Management**: Tools for managing roles, permissions, users, and game access.
- **Chat System**: Channel-based messaging with file uploads, @mentions, and URL detection.
- **Activity Logging**: Detailed logs for game-scoped and organization-level actions.
- **Forgot Password Flow**: Secure password reset process managed by administrators.
- **Manageable Event Type System**: Dynamic event categories and sub-types configurable via the dashboard, influencing calendar display and event creation.
- **Attendance Tracking**: Per-event attendance for players and staff with statuses (attended/late/absent), managed via Event Details and Players page.
- **Statistics Filter & Breakdowns**: Stats page features collapsible category groups for filtering, and player statistics include breakdowns by mode, map, and opponent.
- **Opponent Event History**: Opponents page cards expand to show event history, including W/L/D records and game scores.
- **Share Functionality**: Clipboard sharing for event results in a standardized format.
- **In-App Tutorial**: Onboarding guide for new users, re-triggerable via a help button.
- **Data Safety**: No auto-delete/expire for user data.
- **Remix-Proofing**: Startup scripts ensure idempotent bootstrapping of default data, migrations, and directory creation.
- **Roster Configuration**: Rosters are ordered by `sortOrder`. Roster roles are managed, with player roles locked to "player" type.
- **User-Player Linking**: Secure linking of users to player profiles with team-scoped ownership checks.
- **Sides Configuration**: Per-roster configurable side definitions (e.g., Attack/Defense) managed via Dashboard Game Config.
- **Heroes Configuration**: Per-roster hero pool managed via Dashboard Game Config (admin/coach with `manage_game_config`). Heroes have name, role (Duelist/Vanguard/Strategist), optional image upload, active/inactive toggle, and sortOrder. For Marvel Rivals rosters, ~50 default heroes auto-seed on first load (idempotent via a `heroes_defaults_seeded` setting flag set before insert to avoid concurrent double-seed). The `game_heroes` join table (matchId, playerId OR opponentPlayerId, heroId) supports multi-hero per player per game records on both sides, plus ban & protect / analytics.
- **Opponents Management**: Per-roster opponent teams (`opponents`) and per-opponent rosters (`opponent_players`), managed via Dashboard Opponents tab (`manage_game_config`). Events can link to an opponent via `events.opponentId`; on game creation under that event, the link cascades to `games.opponentId` (default). Updating an event's opponent also updates child games whose opponentId is unset or matches the prior event opponent.
- **Schedule Countdown Timezone**: `UpcomingCountdown` interprets each event's wall-clock date/time in the event's configured timezone (`event.timezone`, with device tz fallback). Short timezone codes (EST/PST/JST/etc.) from `eventTimezones.ts` are resolved to fixed-offset zones via `Intl.DateTimeFormat`, so the countdown is correct regardless of the viewer's location.
- **Two-Sided Match Stats**: For each game, `MatchSidesEditor` shows our team's players AND the linked opponent's players in two sections. Panels render INLINE on Event Details for every game whose mode has stat fields (no toggle/click required). Our-team rows are limited to the current roster's players (queries are roster-scoped via `{gameId, rosterId}` queryKey segments). Each row supports a Played/DNP toggle, multi-hero selection, and per-mode stat fields. Persistence uses `match_participants` (per-game roster + DNP), `game_heroes` (multi-hero per player or opponentPlayerId), `player_game_stats` (our side), and `opponent_player_game_stats` (opponent side). All replace-all writes are wrapped in a single DB transaction for safety. Backed by routes: `GET/PUT /api/games/:id/participation`, `GET/PUT /api/games/:id/heroes`, `GET/POST /api/games/:id/opponent-player-stats`, all gated by `edit_events`.
- **Per-Mode Score Configuration**: Game modes can be configured with `scoreType` (numeric/rounds) and score caps, influencing multi-round scoring inputs.
- **Multi-Round Game Scoring**: Support for detailed scoring across multiple rounds per match, with data stored in `game_rounds` table and integrated into EventDetails UI.

### Database Structure
The database utilizes PostgreSQL and is structured with core tables for users, games, and rosters, supplemented by extensive game-scoped and roster-scoped tables to ensure data integrity and isolation.

### Startup Pipeline
Server startup involves:
1. `bootstrapDefaultAdmin()`: Migrations, supported games, default admin + roles.
2. `registerRoutes()`: API endpoints; `seedRosterDefaults()` runs per-roster on first access.
3. `seedComprehensiveTestData()`: Adds player/staff availability, off days, chat if missing.
4. `fixupTestData()`: Ensures event sub-types, opponents, chat channels/messages.
5. `runHealthCheck()`: 12-point verification.

### Deployment
The platform is designed for autoscale deployment, targeting Replit or Vercel/Neon. It uses `npm run build` for Vite frontend and esbuild server bundling, and `npm run start` to run the Node.js production server. Static assets are served from `dist/public/`. The environment uses nodejs-20, web, and postgresql-16. `vercel.json` is included for Vercel deployments.

## External Dependencies

- **PostgreSQL**: Primary database (Neon serverless driver).
- **bcryptjs**: Password hashing.
- **express-session**: Session management.
- **connect-pg-simple**: PostgreSQL session store.
- **react-icons/si**: Fallback game icons.
- **Shadcn UI**: Frontend component library.
- **multer**: File uploads to local filesystem (`./uploads/`).
- **emoji-picker-react**: Emoji support in chat.