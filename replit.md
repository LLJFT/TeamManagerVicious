# Vicious Esports Multi-Game Management Platform

## Overview

This application is a comprehensive multi-game esports management platform for "The Vicious" organization. It supports 29 different games with full per-game data isolation and multiple rosters per game (First Team, Academy, Women). Features include: team scheduling and availability tracking, event calendar and results, player and staff management, role-based access control with org-level and game-level roles, two-step registration approval workflow (game-level + org-level), a Discord-style team chat, statistics dashboards, and seasonal management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Game Structure
The platform is organized around a central home page showing roster-level cards grouped by game. Each game has 3 default rosters (First Team, Academy, Women) shown as independent cards. Users are assigned to specific games via `user_game_assignments` with optional `rosterId` scoping. All game data is isolated by `gameId` and `rosterId`. Routes are prefixed by game slug: `/:gameSlug/*` (e.g., `/valorant/players`).

The 29 supported games: Dota 2, Counter-Strike, VALORANT, Mobile Legends, League of Legends, Rocket League, PUBG Mobile, Overwatch, Rainbow Six, Apex Legends, Fighting Games, PUBG, Honor of Kings, Brawl Stars, Call of Duty, Marvel Rivals, EA Sports FC, Free Fire, Fortnite, Teamfight Tactics, CrossFire, Deadlock, Trackmania, The Finals, Warzone, eFootball, Free Fire Mobile, Honor of Kings Mobile, Call of Duty Mobile.

### Game Icons
Game icons are centralized in `client/src/components/game-icon.tsx`. For 20 games, actual image assets are imported from `@assets/` (e.g., Apex, R6, Fortnite, etc.). For games without images (valorant, lol, cs, dota2, pubg, pubg-mobile, ea-fc, cod, fighting-games), react-icons/si icons are used as fallback. The `GameIcon` component supports "sm" and "md" sizes. `GameBadge` is used in the sidebar.

### Roster System
Each game supports multiple rosters (First Team, Academy, Women by default). Rosters are auto-seeded when first accessed via `/api/rosters` or `/api/all-rosters`. Data isolation: players, events, attendance, staff, availability, schedules are all filterable by `rosterId`. The sidebar shows the current roster name as a static badge (no roster switcher dropdown). The `rosters` table stores: id, teamId, gameId, name, slug, sortOrder. On the home page, each roster appears as an independent card grouped under its game.

### Roster Access Independence
Access is checked at the roster level, not just game level. `hasRosterAccess(gameId, rosterId)` in use-auth.tsx checks if user has an approved assignment matching both gameId AND rosterId. Admins (org_admin, super_admin) have access to everything. Game managers have access to all rosters of their assigned games. Regular players/staff need explicit roster-level assignments.

### Display Name System
When users register for a game+roster, a display name is generated with a game/roster suffix:
- Format: `{base}_{ABBREV}` for First Team, `{base}_{ABBREV}_AC` for Academy, `{base}_{ABBREV}_W` for Women
- Example: "Ahmed" registering for Rainbow Six First Team gets displayName "Ahmed_R6"
- The original `username` is preserved for login (unmodified)
- `displayName` is the suffixed version shown throughout the app (display-only, not login credential)
- The registration UI shows both the display name preview and clarifies the login username
- Abbreviations defined in `GAME_ABBREVIATIONS` map in shared/schema.ts

### Role System
- **super_admin**: Superuser access (reserved for platform owner)
- **org_admin** (Management): Full access to all games, org dashboard, approve/reject registrations
- **game_manager**: Manages assigned games, can approve/reject for their games
- **coach_analyst** (Staff): Read-heavy access to assigned games
- **player**: Minimal access (own availability, view schedule)

Role hierarchy for game-level roles: Management(4) > Admin(3) > Staff(2) > Member(1). Only higher ranks can modify lower ranks' roles. Default game roles (Management, Admin, Staff, Member) auto-seed when first accessed. Legacy "Owner" role name is still accepted for backward compatibility.

### Authentication & Authorization
Session-based authentication with `bcrypt` for password hashing, using `express-session` and `connect-pg-simple`. Registration requires game selection, roster selection, role selection, and admin approval. New registrations create `user_game_assignments` with `status: "pending"` and two-step approval fields (`approvalGameStatus`, `approvalOrgStatus`). Both must be "approved" for user access. The `requireAuth`, `requirePermission`, `requireOrgRole`, and `requireGameAccess` middleware chain enforces all access rules.

### Permission Hierarchy Enforcement
Rank system: super_admin(6) > org_admin(5) > Management/Owner(4) > Admin(3) > Staff(2) > Member(1). `getUserRank()` combines orgRole and system role. `checkRankGuard()` blocks lower-ranked users from modifying higher-ranked users across all actions: delete, rename, force logout, create user, and status change.

### Permission System
32 granular permissions grouped into 8 categories: Schedule, Events, Results, Players, Statistics, Chat, Staff, and Dashboard. Each role has a predefined set of permissions, and custom roles with granular permissions are also supported.

### Frontend Routing
- `/`: Multi-game home page with roster cards + Dashboard tab (for org_admin/game_manager) + Settings tab
- `/:compositeSlug`: Schedule/availability for game+roster (e.g., `/dota2` = First Team, `/dota2_academy` = Academy, `/dota2_women` = Women)
- `/:compositeSlug/events`: Events calendar
- `/:compositeSlug/events/:id`: Event details
- `/:compositeSlug/results`, `/players`, `/staff`, `/chat`, `/dashboard`, `/stats`, `/player-stats`, etc.
- `/account`: User account settings

### Roster URL System
Each roster gets a unique URL via composite slugs: `rosterUrlSlug(gameSlug, rosterSlug)` in `use-game.tsx`. First Team uses just the game slug (e.g., `/valorant`), Academy appends `_academy` (e.g., `/valorant_academy`), Women appends `_women` (e.g., `/valorant_women`). The `GameProvider` parses composite slugs back into game + roster hint using `parseCompositeSlug()`.

### Game Context
The `GameProvider` component reads the composite slug from the URL, parses it into game slug + roster hint, and provides `currentGame`, `currentRoster`, `gameSlug`, and `fullSlug` to all child components. The `fullSlug` includes the roster suffix and is used for building navigation links. All API calls include the current game's `gameId` and `rosterId`. Cache is cleared when switching games or rosters to prevent stale data.

### Sidebar Navigation
The `AppSidebar` adapts based on context:
- On the home page: shows org logo/name, navigation to home/account
- Within a game: shows game icon/name, current roster name badge, back button, and game-specific navigation
Game icons use the shared `GameIcon`/`GameBadge` components from `game-icon.tsx`.

### Registration Flow
1. User visits `/auth`, selects username/password, chooses role (Player/Staff/Management)
2. For Player/Staff: selects a single game, then selects roster type (First Team/Academy/Women)
3. Username preview shows the final suffixed name (e.g., "Ahmed_R6")
4. Account created with suffixed username, `status: "pending"`, game assignment created with `rosterId` and `status: "pending"`
5. User sees a "Request Under Review" waiting page
6. Org Admin or Game Manager approves/rejects via Dashboard tab on home page
7. On approval, user can access their assigned game+roster

### Staff User Linking
Staff records can be linked to user accounts via `PUT /api/staff/:id/link-user`. This connects the staff profile to an authenticated user, enabling identity tracking.

### Org Settings
Org-level settings (not game-scoped) stored with `gameId = null` in the settings table. Key settings:
- `org_name`: Organization display name (shown in availability page subtitle)
- `org_logo`: URL to organization logo (shown in sidebar, replaces Shield icon)
- `org_theme`: JSON string with `primary` and `primaryForeground` HSL values for dynamic theming

### Settings Page (GamesHome.tsx Settings Tab)
The Settings tab (org_admin only) includes:
1. Organization Name - editable org display name
2. Organization Logo - upload via ObjectUploader, saves normalized path to org_logo setting
3. Dynamic Theme - "Generate Theme from Logo" button extracts dominant colors via canvas, applies as CSS custom properties (--primary, --sidebar-primary), persists to org_theme setting
4. Manage All Users - shows all users with org role dropdown, approve button for pending users, game assignment badges
5. Manage Game Access - add/remove game assignments for any user, with game selection dropdown and inline removal
6. Management Chat - org-level chat for management team (org_admin/game_manager only), uses `/api/org-chat/messages` endpoints with auto-created "Management" channel (gameId: null)
7. Activity Log - fetches from `/api/org-activity-logs` (org-scoped, not game-scoped)

### Dynamic Theme System
On app load, `DynamicThemeLoader` component in App.tsx reads `org_theme` setting and applies saved HSL colors as CSS custom properties. Theme is generated by extracting dominant colors from the uploaded org logo using canvas pixel analysis. Colors override `--primary`, `--primary-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`.

### Home Dashboard (GamesHome.tsx Dashboard Tab)
The Dashboard tab shows:
1. Pending Registrations - single-click approve/reject (uses `/api/game-assignments/:id/approve` which sets both org+game status)
2. Roster Overview - per-roster cards with attendance stats, expandable member lists
3. Event Overview - per-roster event cards with recent results and upcoming events
Backend: `/api/org-dashboard` returns `rosterSummaries` array (per-roster, not per-game) with attendance, members, recentResults, and nextEvents.

### Key Files
- `shared/schema.ts`: All database models, insert schemas, types, GAME_ABBREVIATIONS map
- `server/routes.ts`: All API routes
- `server/storage.ts`: Database access layer with gameId and rosterId isolation
- `server/auth.ts`: Auth middleware and bootstrap (seeds default admin + 29 games)
- `client/src/App.tsx`: Frontend routing with `/:gameSlug/*` patterns
- `client/src/hooks/use-game.tsx`: Game context provider with roster support
- `client/src/hooks/use-auth.tsx`: Auth context with orgRole, game assignments, hasRosterAccess
- `client/src/pages/GamesHome.tsx`: Multi-game home page with roster cards and dashboard
- `client/src/components/app-sidebar.tsx`: Adaptive sidebar with game icons, roster badge, and org logo
- `client/src/components/game-icon.tsx`: Shared game icon component with image imports and react-icons fallback
- `client/src/lib/queryClient.ts`: API client with gameId/rosterId auto-injection

### Chat System
Channel-based messaging with file uploads via object storage (presigned URLs), @mentions with autocomplete, clickable URL detection, and user role display. Video, audio (voice messages), and file attachments supported. The emoji picker is lazy-loaded to prevent page freezing. Chat queries use custom queryFn for proper URL construction (not relying on default fetcher for nested paths like `/api/chat/channels/:id/messages`).

### Ban/Delete Propagation
When a user is banned at org level, all their game assignments are also set to "banned" and their sessions are invalidated. When unbanned, game assignments are restored to "approved". When a user is deleted, all game assignments and sessions are cleaned up first.

### Activity Log Isolation
All game-scoped logActivity calls include `gameId` parameter. Org-level activity logs (`/api/org-activity-logs`) filter by `isNull(gameId)` to only show platform-level actions. Game-level activity logs are scoped by gameId.

### Admin Password Reset
Admins can reset any user's password via `PUT /api/users/:id/reset-password`. Generates a random 8-character temporary password, hashes with bcrypt (lowercase), and returns the temp password. Protected by rank guard.

### Home Page Calendar
The org home page includes an `EventCalendarWidget` showing a mini calendar with event date indicators and an upcoming events list. Fetches all events across all games via `/api/all-events`.

### Registration Active Games Filter
The `/api/supported-games` endpoint filters to only show games that have at least one roster configured, ensuring the registration game selector only shows active games.

### Database Tables
Core: `users`, `supported_games`, `user_game_assignments`, `notifications`, `rosters`
Game-scoped (all have `gameId`): `players`, `attendance`, `events`, `seasons`, `game_modes`, `maps`, `games`, `off_days`, `stat_fields`, `player_game_stats`, `staff`, `schedules`, `settings`, `chat_channels`, `chat_messages`, `chat_channel_permissions`, `player_availability`, `staff_availability`, `availability_slots`, `roster_roles`, `team_notes`
Roster-scoped (have `rosterId`): `players`, `attendance`, `events`, `staff`, `schedules`, `availability_slots`, `roster_roles`, `player_availability`, `staff_availability`

### UI/UX
Modern sidebar layout with dark mode support. Uses Shadcn UI components throughout. Game-specific icons from attached assets or react-icons. Responsive grid layout for roster cards (1-3 columns depending on screen width).
