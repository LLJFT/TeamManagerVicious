# The Bootcamp
## Product Documentation

---

## Table of Contents

1. Project Overview
2. The Problem It Solves
3. Main Features
4. How the Platform Works
5. Page-by-Page Guide
6. Roles and User Types
7. Analytics and Statistics Value
8. Usage Guide / Getting Started
9. Strengths
10. Notes, Limitations, and Future Growth
11. Conclusion

---

## 1. Project Overview

The Bootcamp is a multi-game, multi-roster esports team management platform built for organizations that operate competitive teams across many titles. A single deployment hosts one organization (one tenant), inside which there can be many supported games and, within each game, several rosters (teams). All operational data — schedules, events, players, attendance, statistics, chat, opponents, draft picks, map vetoes — is strictly scoped by the combination of game and roster, so a player on one team does not see another team's information.

The platform is delivered as a web application. The backend is Node.js with Express and PostgreSQL (via Drizzle ORM and the Neon serverless driver). The frontend is React with Vite, Wouter for routing, TanStack Query for data, and the Shadcn UI component library on top of Tailwind CSS. Authentication is session-based with bcrypt-hashed passwords, sessions persisted in Postgres, and a hierarchical role-based access control system with 39 fine-grained permissions on top of five organizational roles.

The platform ships with a curated catalogue of 29 supported games, including Dota 2, Counter-Strike, VALORANT, Mobile Legends, League of Legends, Rocket League, PUBG Mobile, Overwatch, Rainbow Six, Apex Legends, Fighting Games, PUBG, Honor of Kings, Brawl Stars, Call of Duty, Marvel Rivals, EA Sports FC, Free Fire, Fortnite, Teamfight Tactics, CrossFire, Deadlock, Trackmania, The Finals, Warzone, eFootball, Free Fire Mobile, Honor of Kings Mobile, and Call of Duty Mobile. Per-game configuration covers maps, modes, sides, hero/champion pools, hero roles, hero ban systems, map veto systems, stat fields, event categories and sub-types, opponents, and reusable game templates.

---

## 2. The Problem It Solves

Esports organizations that run more than a handful of teams quickly outgrow general-purpose tools. Spreadsheets cannot enforce who is allowed to see which roster's data. Group chats lose context. Stat tracking spread across documents and screenshots becomes impossible to compare or trend. Tournament admins, coaches, analysts, and players each need a different view of the same week, and most off-the-shelf tools force them to share one.

The Bootcamp consolidates the day-to-day work of running competitive teams in one place:

- A single weekly availability and event view for every roster, with attendance tracked per event.
- Match results, per-map scoring, drafts, vetoes, and per-player statistics captured on the same screen as the event.
- Analytics that pivot the same source data into team, player, opponent, hero, map, draft, and trend views without re-entering anything.
- Tight access control so that managers, coaches, analysts, and players each see only the rosters and tools they are entitled to.
- A reusable game-template system so that adding a new team for a game does not require re-configuring its modes, maps, heroes, ban systems, stat fields, and event categories from scratch.

---

## 3. Main Features

- Multi-game, multi-roster organization with strict per-roster data isolation.
- Session-based authentication with bcrypt password hashing, two-step (game + organization) registration approval, and a forgot-password request workflow that admins resolve manually.
- Hierarchical role system: five organization roles (super_admin, org_admin/Management, game_manager, coach_analyst/Staff, player) plus three default custom permission roles (Management, Admin, Member) with 39 toggleable permissions across nine permission categories.
- Per-roster scheduling with configurable availability slots and player/staff availability tracking by day.
- Event management with categories, sub-types, color-coded calendar previews, attendance tracking, and per-event match capture.
- Per-event match capture: per-map score, sides, multi-round scoring, hero/champion drafts, hero bans, map vetoes, and per-player stat fields.
- Opponent management with logos, opponent rosters, opponent player stats, and idempotent creation that prevents duplicates.
- Configurable Hero Ban System (simple, rainbow_flexible, custom modes) and Map Veto System (ban / pick / decider / side choice) with reusable presets and server-enforced limits.
- Hero and hero-role configuration per game, including reordering, enable/disable, and bulk seeding.
- Game Templates: reusable per-team configuration snapshots that can seed new rosters with their roles, sides, event categories, modes, maps, stat fields, heroes, ban systems, veto systems, and opponents.
- Game Slug System for clean, normalized per-game URLs.
- A super-admin Media Library that aggregates and organizes all uploaded image URLs into nested folders with batch upload.
- Shared analytics filter bar (event type and date range) consistently applied across Trends, Map Insights, Hero Insights, Draft Stats, Team Comps, and Leaderboards.
- Roster-scoped chat (channels per roster) and an organization-wide management chat for super_admin and Management.
- Notifications, an activity log, in-app onboarding guides, language selector, dark mode, dynamic per-organization theming (primary color), and a configurable AFK overlay after 10 minutes of inactivity.
- Subscription gating with trial/paid types, manual override, expiry countdown banner, and a block screen for inactive accounts; super_admin always bypasses.
- File uploads (logos, game icons, chat attachments, general media) with extension allowlisting, magic-byte validation for images, and automatic quarantine of disallowed legacy uploads at startup.
- Idempotent startup migrations and bootstrap that create default rosters, availability slots, roster roles, event categories and sub-types, default staff, and chat channels per roster.

---

## 4. How the Platform Works

When a user signs in, the server validates the session against an active, non-banned, non-pending account. The frontend then loads the user's organization role, custom permissions, game and roster assignments, and current subscription status.

If the user is not a super_admin and the subscription status is not active, the application replaces the main view with a Subscription Block screen. Otherwise the main shell is rendered: a Shadcn sidebar on the left, a header with sidebar toggle, help button, notification bell, language selector, and theme toggle on top, and the routed page on the right.

Outside of a game context the sidebar shows organization-wide pages (Games, Overview, Calendar, Users, Roles, Game Access, Game Templates, Media Library, Subscriptions, Management Chat, Settings, Account). When the user opens a specific game (and roster, via slug), the URL becomes `/<game-slug>-<roster-slug>` and the sidebar switches to the game-context navigation organized into Main (Schedule, Events, Results, Players), Analytics (Statistics, Player Stats, History, Compare, Opponents, Draft Stats, Map Insights, Hero Insights, Trends, Team Leaderboard, Player Leaderboard, Team Comps), and Management (Dashboard, Staff, Chat).

Every API request is authenticated, then run through a global subscription gate (with an allowlist for auth, account, subscription, org-setting, and notifications endpoints), and finally checked for permission and roster scope. Non-admin users cannot read or modify records outside their assigned game(s) and roster(s), and they cannot reassign records into a different roster. Game-wide configuration writes additionally require a game-wide assignment.

The data model is intentionally narrow: tables for rosters, events, attendance, players, staff, games (matches), game modes, maps, sides, rounds, heroes, hero role configs, hero ban systems and actions, map veto systems and rows, opponents, opponent players, match participants, stat fields, player game stats, opponent player game stats, chat channels and messages, channel permissions, availability slots, roster roles, event categories and sub-types, settings, subscriptions, notifications, activity logs, and media folders/items. Every operational table carries `teamId`, `gameId`, and `rosterId` columns, and the server enforces them on every read and write.

---

## 5. Page-by-Page Guide

### Organization-level pages

**Games (`/`)** — Landing page after login. Lists the games the user has access to as cards. Selecting a game (and a roster within it) routes into the game context.

**Organization Dashboard (`/dashboard`)** — Cross-game overview for super_admin, org_admin (Management), and similar privileged roles. Surfaces high-level activity across all games and rosters.

**Calendar (`/calendar`)** — Full month/week calendar of events across the user's accessible rosters, with color-coded event categories and sub-types and timezone-aware countdowns.

**Users (`/users`)** — User CRUD for users with `view_users_tab` / `manage_users`. Approve or reject pending registrations, ban or reactivate users, edit display name, change organization role, assign a custom permission role, reset password, and inspect device/session info.

**Roles (`/roles`)** — Custom-role CRUD for users with `view_roles_tab` / `manage_roles`. Create roles and toggle the 39 permissions across the nine categories (Schedule, Events, Results, Players, Statistics, Chat, Staff, Dashboard, Home).

**Game Access (`/game-access`)** — For each user, manage game-level and roster-level assignments and the two-step approval state (`approval_game_status`, `approval_org_status`).

**Game Templates (`/game-templates`)** — Super-admin-only. List of reusable per-game configuration snapshots. A template captures roster roles, hero roles, sides, event categories and sub-types, modes, maps, stat fields, heroes, ban and veto systems, opponents, and opponent players.

**Game Template Editor (`/game-templates/:id`)** — Super-admin-only. Edit a single template's full configuration. Changes can later be applied to seed a new roster.

**Media Library (`/media-library`)** — Super-admin-only. Aggregates every image URL referenced by the platform into nested folders, with batch upload, rename, move, and delete support.

**Subscriptions (`/subscriptions`)** — Super-admin-only. Manage trial and paid subscriptions per user, set start and end date, apply a manual active override, and view current days remaining.

**Management Chat (`/org-chat`)** — Organization-wide chat reserved for super_admin and Management.

**Settings (`/settings`)** — Organization-level settings: org name, org logo, dynamic primary color theme, and other org-wide options.

**Account Settings (`/account`)** — Each user's own profile, password change, and personal preferences.

**Help (`/help`)** — In-app documentation and onboarding entry points.

### Game-context pages (under `/<game>-<roster>/...`)

**Schedule / Home (`/`)** — The roster's weekly schedule and availability board, using the per-roster availability slots and roster roles.

**Events (`/events`)** — List and create events for the roster. Events use the roster's event categories and sub-types.

**Event Details (`/events/:id`)** — Full event view: attendance, per-map games, drafts, hero bans, map vetoes, sides, rounds, scores, and per-player stats for that match. This is where most match data is captured.

**Events Results (`/results`)** — Recent results view, filtered to the current roster.

**History (`/history`)** — Long-form match history with filtering and drill-down.

**Players (`/players`)** — Roster CRUD for players, including IGN, role, optional linked user account, and per-player notes.

**Statistics — Unified Stats (`/stats`)** — Top-level analytics surface for the roster, combining per-game match data into the standard win/loss/score views; uses the shared analytics filter bar.

**Player Stats (`/player-stats`)** — Per-player aggregated statistics built from the captured stat fields across games.

**Compare (`/compare`)** — Side-by-side comparison of players, opponents, or time ranges across the captured stats.

**Opponents (`/opponents`)** — Opponent management with logos, opponent rosters, head-to-head results, and per-opponent stats.

**Draft Stats (`/draft-stats`)** — Roster-scoped draft and scouting analytics: most-picked and most-banned heroes, ranked frequency lists with win rates, and drill-down by opponent and map.

**Map Insights (`/map-insights`)** — Per-map analytics: win rates by side, pick/ban frequency, score breakdowns.

**Hero Insights (`/hero-insights`)** — Per-hero analytics: priority scores, ban efficiency, meta presence, and roster-specific hero performance.

**Trends (`/trends`)** — Monthly performance trends across the roster's matches.

**Team Leaderboard (`/team-leaderboard`)** — Ranked team statistics by opponent, map, game mode, and event type.

**Player Leaderboard (`/player-leaderboard`)** — Ranked per-player statistics, with hero-specialization insights.

**Team Comps (`/comps`)** — Team composition analytics: which combinations of heroes/champions are played together and how they perform.

**Dashboard (`/dashboard`)** — Per-roster management dashboard for users with `view_dashboard`, surfacing roster-level operational state.

**Staff (`/staff`)** — Roster CRUD for staff, including role and availability tracking.

**Chat (`/chat`)** — Roster chat with multiple channels (default: General, Strategy, Announcements) and per-channel permissions.

**Note** — The repository also contains earlier per-mode stat pages (`SeasonStats`, `MonthlyStats`, `TournamentStats`, `ScrimStats`, `OverallStats`, `Stats`, `EventsHistory`, `Settings`) that have been superseded by the unified analytics surface above and are no longer linked from the active sidebar.

---

## 6. Roles and User Types

The Bootcamp uses two layers of access control: an organization role (a single role per user) and an optional custom permission role (the granular toggle set), combined with per-game and per-roster assignments. Super admins always bypass permission checks.

### Organization roles

| Org Role | Label in UI | Scope |
|---|---|---|
| `super_admin` | Super Admin | Full bypass of all permission checks and the subscription gate. Unique platform owner role. |
| `org_admin` | Management | Organization-wide administrative privileges, including users, roles, game access, settings, and management chat. |
| `game_manager` | Game Manager | Game-wide privileges across the rosters they are assigned to within a specific game. |
| `coach_analyst` | Staff | Roster-level operational role for coaches and analysts. |
| `player` | Player | Default role for players; sees and edits only their own roster context. |

### Default custom permission roles

| Role | Default Permissions |
|---|---|
| Management | All permissions except `manage_roles`-style platform overrides — created at bootstrap as the owner role with the full permission set. |
| Admin | All permissions except `manage_roles`. |
| Member | No permissions by default; opt-in only. |

### Permission categories (39 permissions total)

- **Schedule** — view_schedule, edit_own_availability, edit_all_availability, manage_schedule_players
- **Events** — view_events, create_events, edit_events, delete_events
- **Results** — view_results, add_results, edit_results, delete_results
- **Players** — view_players, manage_players_tab
- **Statistics** — view_statistics, view_player_stats, view_history, view_compare, view_opponents
- **Chat** — view_chat, send_messages, delete_own_messages, delete_any_message, manage_channels
- **Staff** — view_staff, manage_staff
- **Dashboard** — view_dashboard, manage_users, manage_roles, manage_game_config, manage_stat_fields, view_activity_log
- **Home** — view_calendar, view_upcoming_events, view_users_tab, view_roles_tab, view_game_access, view_settings, manage_settings

### Game and roster assignment

Each user has zero or more `user_game_assignments`, each carrying a game, an optional roster (null means game-wide), an assigned role, and a two-step approval state (`approval_game_status` and `approval_org_status`). Game-wide configuration writes require a game-wide assignment; super_admin and org_admin bypass this.

### Rank guard

For destructive admin actions on other users (ban, role change, password reset), the server compares organizational and system role ranks and refuses any action that targets a user of equal or higher rank.

---

## 7. Analytics and Statistics Value

All analytics on the platform are derived from the same source data captured on the Event Details page: each match, its per-map games, drafts, hero bans, map vetoes, sides, multi-round scores, and per-player stat fields. There is no separate stats-entry workflow to keep in sync.

This shared data feeds:

- **Unified Stats** — overall roster performance.
- **Player Stats and Player Leaderboard** — per-player aggregations and rankings, including hero specialization.
- **Compare** — head-to-head and player-vs-player comparisons.
- **Opponents** — head-to-head records and per-opponent breakdowns.
- **Draft Stats** — most-picked, most-banned, and ban efficiency, drilled down by opponent and map.
- **Map Insights** — win rates by side, score distributions, pick/ban frequency per map.
- **Hero Insights** — priority scores, ban efficiency, meta presence.
- **Trends** — monthly performance over time.
- **Team Leaderboard and Team Comps** — ranked team performance and composition analytics.

A shared analytics filter bar (event type and date range) is applied consistently across these views so a coach can isolate, for example, only Tournament games over the last 30 days and have every analytics surface respond the same way.

For organizations the practical value is that match preparation, scouting, vod review, and post-mortem can all be done against the same evolving dataset, scoped to a single roster, without spreadsheets.

---

## 8. Usage Guide / Getting Started

### First-time setup (administrator)

1. Deploy the platform (see `DEPLOYMENT.md` for Replit Autoscale or Vercel + Neon).
2. Set `ADMIN_INITIAL_PASSWORD` before the first production start. On first start the server creates the default `Admin` user, the three default roles (Management, Admin, Member), and assigns the admin to every supported game.
3. Log in as `Admin`, immediately change the password from Account Settings, and open Settings to set the organization name, logo, and primary color.
4. Open Game Templates and either edit the existing per-game templates or leave them at their defaults.
5. The platform automatically creates four default rosters per game (Team 1 to Team 4) on first access, each pre-seeded with availability slots, roster roles, event categories and sub-types, default staff, and chat channels.

### Onboarding a user

1. The new user signs up from the login page.
2. Two approvals are required in `user_game_assignments`: a game-level approval and an organization-level approval. Use the Game Access page to grant the user access to specific games and rosters and the Users page to set their organization role and custom permission role.
3. The user can then log in, see the games they have been granted access to from the Games page, open a roster, and start using Schedule, Events, and Players.

### Day-to-day for a coach or manager

1. Open the relevant game and roster from the Games page.
2. Use Events to create the week's scrims, tournaments, and meetings.
3. Use Event Details to record attendance, match score, drafts, bans, vetoes, and per-player stats once the match is played.
4. Use Players, Staff, and Chat for roster operations.
5. Use the analytics pages (Unified Stats, Draft Stats, Hero Insights, Map Insights, Trends, Leaderboards, Team Comps, Compare) to prepare for upcoming opponents and review past performance.

### Day-to-day for a player

1. Sign in and open their assigned roster.
2. Update their availability for the week on the Schedule.
3. Check Events for upcoming scrims and tournaments.
4. Use Chat to coordinate with the team.

---

## 9. Strengths

- **Truly multi-game and multi-roster.** A single deployment cleanly supports many games and many teams per game without leaking data between them.
- **One source of truth for match data.** Drafts, bans, vetoes, scores, and per-player stats are captured once on the event and feed every analytics view.
- **Granular but legible access control.** Five organization roles, three default custom roles, and 39 permissions cover practical scenarios without forcing administrators to design RBAC from scratch.
- **Designed for esports specifically.** First-class support for hero pools, hero roles, hero ban systems, map veto systems, sides, multi-round scoring, and opponent rosters — not retrofitted onto a generic team tool.
- **Fast onboarding for new teams.** Default rosters, default categories, default staff, default chat channels, plus reusable Game Templates make standing up a new team a few clicks rather than hours of configuration.
- **Production-conscious.** Idempotent startup migrations, allowlisted/magic-byte-validated uploads, quarantine of legacy disallowed files, session-based auth with bcrypt, subscription gating, activity logging, and a documented threat model.

---

## 10. Notes, Limitations, and Future Growth

- **Single-tenant per deployment.** The platform isolates data by `teamId`, but each deployment is intended for one organization. Hosting multiple unrelated organizations requires multiple deployments.
- **Local file uploads.** Uploaded files (logos, game icons, chat attachments, general media) are stored under `./uploads/` on the local filesystem. On serverless hosts these are ephemeral; production deployments should configure Replit Object Storage or an S3-compatible bucket.
- **Default admin password in non-production.** Outside production, the bootstrap will print a one-time temporary password to the logs if `ADMIN_INITIAL_PASSWORD` is not set. Production refuses to start without it.
- **Analytics filter convergence.** A number of older per-mode stat pages (Season, Monthly, Tournament, Scrim, Overall, generic Stats, Events History, generic Settings) still exist in the codebase but are no longer surfaced in the active navigation; the unified analytics views should be preferred.
- **Future growth (clearly labelled, not yet implemented).** Likely directions include a mobile companion app, OCR-based scoreboard ingestion to reduce manual stat entry, broader integration with streaming and tournament platforms, and additional automated insights on top of the existing data model.

---

## 11. Conclusion

The Bootcamp gives an esports organization a single, opinionated home for the operational work of running competitive teams across many games. By scoping every record to a roster, capturing match data in one place, and enforcing a predictable role and permission model on top, it removes the spreadsheets-and-screenshots pattern that breaks down once an organization has more than a couple of teams. Coaches, analysts, managers, and players each get the slice of the same dataset they need to do their job, and the analytics, opponent intelligence, and templating systems compound that data into something each team can actually use to prepare for the next match.

This document was written from the current source of the platform and only describes features that exist in the codebase today.
