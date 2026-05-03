# Mobile App Audit — Production Hardening

Audit of merged `mobile/` (Task #6) against `design/DESIGN_SYSTEM.md`.

Scope: token consistency, component consistency, navigation, role gating, RTL, i18n, dark mode, mobile usability, accessibility, screen polish, weak abstractions / bugs.

Constraints respected: no rewrites, preserve architecture, do not conflict with in-flight isolated tasks #15 (admin live APIs), #16 (deep analytics), #17 (push notifications).

---

## 1. Audit Summary

The merged scaffold is solid: it mirrors web architecture (theme + i18n + cookie-aware fetch + tabs/stacks + role gating) and has a complete reusable component library. It is **not** production-ready as shipped because of a critical card-tappability defect, scattered hardcoded English strings inside components, design-token drift from the system spec, and a few accessibility / theme-state gaps.

After applying the patches in §4, the app is production-ready as a v0.1 read-only mobile shell pending the live-data wiring already in flight (#15, #16) and notifications (#17).

## 2. Gaps Found

### 2.1 Critical bugs

- **`Card` is not tappable but `EventCard` / `PlayerCard` / `OpponentCard` / `RecordCard` / `SubscriptionPlanCard` all accept and advertise `onPress`.** The prop is silently dropped. Roster / Events / Dashboard list taps do nothing.
- **`StatCard` tone logic** is broken: `tone === 'default' ? 'default' : (tone as any) ?? 'default'` — the nullish-coalesce on a non-null-but-typed value never fires; passing no `tone` makes the value text fall back to `'default'` correctly but `success`/`primary` work only by accident.

### 2.2 Token drift from `design/DESIGN_SYSTEM.md`

| Token | Spec | Mobile | Status |
|---|---|---|---|
| `radius.sm/md/lg` | 3 / 6 / 9 | 4 / 8 / 12 | drift — fixed |
| `primary` (dark) | `199 89% 48%` (same as light, +5–10 lightness only on light themes) | `#38BDF8` (≈199 92% 60%) | drift — fixed |
| Body font on mobile | 16px | 14px | drift — fixed (prevents iOS input zoom) |
| `font-variant-numeric: tabular-nums` on KPI/stat values | required | absent | added on `StatCard` |
| Inter font family | required | system font | follow-up (requires `expo-font` asset, deferred) |
| 6 themes (Default Dark, Ocean Blue, Ruby Red, Minimal Dark, Carbon Black, Light) | required | 2 (light/dark) | follow-up (deferred — large scope) |

### 2.3 i18n coverage gaps

Hardcoded English inside components and screens (would not translate in Arabic):

- `PlayerCard`: `"Available"` / `"Unavailable"`
- `OpponentCard`: `"matches"` / `"WR"`
- `SubscriptionPlanCard`: `"Choose"` / `"Current"`
- `SubscriptionsScreen`: plan names, prices, and feature bullets
- `StatsOverviewScreen`: `"Win rate"`, `"Matches"`, `"K/D"`
- `HelpScreen`: section titles (`"Getting started"`, `"Roles & permissions"`, `"Languages & RTL"`) and copy
- `StatBreakdownScreen`: `"Detailed breakdown coming soon."`
- 4 admin stub screens: `"… coming soon."`
- `LoginScreen`: brand label `"Esports HQ"` (kept — brand mark, not copy)

All fixed via new `en.ts` / `ar.ts` keys.

### 2.4 RTL behavior

- `AppHeader` and `ListItem` already swap chevron glyphs (`‹` ↔ `›`) manually, which is correct because glyphs aren't auto-mirrored.
- `marginEnd` / `flexDirection: 'row'` correctly auto-flip under `I18nManager.forceRTL`.
- Issue: language picker triggers `Updates.reloadAsync()` which is correct, but the prompt only fires if the new language flips RTL — confirmed correct.

### 2.5 Theme / dark mode

- `ThemeProvider.setScheme('system')` resolves immediately but does **not remember** the "system" preference, so subsequent OS theme changes don't propagate. Fixed: persist `'system'` and subscribe to `Appearance.addChangeListener`.
- Status bar style swap is correct.

### 2.6 Navigation

- Bottom tabs use **emoji-like glyphs** (`◉ ◍ ▦ ▥ ☰`) for icons. Spec rejects emoji as UI affordance and mandates Lucide. Fixed by replacing with simple `react-native-svg` icon components (no new dependency required; `react-native-svg` is already in `mobile/package.json`).
- Stacks correctly use native-stack; back gestures work; nested stack inside tabs is correct.
- `MoreScreen` correctly gates admin rows by `hasOrgRole`.
- `Subscriptions` route is registered both inside `MoreStack` and `DashboardStack`. That's intentional (deep-linkable from both surfaces).

### 2.7 Accessibility

- Icon-only `Pressable` (back button, settings rows) lacked `accessibilityRole` / `accessibilityLabel`. Fixed.
- Buttons lacked `accessibilityState={{ disabled, busy }}`. Fixed.
- Toast viewport lacked `accessibilityLiveRegion`. Fixed.
- `SearchBar` height was 40, below the 44 spec minimum. Fixed.
- `FilterChips` height was 32 (tappable). Bumped to 36 (badges remain 32; chips are interactive). Spec allows < 44 for compact horizontal-scroll chips paired with sufficient `hitSlop`; we add `hitSlop` instead of forcing 44 to keep the chip aesthetic.

### 2.8 Screens needing polish

- `DashboardScreen`: `dashboard.welcome` defined in i18n but never rendered; no error state when query fails. Fixed.
- `LoginScreen`: brand text hardcoded; works as mark.
- `SubscriptionsScreen`: full content hardcoded English. Translated.
- `StatsOverviewScreen`: KPI labels hardcoded. Translated.
- `HelpScreen`: section titles hardcoded. Translated.

### 2.9 Weak abstractions / lower-priority

- `api/client.ts` manually persists `Cookie` header from `set-cookie`. On iOS RN, `Cookie` is sometimes a forbidden header — the underlying `credentials: 'include'` plus the `CookieJar` is what actually carries sessions. The manual cache is a backup that won't break things but isn't strictly needed. Left as-is to avoid regressing auth.
- `apiRequest` doesn't surface validation errors with field detail — acceptable for a read-mostly client.
- `queries.ts` query function joins URL parts with `/` even for non-id segments — works because all current keys follow `['/api/x', id]`. Document convention.

## 3. Files Patched (high-priority fixes applied in this pass)

| File | Reason |
|---|---|
| `mobile/src/theme/tokens.ts` | Align radii to spec (3/6/9), dark primary to spec, mobile body 16px, add `numeric` font-variant token |
| `mobile/src/theme/ThemeProvider.tsx` | Track `'system'` preference; subscribe to `Appearance` change |
| `mobile/src/components/Card.tsx` | Accept optional `onPress`; render `Pressable` with feedback when tappable (fixes critical card-tap bug) |
| `mobile/src/components/PlayerCard.tsx` | Pass `onPress` through; i18n status badge |
| `mobile/src/components/OpponentCard.tsx` | Pass `onPress` through; i18n meta |
| `mobile/src/components/EventCard.tsx` | Pass `onPress` through; result badge label via i18n |
| `mobile/src/components/RecordCard.tsx` | Pass `onPress` through |
| `mobile/src/components/SubscriptionPlanCard.tsx` | Pass `onPress` through; i18n labels |
| `mobile/src/components/StatCard.tsx` | Fix tone fallback; tabular-nums on value |
| `mobile/src/components/Button.tsx` | `accessibilityRole`, `accessibilityState` |
| `mobile/src/components/AppHeader.tsx` | `accessibilityRole`, `accessibilityLabel` on back |
| `mobile/src/components/SearchBar.tsx` | Touch height 44 |
| `mobile/src/components/FilterChips.tsx` | Touch height 36 + `hitSlop` |
| `mobile/src/components/Toast.tsx` | `accessibilityLiveRegion="polite"` |
| `mobile/src/components/icons.tsx` | New: tab icons via `react-native-svg` (replaces emoji glyphs) |
| `mobile/src/navigation/TabsNavigator.tsx` | Use SVG icons instead of emoji glyphs |
| `mobile/src/screens/DashboardScreen.tsx` | Render `dashboard.welcome`; error state |
| `mobile/src/screens/StatsOverviewScreen.tsx` | i18n KPI labels |
| `mobile/src/screens/HelpScreen.tsx` | i18n section titles |
| `mobile/src/screens/SubscriptionsScreen.tsx` | i18n plan content |
| `mobile/src/screens/StatBreakdownScreen.tsx` | i18n empty copy |
| `mobile/src/screens/admin/*.tsx` | i18n empty copy |
| `mobile/src/i18n/en.ts` + `ar.ts` | New keys: `common.comingSoon`, `dashboard.errorLoading`, `roster.availableLabel`/`unavailableLabel`, `opponent.matches`/`opponent.wr`, `subscriptions.choose`/`current`/`plans.*`, `stats.kpi.*`, `help.sections.*`, plus admin "coming soon" message |

## 4. Patch Plan (priority)

| Priority | Item | Status |
|---|---|---|
| **P0 (bug)** | Card tappability across all card-derived components | Done |
| **P0 (a11y)** | Tab emoji glyphs → SVG icons | Done |
| **P0 (i18n)** | Hardcoded English in components & screens | Done |
| **P1 (system)** | Token alignment to DESIGN_SYSTEM.md (radii, dark primary, mobile body 16, tabular-nums) | Done |
| **P1 (theme)** | Persist `system` preference + Appearance listener | Done |
| **P1 (a11y)** | Roles/labels on icon-only pressables; live region on toasts; touch-target bump on SearchBar | Done |
| **P1 (UX)** | Welcome line + error state on Dashboard | Done |
| **P2 (follow-up)** | Six themes (Ocean / Ruby / Minimal / Carbon) | Deferred — large scope, not blocking |
| **P2 (follow-up)** | Inter font (`expo-font` + asset bundle) | Deferred |
| **P2 (follow-up)** | `lucide-react-native` | Deferred — replaced with custom SVG (no new dep) |
| **P3 (in-flight)** | Live admin data wiring | Owned by Task #15 |
| **P3 (in-flight)** | Deep analytics (compare / maps / heroes / drafts / leaderboards) | Owned by Task #16 |
| **P3 (in-flight)** | Push notifications | Owned by Task #17 |

## 5. What Is Production-Ready Now

- **Foundation**: theme tokens aligned with web design system (radii, dark primary, mobile typography); persisted theme + RTL bootstrap; cookie-aware API; React Query with sensible defaults.
- **Auth**: session-cookie sign-in, role + permission helpers, gated admin entries.
- **i18n**: full EN + AR coverage across components and screens; RTL flip prompts a one-tap restart.
- **Component library**: consistent semantics, tappable cards, accessible buttons, live-region toasts, skeleton/empty/error triad.
- **Navigation**: bottom tabs with native stacks, real SVG tab icons, role-gated More section, back-button parity in RTL.
- **Read screens**: Dashboard, Roster, Events, EventDetail, PlayerDetail, OpponentDetail, Stats overview, Subscriptions, Settings, Help, More, Login.

## 6. What Still Needs Follow-up

- **Six themes** (Ocean Blue, Ruby Red, Minimal Dark, Carbon Black) — currently only Light + Dark Default. Add as a future pass with a `themeName` field and per-theme palette object.
- **Inter font** — install `expo-font` and bundle `Inter-*.ttf` to match web typography precisely.
- **`lucide-react-native`** — current pass uses hand-rolled SVGs in `components/icons.tsx`. Switching to Lucide is a drop-in; defer to first task that adds an icon-heavy screen.
- **Live admin data** — `AdminUsers/Roles/GameTemplates/GameAccess` are still empty-state stubs (Task #15 in flight).
- **Deep analytics** screens (compare / maps / heroes / drafts / leaderboards) — Task #16 in flight.
- **Push notifications** — Task #17 in flight.
- **Form mutations** with validation surfacing (the audit found no mutation screens; everything is read-only today).
- **API base URL** in `app.json.extra.apiBaseUrl` is `http://localhost:5000`. Production builds must override via `EXPO_PUBLIC_API_BASE_URL` or per-env `app.config.ts`.

## 7. Routes / Screens Status

| Route | Status |
|---|---|
| `Login` | OK |
| `Dashboard` | OK (live data pending) |
| `Subscriptions` (from Dashboard or More) | OK (PLANS still client-side; switch to API when subscription endpoints are ready) |
| `Roster → PlayerDetail` | OK |
| `Events → EventDetail / OpponentDetail` | OK |
| `StatsOverview → StatBreakdown` | OK shell; deep tables owned by #16 |
| `More → Settings / Help / Subscriptions` | OK |
| `More → Admin (Users / Roles / GameTemplates / GameAccess)` | Stubs gated correctly; live data owned by #15 |

No routes are missing relative to the v0.1 plan.

## 8. Remaining Mobile UX Notes

- Charts: not yet on mobile — appropriate for v0.1; add via `react-native-svg` paths or Victory Native when #16 lands.
- Pull-to-refresh: present on Dashboard; add to Roster / Events when live-data lands.
- Offline state: not handled; add `NetInfo` banner when push/notifications land in #17.
- Deep-link config: `app.json` has no `scheme` yet. Add when push notifications need tappable action URLs.

---

_Audit performed against commits up to `36d0122` (post-#7 / #8 / #13). Patches in this pass do not touch admin or analytics screens beyond i18n strings, to avoid conflicts with in-flight tasks #15 / #16._
