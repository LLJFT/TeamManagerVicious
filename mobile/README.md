# Esports Platform — Mobile (Expo)

React Native + Expo (TypeScript) companion app for the existing web platform.

## Quick start

```bash
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL to your backend
npm run start          # then press i / a / w to launch a target
```

The app reads `EXPO_PUBLIC_API_BASE_URL` (falls back to
`expoConfig.extra.apiBaseUrl` and finally `http://localhost:5000`). When testing
on a physical device, point it at your machine's LAN IP, e.g.
`http://192.168.1.10:5000`.

## Architecture

- **Theme** (`src/theme`): six-theme system (Light, Dark Default, Ocean Blue,
  Ruby Red, Minimal Dark, Carbon Black) keyed off `design/DESIGN_SYSTEM.md §
  2.1`. The user preference (or `'system'`) is persisted in AsyncStorage and
  the provider also subscribes to OS appearance changes so `'system'` stays
  live. Inter is loaded with `@expo-google-fonts/inter` + `expo-font`; until
  the family resolves the app renders with the system font and silently swaps
  in Inter once ready (no flash, no blocking splash).
- **i18n** (`src/i18n`): English + Arabic, with `I18nManager.forceRTL` toggling
  for Arabic. Switching across the RTL boundary prompts a one-tap restart via
  `expo-updates` so the native layout direction flips correctly.
- **API client** (`src/api/client.ts`): cookie-aware fetch wrapper that
  persists the session cookie to AsyncStorage so React Native sessions survive
  app restarts.
- **Auth** (`src/auth/AuthContext.tsx`): wraps `/api/auth/{me,login,logout}`
  and exposes `hasOrgRole` / `hasPermission` helpers used to gate admin
  screens.
- **Navigation** (`src/navigation`): bottom tabs (Dashboard, Teams, Events,
  Stats, More) with native-stack children per tab. Tab icons come from
  `lucide-react-native` so they match the web client's Lucide glyph set
  exactly. Admin destinations live in the More stack and are shown only to
  `super_admin`, `org_admin`, and `game_manager`.
- **Components** (`src/components`): reusable building blocks — Button, Card,
  Text, Badge, AppHeader, SearchBar, FilterChips, StatCard, ListItem,
  PlayerCard, EventCard, OpponentCard, RecordCard, SubscriptionPlanCard,
  SettingsRow, ExpandableSection, ActionMenu, BottomSheet, StickyBottomCTA,
  Skeleton, EmptyState, ErrorState, Toast.
- **Shared types**: `tsconfig.json` exposes the existing `shared/schema.ts`
  via the `@shared/*` alias so models stay in sync with the web client and
  server.

## RTL notes

`bootstrapI18n` runs once at startup and calls `I18nManager.forceRTL` if the
detected/stored language is Arabic. RN requires a JS reload to pick up a
direction change, so `SettingsScreen` calls `Updates.reloadAsync()` when the
user toggles between an LTR and an RTL language. `AppHeader` and `ListItem`
flip their chevron glyphs based on `isRtl(i18n.language)` to ensure visual
correctness even before reload.

## Roles

Role gating mirrors the web client:

| Role            | Sees admin section | Notes                                |
| --------------- | ------------------ | ------------------------------------ |
| super_admin     | Yes (all)          | Full platform access                 |
| org_admin       | Yes (all)          | Org-scoped admin                     |
| game_manager    | Yes (templates, access) | Manages game data                |
| coach_analyst   | No                 | Read/write team & event data         |
| player          | No                 | Read-only personal view              |

## Project layout

```
mobile/
  App.tsx
  index.ts
  app.json
  package.json
  babel.config.js
  tsconfig.json
  .env.example
  DESIGN.md
  README.md
  src/
    api/         # client + react-query setup
    auth/        # AuthContext + role helpers
    components/  # reusable UI primitives
    i18n/        # bootstrapI18n, en/ar resources
    navigation/  # RootNavigator + tab/stack navigators
    screens/     # Login, Dashboard, Roster, Events, Stats, Settings, …
    theme/       # tokens + ThemeProvider
```

The existing `client/` and `server/` packages are not modified by this
mobile app.
