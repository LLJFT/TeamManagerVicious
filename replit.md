# Vicious Esports Multi-Game Management Platform

## Overview
This project is a comprehensive multi-game esports management platform designed for "The Vicious" organization. It centralizes and streamlines operations for 29 games, each supporting four rosters, totaling 116 teams. Key capabilities include team scheduling, event management, player/staff administration, robust role-based access control with a two-step registration approval, team chat, statistics dashboards, and seasonal management. The platform aims to provide a unified solution for managing a large-scale, multi-game esports entity.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture
The platform is built to support a multi-game and multi-roster structure, isolating data strictly by `gameId` and `rosterId`. It uses session-based authentication with `bcrypt` for password hashing and a two-step approval process for registration. A hierarchical role-based access control system manages permissions, including `super_admin`, `org_admin`, `game_manager`, `coach_analyst`, and `player` roles, with granular control over 39 permission types.

### Frontend and UI/UX
The frontend features a modern sidebar layout with dark mode and utilizes Shadcn UI components for a consistent user experience. It includes dynamic navigation, a roster card display on the home page, an organization dashboard, and a calendar with color-coded event previews. User role and permission management are handled via a CRUD interface, and a settings page allows for organization-level configurations including dynamic theming. Loading skeletons are used to enhance user experience.

### Key Features
- **Data Management**: Unique display names, activity logging, secure forgot password flow, and a dynamic event type system.
- **Roster & Player Management**: Roster configuration, user-player linking, and attendance tracking for events.
- **Game Configuration**: Per-roster configurable side definitions, hero pools (with default seeding for Marvel Rivals), and opponent management with team logo uploads. Opponent logos appear next to "vs <name>" everywhere opponents are shown (event lists, history, opponent stats, event details, player stats, upcoming countdowns, event-dialog picker), via the shared `OpponentAvatar` component (falls back to initials when no logo is set).
- **Image Persistence**: All image uploads (opponent logos, hero images, map images, event scoreboards) go through `POST /api/objects/upload`. Images are persisted as base64 data URLs stored directly in the corresponding DB column (e.g. `opponents.logoUrl`, `heroes.imageUrl`), so they survive every redeploy, container restart, and `_quarantine` sweep — no reliance on the local `/uploads/*` directory or external object storage availability. Non-image uploads attempt object storage first and fall back to local disk in dev.
- **Hero Role Management**: Per-game role definitions managed via the "Manage Roles" button inside Heroes Configuration (gated by `manage_game_config`). Roles are stored in `hero_role_configs` (teamId + gameId + name unique). Supports CRUD, reorder, enable/disable. Add/Edit Hero dialogs pull options from this list. Renaming a role atomically cascades the new name to all heroes using it. Deleting a role-in-use returns 409 with `heroesAffected` and requires `?reassignTo=<roleConfigId>` to migrate heroes; deletion runs in a transaction. The "All" tab in Heroes Configuration is a filter only; "Other" only appears when heroes truly have unmapped roles.
- **Competitive Systems**:
    - **Hero Ban System (HBS)**: Configurable, reusable per-roster presets with support for simple, rainbow_flexible, and custom modes. Each game can opt-in to a preset, with an editable sequence of actions (ban/protect) and server-enforced limits.
    - **Map Veto System (MVS)**: Configurable, reusable per-roster presets supporting ban, pick, decider, and side choice actions. Each game can opt-in, with an editable sequence of actions and server-enforced limits. Map images are supported for visual representation.
- **Statistics & Scoring**: Two-sided match stats (replacing legacy player stats) with per-mode score configuration, multi-round scoring, and detailed player statistics breakdowns. Opponent event history and share functionality are also included.
- **User Experience**: In-app tutorial for onboarding, schedule countdowns that account for event timezones, and robust data safety measures with no auto-deletion.
- **Deployment & Development**: Designed for autoscale deployment, with startup scripts for idempotent bootstrapping of default data, migrations, and directory creation.

### Database and Deployment
The platform uses PostgreSQL for its database, leveraging extensive game-scoped and roster-scoped tables. It is designed for deployment on platforms like Replit or Vercel/Neon, using `npm run build` for frontend and server bundling, and `npm run start` for the Node.js production server. The environment is Node.js 20 with PostgreSQL 16.

## External Dependencies

-   **PostgreSQL**: Primary database (via Neon serverless driver).
-   **bcryptjs**: For password hashing.
-   **express-session**: For session management.
-   **connect-pg-simple**: PostgreSQL session store.
-   **react-icons/si**: For fallback game icons.
-   **Shadcn UI**: Frontend component library.
-   **multer**: For file uploads.
-   **emoji-picker-react**: For emoji support in the chat system.