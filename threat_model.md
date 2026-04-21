# Threat Model

## Project Overview

This project is a production-deployed esports management platform built with a React/Vite frontend and a Node/Express + TypeScript backend backed by PostgreSQL via Drizzle. Auth is session-based (`express-session` with a PostgreSQL session store). The application manages organization-wide and roster-scoped data including users, roles, schedules, events, attendance, player statistics, chat messages, and uploaded media across many games and rosters.

Production scope for security scanning includes `server/`, `client/src/`, and `shared/`. The main production entry points are `server/index.ts`, `server/routes.ts`, `server/auth.ts`, and `server/storage.ts`. Important caveat: several seeding/bootstrap scripts in `server/` are production-reachable because `server/index.ts` invokes them at startup or exposes them through admin routes. Dev-only areas that should usually be ignored unless proven reachable are `take_screenshots.cjs`, `attached_assets/`, `screenshots_new/`, and Vite-only development helpers.

Assumptions carried into this threat model:
- Production runs with `NODE_ENV=production`.
- Replit deployment provides TLS termination for browser-to-platform traffic.
- Mockup sandbox behavior is not production-relevant unless reachable through production code paths.

## Assets

- **User accounts and sessions** — usernames, password hashes, role assignments, session cookies, session metadata, and approval status. Compromise enables impersonation and broad platform access.
- **Roster-scoped operational data** — players, staff, schedules, events, attendance, seasons, maps, stats, and notes. The platform’s core security promise is that users only access the games and rosters they are assigned.
- **Organization-wide administrative data** — roles, permissions, platform settings, org chat, approval queues, activity logs, and password reset workflows. Compromise lets an attacker reconfigure access or manipulate other users.
- **Uploaded files and media** — logos, game icons, chat attachments, and general uploaded objects stored under `uploads/`. These can contain sensitive internal media and, if mishandled, active content.
- **Application secrets and infrastructure access** — session secret, database connection details, Google or storage credentials, and environment-derived team identifiers.

## Trust Boundaries

- **Browser to Express API** — every request from the client is untrusted and must be authenticated, authorized, and validated server-side.
- **Authenticated user to privileged admin or manager actions** — org admins, super admins, and management actions must be strictly separated from ordinary players and staff.
- **Game or roster assignment boundary** — users may belong to one or more specific game/roster combinations; access to records in other rosters must be denied even within the same organization.
- **Server to PostgreSQL** — the backend has direct read/write access to all application data. Any missing server-side scoping or unsafe query path can expose or tamper with the whole organization dataset.
- **Server to local filesystem uploads** — files cross from untrusted users into a server-controlled storage area that is then publicly served under `/uploads`.
- **Startup and maintenance boundary** — bootstrap, seeding, and repair code in `server/` runs with full database privileges and is production-reachable through startup or admin routes.

## Scan Anchors

- Production entry points: `server/index.ts`, `server/routes.ts`, `server/auth.ts`, `server/storage.ts`, `shared/schema.ts`.
- Highest-risk code areas: session/auth setup, route-level permission checks, roster/game access enforcement, per-record CRUD handlers, startup seed/bootstrap flows, and upload/static-file handling.
- Public surfaces: `/api/auth/login`, `/api/auth/register`, `/api/forgot-password`, `/api/public-rosters`, `/health*`, static `/uploads/*`.
- Authenticated surfaces: nearly all `/api/*` CRUD routes, including calendar, chat, stats, events, roles, and settings.
- Admin surfaces: `/api/admin/*`, role management, approval flows, org settings, and bootstrap utilities.
- Usually ignore unless production reachability is shown: `take_screenshots.cjs`, `attached_assets/`, `screenshots_new/`, and built output under `dist/`.

## Threat Categories

### Spoofing

The application relies on username/password login and a server-side session cookie. It must ensure credentials are not predictable, seeded defaults do not exist in production, session secrets are stable and strong, and every protected route validates the session against the current team and user status. Any production bootstrap path that creates known accounts or weakens credentials breaks this guarantee.

### Tampering

Much of the application is editable operational data: schedules, events, attendance, player stats, maps, roles, and roster configuration. The server must enforce authorization on the specific target object being changed, not just on a broad permission string or query parameter supplied by the client. File uploads must also reject active or unexpected content types before they are stored and served.

### Information Disclosure

The platform contains roster-confined schedules, attendance, chat content, attachments, and org-level administrative information. API responses and file serving must only expose data to users assigned to the relevant roster or to appropriately privileged admins. Publicly served uploads, broad authenticated listing endpoints, and verbose logs are especially important review areas here.

### Denial of Service

The application exposes many list and write endpoints plus production-reachable startup/bootstrap routines. It must avoid letting ordinary requests trigger excessive database work, bulk seed operations, or unbounded file and media handling that can degrade service.

### Elevation of Privilege

The highest-risk failure mode is a user moving from their own roster into other rosters or into administrative powers by exploiting missing object-level checks. Routes that operate on `:id` path parameters, approval workflows, role changes, and settings changes must validate that the acting user is authorized for the referenced record and scope.