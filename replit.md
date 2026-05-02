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
-   **Data Management**: Unique display names, activity logging, secure forgot password flow, and a dynamic event type system.
-   **Roster & Player Management**: Roster configuration, user-player linking, and attendance tracking for events.
-   **Game Configuration**: Per-roster configurable side definitions, hero pools, opponent management with logo uploads. Supports a per-team single-mode flag to simplify game mode presentation.
-   **Image Persistence**: All image uploads are handled via Replit Object Storage, generating short, stable URLs to avoid payload size issues.
-   **Opponent Idempotency**: Opponent creation is idempotent, preventing duplicate entries. Opponent cards display team logos and provide a "View Roster" button.
-   **Hero Role Management**: Per-game role definitions are managed with CRUD functionality, reordering, and enable/disable options. Renaming roles cascades updates, and deletion requires hero reassignment.
-   **Competitive Systems**:
    -   **Hero Ban System (HBS)**: Configurable, reusable per-roster presets with support for simple, rainbow_flexible, and custom modes, with editable action sequences and server-enforced limits.
    -   **Map Veto System (MVS)**: Configurable, reusable per-roster presets supporting ban, pick, decider, and side choice actions, with editable sequences and server-enforced limits.
-   **Statistics & Scoring**: Two-sided match stats with per-mode score configuration, multi-round scoring, and detailed player statistics.
-   **Media Library**: A super_admin feature aggregating all image URLs across the platform, including custom folders. Supports nested folders, search, and image uploads.
-   **Game Templates**: Reusable per-team configuration snapshots for games, including modes, maps, heroes, stats, and competitive systems. Applying a template is a destructive operation that wipes and re-initializes roster-scoped data.
-   **Draft & Scouting Analytics**: Roster-scoped Draft Stats page (Maps + Heroes tabs) aggregates `gameMapVetoRows`, `gameHeroBanActions`, and `gameHeroes` into ranked frequency lists with optional opponent filter, win-rate per map/hero, and drill-down popovers linking to source events. Opponent-specific Scouting Insights are surfaced inside each expanded opponent card on the Opponents page. Three new GET endpoints (`/api/hero-ban-actions`, `/api/map-veto-rows`, `/api/game-heroes`) are protected by `requireGameAccess` and auto-scoped via `GAME_SCOPED_PREFIXES`. Hero-play counts dedupe per (matchId, heroId, playerId/opponentPlayerId) to avoid multi-round inflation.
-   **User Experience**: In-app tutorial, schedule countdowns with timezone awareness, and robust data safety with no auto-deletion.
-   **Deployment & Development**: Designed for autoscale deployment, with startup scripts for idempotent bootstrapping.

### Database and Deployment
The platform uses PostgreSQL for its database, leveraging extensive game-scoped and roster-scoped tables. It is designed for deployment on platforms like Replit or Vercel/Neon, using Node.js 20 with PostgreSQL 16.

## External Dependencies

-   **PostgreSQL**: Primary database (via Neon serverless driver).
-   **bcryptjs**: For password hashing.
-   **express-session**: For session management.
-   **connect-pg-simple**: PostgreSQL session store.
-   **react-icons/si**: For fallback game icons.
-   **Shadcn UI**: Frontend component library.
-   **multer**: For file uploads.
-   **emoji-picker-react**: For emoji support in the chat system.