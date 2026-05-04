# THE BOOTCAMP Multi-Game Management Platform

## Overview
The Bootcamp Multi-Game Management Platform is a comprehensive system designed to centralize and streamline operations for a large-scale, multi-game esports organization. It manages 29 games and 116 teams, providing unified solutions for team scheduling, event management, player/staff administration, and robust access control. Key capabilities include team chat, statistics dashboards, and seasonal management, all aimed at enhancing organizational efficiency and competitive performance. The platform uses the BOOTCAMP brand identity system, featuring a dark-themed UI with multiple theme options.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The platform operates on a multi-game and multi-roster architecture, ensuring strict data isolation per `gameId` and `rosterId`. It features session-based authentication with `bcrypt` for secure password hashing and a two-step registration approval process. A hierarchical role-based access control system (`super_admin`, `org_admin`, `game_manager`, `coach_analyst`, `player`) manages granular permissions across 39 types.

The frontend is built with Shadcn UI components, offering a modern sidebar layout and consistent dark mode experience. UI elements include dynamic navigation, roster card displays, an organization dashboard, a color-coded calendar, and loading skeletons for improved user experience. User and permission management are handled via a CRUD interface, with organization-level configurations including dynamic theming.

Core features encompass unique display names, activity logging, a secure forgot password flow, and a dynamic event type system. Roster and player management support flexible configuration, user-player linking, and attendance tracking. Game configurations allow for per-roster side definitions, hero pools, and opponent management with logo uploads. Hero role management provides CRUD functionality with reordering.

Competitive systems include a configurable Hero Ban System (HBS) with reusable presets and a Map Veto System (MVS) supporting various actions with editable sequences. Statistics and scoring support two-sided match stats with per-mode score configuration and multi-round scoring. A Media Library provides `super_admin` access for managing image URLs, supporting nested folders and batch uploads. Shared analytics filters enable event type and date scoping across views like Trends, Map Insights, Hero Insights, Draft Stats, and Team Leaderboard.

The platform includes a "Load Example Data" feature for `super_admin`s to seed rosters with template-driven data, supporting full template fidelity for game configurations and competitive system presets. It also features Game Templates for reusable team configuration snapshots and a Game Slug System for unique game URLs. A robust Dataset/Seed System automatically seeds new rosters based on templates or defaults. Draft & Scouting Analytics provide roster-scoped insights into maps, heroes, and bans, aggregating data into ranked frequency lists with win-rates. Leaderboards (Team and Player) offer ranked statistics by various criteria, with detailed player stats and hero specialization insights. Overlay scroll containment is implemented for all Shadcn UI primitives. Map, Hero, and Trend Insights provide advanced statistical analysis, including win-rates by side, hero priority scores, ban efficiency, meta presence, and monthly performance trends. User experience features include in-app tutorials, timezone-aware schedule countdowns, and robust data safety. The system is designed for autoscale deployment with idempotent bootstrapping scripts.

The backend uses Node.js 20 with PostgreSQL 16.

The OCR Scoreboard Ingestion system uses GPT-4o Vision as the primary extractor, with Tesseract as a fallback. It uses per-game prompts to extract data from scoreboard images, with specific validation and evaluation steps to ensure data quality. The review UI allows coaches to assign players and heroes manually, ensuring accuracy. An `imported_via_ocr_scan_id` audit column tracks imported data. The system prioritizes "extract-what-exists / never-invent," meaning missing values remain `null` and are never guessed or auto-filled. The event result settling mechanism uses `result_source` and `last_game_change_at` columns to manage automatic and manual result computations, with a 5-minute settle window for auto-computation.

## External Dependencies

-   **PostgreSQL**: Primary database (via Neon serverless driver).
-   **bcryptjs**: For password hashing.
-   **express-session**: For session management.
-   **connect-pg-simple**: PostgreSQL session store.
-   **react-icons/si**: For fallback game icons.
-   **Shadcn UI**: Frontend component library.
-   **multer**: For file uploads.
-   **emoji-picker-react**: For emoji support.
-   **GPT-4o Vision (OpenAI API)**: Primary engine for OCR scoreboard ingestion.