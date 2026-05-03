# Vicious Esports Multi-Game Management Platform

## Overview
The Vicious Esports Multi-Game Management Platform is a comprehensive system designed for "The Vicious" organization to centralize and streamline operations across 29 games, managing 116 teams. Its primary purpose is to provide a unified solution for team scheduling, event management, player/staff administration, and robust access control within a large-scale, multi-game esports environment. The platform offers capabilities like team chat, statistics dashboards, and seasonal management to enhance organizational efficiency and competitive performance.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The platform is built on a multi-game and multi-roster architecture, ensuring strict data isolation by `gameId` and `rosterId`. It implements session-based authentication with `bcrypt` for secure password hashing and a two-step registration approval process. A hierarchical role-based access control system (`super_admin`, `org_admin`, `game_manager`, `coach_analyst`, `player`) manages granular permissions across 39 types.

The frontend utilizes Shadcn UI components within a modern sidebar layout, supporting dark mode for a consistent user experience. Key UI elements include dynamic navigation, roster card displays, an organization dashboard, and a calendar with color-coded event previews. User and permission management are handled via a CRUD interface, and a settings page allows for organization-level configurations including dynamic theming. Loading skeletons are integrated to improve user experience.

Core features include unique display names, activity logging, a secure forgot password flow, and a dynamic event type system. Roster and player management support flexible configuration, user-player linking, and attendance tracking. Game configurations allow for per-roster side definitions, hero pools, and opponent management with logo uploads. Opponent creation is idempotent, preventing duplicates. Hero role management offers CRUD functionality with reordering and enable/disable options.

Competitive systems include a configurable Hero Ban System (HBS) with reusable presets (simple, rainbow_flexible, custom modes) and a Map Veto System (MVS) supporting ban, pick, decider, and side choice actions with editable sequences and server-enforced limits. Statistics and scoring support two-sided match stats with per-mode score configuration and multi-round scoring. A Media Library provides `super_admin` access to aggregate and manage all image URLs, supporting nested folders and batch uploads. Shared analytics filters (`AnalyticsFilterBar` + `useAnalyticsFilters` + `applyAnalyticsFilters`) are available for event type and date scoping across various statistical views like Trends, Map Insights, Hero Insights, Draft Stats, and Team Leaderboard.

The platform includes a "Load Example Data" feature for `super_admin`s to seed rosters with rich, template-driven data, supporting full template fidelity for game configurations, opponents, players, heroes, and competitive system presets. It also features Game Templates for reusable per-team configuration snapshots and a Game Slug System for unique, normalized game URLs. A robust Dataset/Seed System automatically seeds new rosters based on explicit templates or curated defaults. Draft & Scouting Analytics provide roster-scoped insights into maps, heroes, and bans, aggregating data into ranked frequency lists with win-rates and drill-down capabilities. Leaderboards (Team and Player) offer ranked statistics by opponent, map, game mode, and event type, with detailed player stats and hero specialization insights. Overlay scroll containment has been implemented across all Shadcn UI primitives to ensure proper scrolling within long content without affecting the main page. Map, Hero, and Trend Insights provide advanced statistical analysis, including win-rates by side, hero priority scores, ban efficiency, meta presence, and monthly performance trends. User experience features include in-app tutorials, timezone-aware schedule countdowns, and robust data safety. The system is designed for autoscale deployment with idempotent bootstrapping scripts.

The backend uses Node.js 20 with PostgreSQL 16.

## External Dependencies

-   **PostgreSQL**: Primary database (via Neon serverless driver).
-   **bcryptjs**: For password hashing.
-   **express-session**: For session management.
-   **connect-pg-simple**: PostgreSQL session store.
-   **react-icons/si**: For fallback game icons.
-   **Shadcn UI**: Frontend component library.
-   **multer**: For file uploads.
-   **emoji-picker-react**: For emoji support.