# Marvel Rivals Roster Attendance Manager

## Overview

This application serves as a permanent team availability tracker for "The Vicious" Marvel Rivals esports team. Its core purpose is to enable team managers to track player availability for practice sessions across Tank, DPS, and Support roles. Key features include a persistent Monday-Sunday schedule, real-time synchronization with Google Sheets, inline editing, a dedicated events calendar for tournaments and scrims with comprehensive event details tracking, enhanced player management with personal information and attendance tracking, and a team notes messaging system. The design follows a modern, bright, and energetic theme with vibrant blues, teals, and coral accents for a clean, professional UI. The project aims to provide a robust, year-round solution for esports team management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **Enhanced Features Implementation** (December 2, 2025): Major UI/UX improvements
  - **OFF Days Calendar Feature**: Mark dates as OFF days on the Events calendar
    - OFF days display with moon icon and gray styling on calendar
    - Toggle button in selected date panel to mark/unmark OFF days
    - OFF days automatically hidden when events exist on that date
    - New `offDays` database table with teamId isolation
    - API endpoints: GET/POST/DELETE `/api/off-days`
  - **Event Duplication**: Copy button on each event card to duplicate events
    - Copies event title (with " (Copy)" suffix), type, date, time, and games
    - API endpoint: POST `/api/events/:id/duplicate`
  - **History Page** (`/history`): Advanced event filtering and browsing
    - Filters: Season, Month, Game Mode, Map, Sort Order
    - Pagination with customizable items per page
    - Quick stats per filtered results
  - **Compare Page** (`/compare`): Season and month comparison tools
    - Side-by-side performance comparison between two periods
    - Win rate, total games, wins/losses breakdown
    - Visual progress bars for comparison
  - **Opponent Stats Page** (`/opponents`): Performance analytics by opponent
    - Aggregated stats per opponent team
    - Best modes and worst maps analysis
    - Win rate trends per opponent
  - **Navigation**: New buttons on Home page for History, Compare, Opponents
  - **Multi-Theme Dark Mode System**: Professional dark-only theme selector
    - 5 distinct visual themes: Classic Dark (default), Midnight Blue, Crimson Edge, Soft Shadow, Carbon Black
    - ThemeSelector dropdown replaces old ThemeToggle (no light mode)
    - Theme persists across sessions via localStorage key "ui-theme"
    - CSS variables system in index.css with .theme-* modifier classes
    - Themes apply globally across all pages and components
- **Season & Monthly Stats Pages** (December 2, 2025): New stats filtering capabilities
  - `/stats/season` - Statistics filtered by selected season with full breakdown
  - `/stats/monthly` - Statistics filtered by selected month with full breakdown
  - Season selector shows all configured seasons with descriptions
  - Month selector auto-populates from events with dates
  - Both pages include: Event Performance, Game Performance, By Game Mode, By Map breakdowns
  - Navigation links added to all existing stats pages (Overall, Scrim, Tournament)
  - Season description field added to seasons table and Settings UI
- **Complete Data Isolation Implementation** (December 2, 2025): Critical multi-team support
  - Added `teamId` column to ALL database tables (players, events, games, attendance, team_notes, schedules, settings, game_modes, maps, seasons)
  - Storage layer automatically filters all queries by `REPL_ID` environment variable
  - All write operations automatically inject `teamId` for the current instance
  - Each Replit remix/fork operates with completely isolated data
  - Existing data backfilled with current REPL_ID
  - Zero cross-team data leakage guaranteed
- **UI Polish & Defensive Case Normalization** (November 28, 2025): Professional COD-style UI refinements
  - Quick Stats cards moved from Home page to OverallStats page for cleaner home interface
  - Settings page redesigned with professional two-panel layout (Game Modes | Maps)
  - Events calendar colors updated with proper dark mode support using theme tokens
  - All event type filtering now uses case-insensitive `.toLowerCase()` comparison for robustness
  - Consistent spacing and CTA alignment across all pages
- **Modern Theme & UI Improvements** (November 27, 2025): Complete redesign with bright, energetic theme
  - New color scheme: Vibrant blues, teals, coral accents - no more dark/yellow Marvel theme
  - Weekly Availability Overview component integrated into Home page
  - Removed Export button functionality
  - Updated password gate button to use theme colors
- **3 Separate Stats Pages with Optimized Data Fetching** (November 27, 2025): Split statistics into dedicated pages
  - `/stats/overall` - Combined performance across all events (Overall, By Mode, By Map tabs)
  - `/stats/scrim` - Scrim-specific statistics (Overall, By Mode, By Map tabs)
  - `/stats/tournament` - Tournament-specific statistics (Overall, By Mode, By Map tabs)
  - Navigation links between all three stats pages
  - Updated Home page Stats button to link to /stats/overall
  - **Performance fix**: Consolidated GET /api/games endpoint with JOIN query returns games with eventType in single request
  - Optional `scope` query parameter (?scope=scrim|tournament) for filtered results
  - Eliminated N+1 fetch pattern (was making separate API call per event)
- **Reset to Marvel Rivals Defaults** (November 27, 2025): Settings page enhancement
  - New "Reset to Marvel Rivals Defaults" button in Settings page
  - Populates 3 default game modes: Domination, Convoy, Convergence
  - Populates 12 default maps: 4 maps per mode (Birnin T'Challa, Celestial Husk, etc.)
  - API endpoint: POST /api/reset-defaults

- **Direct File Upload for Scoreboard Images** (November 3, 2025): Replaced URL input with direct file upload using Replit Object Storage
  - Implemented ObjectUploader component using Uppy v5.x with dashboard modal interface
  - File upload flow: Client requests presigned URL → uploads to storage → stores path in database
  - Image serving via GET /objects/:objectPath endpoint with proper caching headers
  - Uppy configuration: Single file upload, 10MB max size, image files only
  - Memory leak prevention: Added useEffect cleanup to properly dispose Uppy instances on unmount
  - Object storage setup: Default bucket with public search paths and private directory
  - API endpoints: POST /api/objects/upload (presigned URL generation)
  - Games table imageUrl stores object paths (e.g., /objects/uploads/{uuid})
- **Events Results Page** (November 3, 2025): New dedicated page for viewing event outcomes
  - New `/results` route displaying upcoming and past events with filtering
  - Smart event classification: Same-day events with future times appear in "Upcoming"
  - Events without time treated as upcoming if date is today or future
  - Upcoming events sorted chronologically (earliest first)
  - Past events sorted reverse chronologically (most recent first)
  - Result badges: Win (default variant), Loss (destructive), Draw (secondary), Pending (outline)
  - Event type badges with color coding: Tournament (yellow), Scrim (blue), VOD Review (purple)
  - Navigation: "Results" button added to Home page toolbar
  - Display format: Date as "MMM dd, yyyy", opponent name, result badge, event type badge
  - Eye icon button navigates to full event details page
- **Event Details Page - English Conversion & Image Support** (November 3, 2025): Comprehensive event tracking with game results and scoreboard images
  - New `/events/:id` route for detailed event information
  - All UI text converted to English (labels, buttons, placeholders, toasts)
  - Event details form: result (win/loss/draw/pending), opponent name, notes
  - Games management: add, edit, delete individual games with codes, scores, and scoreboard images
  - Scoreboard table: displays all games with codes, results, and image viewer
  - Image viewing modal: click "View" button to see full scoreboard images
  - Navigation: Eye icon button on Events calendar leads to details page
  - Schema updates: `events` table with result/opponentName/notes, `games` table with eventId (FK), gameCode, score, imageUrl
  - API endpoints: GET /api/events/:eventId/games, POST/PUT/DELETE /api/games/:id
  - Full CRUD permissions: Users can delete or edit any event detail or game
- **Team Notes Messaging System** (November 3, 2025): Implemented message-based team communication
  - Message posting interface: Users enter their name and message content
  - Chronological message table: Shows sender, message, timestamp, and delete action
  - Accurate timestamps: Generated at submission time (not component mount) with second-level precision
  - Timestamp display: Format "MMM dd, yyyy" and "hh:mm:ss a" shows exact send time
  - Real-time updates: Messages appear immediately with automatic cache invalidation
  - Schema: `team_notes` table with senderName, message, timestamp (ISO format)
  - API endpoints: GET/POST/DELETE for team notes management
