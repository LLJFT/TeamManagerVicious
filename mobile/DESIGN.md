# Mobile Design — Esports Platform

This document describes the React Native + Expo mobile companion to the existing
web platform under `client/` and `server/`. It mirrors the existing roster /
teams / events / opponents / analytics / subscription / admin surface area
while adapting the UX to a touch-first, single-column form factor.

---

## 1. Goals & non-goals

**Goals**

- Mirror the core web product: dashboard, roster (players + staff), events
  (scrims, tournaments, VOD reviews), opponents, statistics, subscription
  management, settings, and basic admin (users / roles / game templates / game
  access).
- Preserve the existing role model (`super_admin`, `org_admin`,
  `game_manager`, `coach_analyst`, `player`) and gate UI accordingly.
- First-class English **and** Arabic support, including a true right-to-left
  layout via `I18nManager.forceRTL`.
- Light + dark theming controlled by the user, persisted across sessions.
- Reuse the shared `shared/schema.ts` so models stay in lockstep with the web
  client and Express server.
- Read the API base URL from `EXPO_PUBLIC_API_BASE_URL` so the app can be
  pointed at local dev, staging, or production builds without code changes.

**Non-goals (this iteration)**

- Re-implementing every analytics deep dive (Compare, MapInsights,
  HeroInsights, DraftStats, TeamComps, Leaderboards). The Stats tab provides
  an overview and per-domain breakdown placeholders that future tasks can
  wire up to existing endpoints.
- Web-only flows like Media Library uploads, OrgChat threading, and complex
  rich-text editing — these stay on the web client for now.
- Modifying the existing `client/` or `server/` packages.

---

## 2. Information architecture

The web client exposes ~45 pages (`Dashboard`, `Events`, `EventDetails`,
`History`, `UnifiedStats`, `Compare`, `OpponentStats`, `DraftStats`,
`MapInsights`, `HeroInsights`, `Trends`, `TeamLeaderboard`,
`PlayerLeaderboard`, `TeamComps`, `Players`, `Staff`, `Chat`, `OrgDashboard`,
`CalendarPage`, `UsersPage`, `RolesPage`, `GameAccessPage`, `OrgChat`,
`SettingsPage`, `GameTemplates`, `MediaLibrary`, `SubscriptionsPage`,
`HelpPage`, `Login`, `GamesHome`, `AccountSettings`, `PlayerStats`, etc.).

On mobile we collapse them into five tabs:

| Tab        | Stack screens                                                                 |
| ---------- | ----------------------------------------------------------------------------- |
| Dashboard  | `Dashboard`, `Subscriptions`                                                  |
| Teams      | `Roster` (Players + Staff filters), `PlayerDetail`                            |
| Events     | `Events` (Upcoming/Past), `EventDetail`, `OpponentDetail`                     |
| Stats      | `StatsOverview`, `StatBreakdown` (players / opponents / heroes / maps / trends) |
| More       | `More`, `Settings`, `Help`, `Subscriptions`, admin: `Users`, `Roles`, `GameTemplates`, `GameAccess` |

The "More" tab acts as the catch-all for low-frequency destinations and is the
only place admin entries appear, so the primary tabs stay identical for every
role.

---

## 3. Screen catalogue

| Screen                | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `LoginScreen`         | Username + password sign-in against `/api/auth/login`.                  |
| `DashboardScreen`     | KPI tiles, upcoming events, recent results.                             |
| `RosterScreen`        | Search + filter the player roster.                                      |
| `PlayerDetailScreen`  | Bio, role, expandable stats / history / notes.                          |
| `EventsScreen`        | Tabbed Upcoming / Past list of events.                                  |
| `EventDetailScreen`   | Type, opponent, result, attendance, map, notes.                         |
| `OpponentDetailScreen`| Region, meeting count, win rate, scouting notes.                        |
| `StatsOverviewScreen` | Headline KPIs + entry points to per-domain breakdowns.                  |
| `StatBreakdownScreen` | Placeholder per-domain breakdown (players/opponents/heroes/maps/trends).|
| `SubscriptionsScreen` | Plan cards (Starter / Pro / Organisation) with current-plan indication. |
| `MoreScreen`          | Hub for Subscriptions, Settings, Help and admin links.                  |
| `SettingsScreen`      | Theme, language, account, sign out.                                     |
| `HelpScreen`          | Intro copy + expandable FAQs + contact CTA.                             |
| `AdminUsersScreen`    | Stub (super/org admin only).                                            |
| `AdminRolesScreen`    | Stub (super/org admin only).                                            |
| `AdminGameTemplatesScreen` | Stub (super/org admin + game manager).                             |
| `AdminGameAccessScreen`    | Stub (super/org admin + game manager).                             |

Stubs render `EmptyState` with a "coming soon" description so they remain safe
to ship while the underlying admin APIs are wired up incrementally.

---

## 4. Component library

All components live in `src/components` and are exported from a single
`index.ts` barrel.

- **Layout / containers**: `Card`, `AppHeader`, `BottomSheet`,
  `StickyBottomCTA`, `ExpandableSection`.
- **Inputs / actions**: `Button`, `SearchBar`, `FilterChips`, `ActionMenu`.
- **Display**: `Text`, `Badge`, `StatCard`, `ListItem`, `SettingsRow`,
  `RecordCard`, `PlayerCard`, `EventCard`, `OpponentCard`,
  `SubscriptionPlanCard`.
- **Feedback**: `Skeleton` / `SkeletonList`, `EmptyState`, `ErrorState`,
  `Toast` + `ToastProvider` / `useToast`.

Every interactive control accepts a `testID` so end-to-end tests can target it
deterministically.

---

## 5. Theming

`src/theme/tokens.ts` defines two palettes (light/dark) plus shared spacing,
radii, typography and shadow tokens. `ThemeProvider` reads the system
appearance, respects an AsyncStorage override, and exposes `colors`,
`spacing`, `radii`, `typography`, `shadows`, plus `setScheme('light' | 'dark'
| 'system')` and a `toggle()` helper. `Text` and `Badge` map a small `tone`
prop to semantic palette colors so dark-mode contrast stays correct without
per-screen branches.

---

## 6. Internationalisation & RTL

- `src/i18n/index.ts` loads English + Arabic resources via `i18next` and
  `react-i18next`, with detection from `expo-localization` and an
  AsyncStorage override.
- `bootstrapI18n()` runs once before the navigator mounts; it also calls
  `applyRtl()` which invokes `I18nManager.allowRTL(true) /
  I18nManager.forceRTL(true)` for Arabic.
- Because RN only flips layout direction on JS reload, switching across the
  LTR↔RTL boundary inside `SettingsScreen` triggers an `Updates.reloadAsync()`
  prompt. Visually-directional glyphs (back chevron in `AppHeader`, list
  chevron in `ListItem`) consult `isRtl(i18n.language)` so they look correct
  even before the reload.
- All user-visible copy goes through `t(...)`. New strings should be added to
  `en.ts` (the source of truth for the `Translation` type) and mirrored in
  `ar.ts`.

---

## 7. State, data, and API integration

- `@tanstack/react-query` powers all data fetching. `queryClient` (in
  `src/api/queries.ts`) defines a default `queryFn` that joins the queryKey
  segments into a path and calls `apiRequest`, so screens can simply do
  `useQuery({ queryKey: ['/api/players', id] })`.
- `apiRequest` in `src/api/client.ts` adds JSON headers, attaches the stored
  session cookie, captures any new `Set-Cookie` header, and throws a typed
  `ApiError` on non-2xx responses.
- `AuthProvider` calls `/api/auth/me` on boot to restore the session, exposes
  `signIn`, `signOut`, and `hasOrgRole(...) / hasPermission(...)` helpers used
  by `MoreScreen` to gate admin entries.
- Mutations should use `apiRequest('/api/...', { method: 'POST', body: ... })`
  and invalidate by query key via `queryClient.invalidateQueries({ queryKey:
  [...] })`.

---

## 8. Role-based access

| Role            | Tabs visible                | Admin section in More                              |
| --------------- | --------------------------- | -------------------------------------------------- |
| super_admin     | All five                    | Users, Roles, Game templates, Game access          |
| org_admin       | All five                    | Users, Roles, Game templates, Game access          |
| game_manager    | All five                    | Game templates, Game access                        |
| coach_analyst   | All five                    | None                                               |
| player          | All five                    | None                                               |

Tabs themselves are intentionally identical across roles to keep navigation
predictable; per-tab features (e.g. editing a player) should additionally
consult `hasOrgRole` / `hasPermission` before showing destructive actions.

---

## 9. Configuration & environments

- API base URL: `EXPO_PUBLIC_API_BASE_URL` (build-time env), then
  `expoConfig.extra.apiBaseUrl` (`app.json`), then `http://localhost:5000`.
- Theme override: persisted under `theme.scheme` in AsyncStorage.
- Language: persisted under `i18n.language` in AsyncStorage.
- Session cookie: persisted under `auth.sessionCookie` in AsyncStorage so
  reloads / cold starts keep the user signed in.
- `app.json` declares `userInterfaceStyle: "automatic"` so the OS appearance
  is respected by default.

---

## 10. Future work

- Wire admin stubs (`Users`, `Roles`, `GameTemplates`, `GameAccess`) to the
  existing REST endpoints, including create/update/delete sheets.
- Bring over the analytics deep dives (`Compare`, `MapInsights`,
  `HeroInsights`, `DraftStats`, `TeamComps`, leaderboards) as dedicated screens
  inside the Stats stack.
- Add push notifications for upcoming events and subscription expiry.
- Add offline-friendly caching with React Query persistence.
- Per-screen visual regression tests; screen reader / large-text auditing for
  both LTR and RTL.
