# Vicious Esports Multi-Game Management Platform

## Overview

This application is a comprehensive multi-game esports management platform designed for "The Vicious" organization. It supports 29 different games, each with isolated data and multiple rosters (e.g., First Team, Academy, Women). The platform provides functionalities for team scheduling, event management, player and staff administration, role-based access control, a two-step registration approval workflow, team chat, statistics dashboards, and seasonal management. The project aims to streamline the operational aspects of a multi-game esports organization, enhancing efficiency and communication across various teams and titles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Game and Roster Structure
The platform features a centralized home page displaying roster-level cards grouped by game. Each game automatically includes three default rosters: First Team, Academy, and Women. Data is strictly isolated by `gameId` and `rosterId` to ensure independence between different games and rosters. Routes are prefixed by game slugs (e.g., `/:gameSlug/*`). Game icons are managed centrally, utilizing image assets where available and falling back to React icons for others. Each roster has a unique URL generated via composite slugs (e.g., `/valorant`, `/valorant_academy`). A `GameProvider` component manages the current game and roster context for all child components, ensuring API calls are correctly scoped.

### Authentication, Authorization, and Permissions
The system uses session-based authentication with `bcrypt` for password hashing. Registration involves a two-step approval process (game-level and organization-level) and leads to the creation of a display name with a game/roster suffix. A robust role-based access control system is implemented with roles like `super_admin`, `org_admin`, `game_manager`, `coach_analyst`, and `player`. A hierarchical permission system, enforced by rank guards, prevents lower-ranked users from modifying higher-ranked users. Granular permissions (32 types across 8 categories) are assigned to roles, and custom roles are supported. Banning a user at the organization level propagates to all their game assignments and invalidates sessions.

### Frontend and UI/UX
The frontend uses a modern sidebar layout with dark mode support and Shadcn UI components. The `AppSidebar` adapts its navigation based on whether the user is on the home page or within a specific game context. The home page (`GamesHome`) shows a clean full-width grid of roster cards grouped by game (no calendar/events — those live on the dedicated Calendar page). An `OrgDashboard` (accessible to `org_admin`) provides an overview of pending registrations, password reset requests, and roster details. The `CalendarPage` is full-width with a sidebar tab layout (Day events / Upcoming events tabs). The `RolesPage` has two tabs: "User Roles" (static display of Player/Staff/Management registration types with auto-assignment info) and "User Permissions" (CRUD for home permission roles with granular checkbox permissions that auto-save). Org-level settings, including organization name, logo, and a dynamic theme system that extracts colors from the uploaded logo, are managed on a dedicated `SettingsPage`.

### Core Features
- **Display Name System**: Automatically generates a unique display name for users based on their selected game and roster, while preserving their original username for login.
- **Role Management**: Allows for creation, editing, and deletion of roles with fine-grained control over permissions.
- **User and Game Access Management**: Comprehensive tools for managing users, their roles, and access to specific game rosters.
- **Chat System**: Channel-based messaging with file uploads, @mentions, URL detection, and support for video, audio, and attachments.
- **Activity Logging**: Detailed activity logs are maintained, with isolation for game-scoped and organization-level actions.
- **Forgot Password Flow**: Secure process for users to request password resets, managed by administrators.

### Database Structure
The database design incorporates core tables for users, games, and rosters, with extensive game-scoped tables (e.g., `players`, `events`, `schedules`) and roster-scoped tables (e.g., `attendance`, `staff_availability`), ensuring data integrity and isolation.

### Deployment
- **Target**: Autoscale deployment via Replit
- **Build**: `npm run build` (Vite frontend build + esbuild server bundle)
- **Run**: `npm run start` (Node.js production server at `dist/index.js`)
- **Static assets**: Served from `dist/public/`
- **Modules**: nodejs-20, web, postgresql-16 (no Python, no Playwright)
- **Note**: Removed `playwright`, `passport`, `next-themes` and 33 Chromium/X11 system packages that were causing deployment timeouts

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