# Marvel Rivals Roster Attendance Manager

## Overview

This application is a comprehensive team management platform designed for "The Vicious" Marvel Rivals esports team. Its primary purpose is to streamline team operations, enhance communication, and provide robust tools for tracking player availability, managing events, analyzing performance, and administering team resources. Key capabilities include persistent availability scheduling, an events calendar with game tracking, player and staff management, role-based access control with user authentication, a Discord-style team chat, statistics dashboards, and seasonal management. The project aims to provide a centralized hub for all team-related activities, ensuring efficient coordination and strategic decision-making for esports organizations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Authentication & Authorization
The system uses session-based authentication with `bcrypt` for password hashing, leveraging `express-session` and `connect-pg-simple`. A default admin account is provided, and new registrations require administrative approval. A robust role-based access control (RBAC) system is implemented, featuring Owner, Admin, and Member roles, alongside custom roles with 32 granular permissions across 8 categories (Schedule, Events, Results, Players, Statistics, Chat, Staff, Dashboard). All API routes are protected by `requireAuth` middleware, checking user status and banning users as necessary, while write operations are further secured with `requirePermission` middleware. User login tracks `lastSeen` and `lastUserAgent`.

### Permission System
A detailed permission system with 32 granular permissions grouped into 8 categories: Schedule, Events, Results, Players, Statistics, Chat, Staff, and Dashboard. This allows for fine-grained control over user actions and data access.

### Frontend Layout and Key Pages
The frontend utilizes a modern sidebar navigation built with Shadcn, organized into Main, Analytics, and Management groups. An `AuthProvider` and `useAuth` hook manage user state and permissions, dynamically filtering sidebar items. Key pages include:
- `/`: Availability Schedule
- `/events`: Events Calendar and details
- `/results`: Event results
- `/players`: Player management
- `/staff`: Staff management
- `/chat`: Discord-style team chat
- `/dashboard`: Administrative panel (Game Config, Team, Users, Roles, Stat Fields, Activity)
- `/stats`, `/player-stats`, `/history`, `/compare`, `/opponents`: Various statistics and analytics views
- `/account`: User account settings

### Chat Features
The integrated chat system supports channel-based messaging, file uploads via object storage (using presigned URLs), @mentions with autocomplete, clickable URL detection, and user role display. It includes permissions for viewing, sending, and deleting messages (own or any), and renders video attachments and provides download links for other file types.

### Session Management
Users can view their active login sessions on the Account Settings page, showing device info and expiration. Non-current sessions can be terminated individually. Admins can terminate all sessions for any user via the Dashboard. Device info (OS + browser) is parsed from user-agent and stored in the session object on login.

### Activity Logging
Key actions are automatically logged with dual log types: "team" (operational actions) and "system" (logins, user management). The dashboard provides separate Team Activity and System Log tabs with filters for text, action type, and user. Owner-only delete route supports clearing logs by type.

### Online/Offline Status & AFK
Users are considered online if `lastSeen` is within 2 minutes. The Dashboard Users tab shows green/gray indicators with device info. An AFK overlay activates after 10 minutes of inactivity (mousemove/keydown/touchstart/scroll reset the timer) and is dismissed with any interaction.

### Username Management
Case-insensitive unique username enforcement using `ilike` at all mutation points (register, admin create, account settings, admin rename). Admins can rename users via a Dashboard dialog.

### UI/UX and Theming
The application features a modern, bright, and energetic theme with a color scheme of vibrant blues, teals, and coral accents. The design prioritizes a professional, clean interface with consistent spacing and UI elements. Dark mode support is integrated.

### Feature Specifications
- **Schedule**: Persistent availability tracking with relational tables for players and staff.
- **Events**: Calendar display, event duplication, and `OFF` days feature.
- **Results**: Dedicated page for viewing event outcomes, including smart event classification, result badges, and type badges.
- **Player/Staff Management**: Dynamic roster roles and full CRUD operations.
- **Statistics**: Multiple dedicated pages (`overall`, `scrim`, `tournament`, `season`, `monthly`, `player-stats`, `history`, `compare`, `opponents`) with filtering, dynamic stat fields, and performance comparisons.
- **Team Notes**: Message-based communication system with real-time updates.
- **Game Management**: Detailed event pages with game-level tracking, scores, and scoreboard image uploads.

### System Design Choices
- **Data Isolation**: All database tables are isolated by `teamId` (based on `REPL_ID`), ensuring that each Replit instance operates with completely separate data.
- **Performance**: Optimized data fetching for statistics pages, using consolidated API endpoints and avoiding N+1 query patterns.
- **File Uploads**: Direct file uploads for scoreboard images using Replit Object Storage via Uppy, storing paths in the database.
- **Defensive Programming**: Case-insensitive comparisons for filtering and robust handling of data.

## External Dependencies

- **PostgreSQL**: Primary database for all application data.
- **Replit Object Storage**: Used for storing uploaded scoreboard images and chat files, accessed via presigned URLs.
- **Uppy**: Frontend library for robust file upload functionality.
- **`express-session`**: Middleware for session management.
- **`connect-pg-simple`**: PostgreSQL-backed session store.
- **`bcrypt`**: For secure password hashing.
- **Shadcn UI**: Component library for frontend UI development.