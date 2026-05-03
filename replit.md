# Vicious Esports Multi-Game Management Platform

## Overview
The Vicious Esports Multi-Game Management Platform is a comprehensive system designed for "The Vicious" organization to centralize and streamline operations across 29 games, managing 116 teams. Its primary purpose is to provide a unified solution for team scheduling, event management, player/staff administration, and robust access control within a large-scale, multi-game esports environment. The platform offers capabilities like team chat, statistics dashboards, and seasonal management to enhance organizational efficiency and competitive performance.

## Brand Identity
The product ships with the **Vicious** brand identity system (v1.0). Source files, logos, extensions, and the full guidelines (markdown + PDF) live under `brand/`. Core tokens: Crimson primary `#E11D2E` (HSL 354 75% 50%), Onyx background `#0E1117`, Carbon cards `#1A1F2A`, Steel `#5B6573`, Bone `#F5F6F8`, Signal amber `#F59E0B`. Typography is a single Inter family with weight-driven hierarchy. The web app reads these tokens from `client/src/index.css` (`:root`, `.dark`, and `.theme-default-dark`). The favicon is `client/public/vicious-favicon.svg`. The in-product V mark is `client/src/components/VicLogo.tsx`. Rebuild the brand PDF with `node scripts/build-brand-pdf.mjs`.

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
## OCR Scoreboard Ingestion (hardened May 2026)
- Upload pipeline at `POST /api/games/:matchId/ocr-scans` enforces three gates before any persistence: (1) extension allowlist (jpg/jpeg/png/webp/bmp) via multer fileFilter, (2) magic-byte check via `hasValidMagicBytes`, (3) post-OCR `evaluateScoreboardSignal()` heuristic in `server/ocr.ts` — requires enough words/numerics AND a strong scoreboard anchor (score pattern, ≥2 matched players, ≥2 heroes, or matched map) at confidence ≥0.45. Rejected uploads return 422 with structured `{error,reason,confidence,signals,message}` and do NOT persist any scan or upload to object storage.
- `POST /api/ocr-scans/:id/confirm` now defaults to **merge** mode: only inserts heroes/participants/stats whose `(side, player, …)` tuple isn't already present, preserving existing rows; re-confirming the same scan or re-uploading the same match is idempotent. Pass `{overwrite:true}` for legacy wipe-and-replace. Game scores are written only when missing OR `overwrite=true`. Response shape: `{ok, mode, scan, counts, skipped}` (counts and skipped both include `opponentStats`).
- `PATCH /api/ocr-scans/:id` zod-validates the `editedCandidate` payload via `ocrParsedCandidateSchema` from `shared/schema.ts`.
- `DELETE /api/ocr-scans/:id` marks a scan as `discarded` (image kept for audit) — surfaced as a "Discard scan" button in `client/src/pages/OcrScanReview.tsx`.
- Review UI shows a per-row OCR + confidence badge (High/Med/Low based on fuzzy-match avg), a scan-level scoreboard-validation badge, a low-confidence banner when any row is below 50%, and an explicit "Replace existing" toggle that switches the confirm button to a destructive-styled "Replace & import".

### Extract-first / map-later (May 2026 follow-up)
- The parser in `server/ocr.ts` no longer guesses team membership when the IGN can't be matched. The old "split rows in half so the reviewer sees both sides populated" heuristic was the root cause of `Player Leaderboard → Our players` showing nothing while opponents appeared: half of our matched rows were re-labelled `side="opponent"` then silently dropped on confirm because they had no `matchedOpponentPlayerId`. Unmatched rows are now emitted with `side: "unknown"` (`OcrPlayerRow.side` accepts `"us" | "opponent" | "unknown"`).
- `POST /api/ocr-scans/:id/confirm` rejects with HTTP 400 `{ error: "unassigned_rows", unassignedRowIdx: number[] }` if any row is still `unknown`, or has a side but no matching player id. No partial imports, no silent drops.
- The confirm route now writes opponent stats to `opponent_player_game_stats` symmetrically with our-side stats (`saveOpponentPlayerGameStats(matchId, rows, gameId)`); merge dedup key is `(opponentPlayerId, statFieldId)`. Both branches also dedup intra-import duplicates by `(side, owner)` and `(owner, statFieldId)` before persistence so manual re-mapping in review can't insert duplicate rows.
- Review UI (`client/src/pages/OcrScanReview.tsx`) renders three sections: **Needs assignment** (any `unknown` row), **Our team**, and **Opponent**. Each row has an explicit Side selector (Our team / Opponent / Unknown); flipping side clears the conflicting matched id. The confirm button is disabled with an "Assign N rows first" label until every row is assigned, and a destructive banner explains that captured numeric stats are preserved while the coach maps players. On success the mutation invalidates `/api/player-game-stats`, `/api/opponent-player-stats`, `/api/match-participants`, and `/api/game-heroes` so leaderboards refresh immediately.
