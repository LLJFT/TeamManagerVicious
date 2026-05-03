# The Bootcamp — Product Design System

**Version 1.0 · Web-first, mobile-ready, dark-mode native**
Grounded in the existing app: HSL token architecture, shadcn/Radix primitives, six themes (Default Dark, Ocean Blue, Ruby Red, Minimal Dark, Carbon Black, Light), sidebar shell, role/event/result semantic colors.

This document is the source of truth for visual language, components, screen behavior, mobile rules, dark mode, and engineering handoff. It is intended to be loaded into Figma as a library and mirrored 1:1 in code.

---

## 1. Design Direction

### Product personality
The Bootcamp is a **competitive esports operations platform** — rosters, events, opponents, draft stats, analytics, leaderboards. The audience is team managers, coaches, and players who live in the product daily.

The design must feel:

- **Operational, not decorative.** Information density is a feature; the UI must respect dense data without becoming hostile.
- **Premium and modern.** Closer to Linear, Vercel dashboard, Mixpanel, and Riot client tools than to Bootstrap admin templates or Dribbble concepts.
- **Dark-first, light-respected.** Most users run dark mode in long sessions; light mode is a first-class peer.
- **Calm.** Color is reserved for meaning (status, win/loss, role). Chrome stays neutral so data can shout.
- **Fast.** Subtle motion, no decorative animation, no staggered reveals.

### Anti-patterns to reject

- Glassmorphism, neon glows, heavy gradients on chrome.
- Decorative drop shadows on cards in dark mode.
- Emoji as UI affordance (use Lucide / SI icons).
- Color used purely aesthetically — every hue must encode meaning.
- Gradients in body text or labels.

### Visual signature

- Cyan-teal primary (`hsl(199 89% 48%)`) — heroic, energetic, distinct from Twitch purple and Discord blurple.
- One warm coral/salmon accent (`hsl(12 76%)`) used sparingly for motivation/celebration moments (subscription confirmation, achievement, rare highlight).
- Neutral chrome (slate-blue family in default theme) so colored chips read instantly.
- 6px / 9px corner radii — soft enough to feel modern, sharp enough to feel operational.

---

## 2. Design Tokens

All tokens live as HSL triplets in `client/src/index.css` and are exposed via Tailwind in `tailwind.config.ts`. Figma should mirror these as Variables (modes: `Light`, `Dark Default`, `Ocean Blue`, `Ruby Red`, `Minimal Dark`, `Carbon Black`).

### 2.1 Color — semantic tokens (current source of truth)

| Token | Light | Dark Default | Ocean Blue | Ruby Red | Minimal Dark | Carbon Black |
|---|---|---|---|---|---|---|
| `background` | `210 40% 98%` | `222 47% 11%` | `210 50% 10%` | `0 20% 10%` | `220 15% 12%` | `0 0% 5%` |
| `foreground` | `222 47% 11%` | `210 40% 98%` | `195 40% 95%` | `0 10% 95%` | `220 10% 92%` | `0 0% 95%` |
| `card` | `0 0% 100%` | `217 33% 14%` | `208 45% 13%` | `0 18% 13%` | `220 13% 15%` | `0 0% 8%` |
| `card-border` | `214 32% 91%` | `217 33% 22%` | `205 40% 22%` | `0 15% 24%` | `220 10% 24%` | `0 0% 20%` |
| `sidebar` | `210 40% 96%` | `222 47% 9%` | `210 50% 8%` | `0 20% 8%` | `220 15% 10%` | `0 0% 4%` |
| `primary` | `199 89% 48%` | `199 89% 48%` | `185 75% 45%` | `350 75% 50%` | `220 60% 55%` | `155 75% 45%` |
| `accent` | `12 76% 95%` | `12 76% 25%` | `175 60% 25%` | `20 60% 25%` | `220 30% 25%` | `155 50% 20%` |
| `destructive` | `0 84% 60%` | `0 84% 60%` | `0 70% 55%` | `0 85% 55%` | `0 65% 50%` | `0 75% 55%` |
| `success` | `142 71% 45%` | `142 71% 45%` | `160 60% 45%` | `145 60% 45%` | `145 50% 45%` | `155 65% 45%` |
| `warning` | `43 96% 56%` | `43 96% 56%` | `45 80% 55%` | `45 85% 55%` | `40 75% 50%` | `45 85% 50%` |
| `muted-foreground` | `215 16% 47%` | `215 20% 65%` | `200 20% 60%` | `0 10% 60%` | `220 8% 55%` | `0 0% 55%` |

Always reference tokens via Tailwind utilities (`bg-card`, `text-muted-foreground`, `border-card-border`, `bg-primary`). Never hardcode `slate-800` / `red-500` etc. in product chrome — only allowed inside the predefined `status-*`, `role-*`, `event-*`, `result-*` utility classes in `index.css`.

### 2.2 Color — domain semantic palette

These already exist as utility classes in `index.css`. They are part of the system; document them in Figma as **Tag styles**.

| Domain | Class | Meaning |
|---|---|---|
| Availability | `status-available` | Player available |
| Availability | `status-unavailable` | Player out |
| Availability | `status-maybe` | Tentative |
| Availability | `status-unknown` | Not responded |
| Role | `role-tank` | Front line |
| Role | `role-dps` | Damage |
| Role | `role-support` | Backline |
| Event | `event-tournament` | Official match |
| Event | `event-scrim` | Practice |
| Event | `event-vod` | Review |
| Result | `result-win` | Win |
| Result | `result-loss` | Loss |
| Result | `result-draw` | Draw |
| Presence | `status.online/away/busy/offline` | Live presence |

### 2.3 Chart palette (analytics)

Five qualitative tokens (`--chart-1`…`--chart-5`) per theme. Use them in this order for series ordering. For sequential (heatmap) scales, derive 7 stops from `--chart-1` (lightness 90 → 30 in light mode, 30 → 75 in dark mode). Never use raw Tailwind palette colors in charts.

### 2.4 Typography

- **Family:** `Inter` (UI), Menlo (mono for IDs/seeds/codes), Georgia (serif — reserved for marketing/help quotes only).
- **Base size:** 14px web, 16px mobile.
- **Numerals:** enable `font-variant-numeric: tabular-nums` on every `<td>`, KPI value, leaderboard column, score cell. This is non-negotiable for esports stats.

| Style | Size | Line | Weight | Tracking | Usage |
|---|---|---|---|---|---|
| `display` | 36 / 32 mobile | 1.1 | 700 | -0.02em | Hero numbers (Dashboard KPI hero), landing |
| `h1` | 28 / 24 | 1.2 | 700 | -0.01em | Page title |
| `h2` | 22 / 20 | 1.25 | 600 | -0.01em | Section title |
| `h3` | 18 | 1.3 | 600 | 0 | Card title |
| `h4` | 16 | 1.4 | 600 | 0 | Sub-block title |
| `body` | 14 | 1.5 | 400 | 0 | Default copy |
| `body-strong` | 14 | 1.5 | 600 | 0 | Inline emphasis |
| `small` | 13 | 1.45 | 400 | 0 | Card meta, helper text |
| `caption` | 12 | 1.4 | 500 | 0.01em | Labels above fields, table column headers |
| `overline` | 11 | 1.3 | 600 | 0.08em uppercase | Section eyebrow |
| `mono-sm` | 12 | 1.4 | 500 | 0 | IDs, seeds, JSON, codes |
| `button` | 14 / 13 (sm) / 16 (lg) | 1 | 500 | 0 | All buttons |

**Data tables:** body 13px, headers 11px overline, tabular-nums on all numeric columns.

**Mobile rule:** never below 13px for interactive labels. Bump body from 14 → 16 when viewport < 640px to prevent iOS zoom on input focus.

### 2.5 Spacing — 4px base scale

`space-0=0`, `space-1=4`, `space-2=8`, `space-3=12`, `space-4=16`, `space-5=20`, `space-6=24`, `space-8=32`, `space-10=40`, `space-12=48`, `space-16=64`.

Three semantic spacing scopes (use these names in Figma and code reviews):

| Scope | Mobile | Desktop | Where |
|---|---|---|---|
| `inset-tight` | 8 | 12 | Pills, dense table cells, icon button padding |
| `inset-card` | 16 | 20 | Card body, dialog body |
| `inset-page` | 16 | 24–32 | Page gutter |
| `gap-stack-sm` | 8 | 12 | Form rows, list items |
| `gap-stack-md` | 16 | 16 | Cards in a vertical stack |
| `gap-stack-lg` | 24 | 32 | Page sections |
| `gap-grid` | 16 | 24 | Card/KPI grids |

Rule: only three vertical rhythms per page. If you find yourself reaching for `mt-7` / `mt-9` you are off-grid.

### 2.6 Radius

Map to Tailwind tokens already in `tailwind.config.ts`:

| Token | Px | Use |
|---|---|---|
| `rounded-sm` | 3 | Tag dot, micro chip |
| `rounded-md` | 6 | Inputs, badges, buttons (default), small cards |
| `rounded-lg` | 9 | Cards, dialogs, popovers, large buttons |
| `rounded-full` | ∞ | Avatars, status dots, pills (height ≥ 24, paired with px-3) |

Never apply `rounded-xl` / `rounded-2xl` to operational chrome — those read as marketing.

### 2.7 Elevation

Use the predefined `--shadow-*` ramp.

| Token | Use |
|---|---|
| `shadow-xs` | Subtle borderless cards on background |
| `shadow-sm` | Hovered table rows when row borders are absent |
| `shadow-md` | Dropdowns, popovers, hover cards |
| `shadow-lg` | Floating dialogs, sheets |
| `shadow-xl` | Modals over scrim |
| `shadow-2xl` | Reserved (rare — full-screen takeovers) |

**Dark mode shadows are darker, not larger** (already encoded in `index.css`). Never add a colored glow as decoration; glow is reserved for `ring` (focus) and selected state.

### 2.8 Iconography

- **Library:** `lucide-react` for UI, `react-icons/si` for brand marks (Discord, X). No mixing.
- **Sizes:** 14px (inline with body), 16px (default in buttons/sidebar), 18px (in headers), 20px (empty-state), 24px (page hero icon).
- **Stroke:** Lucide default (1.75). Never override per-icon.
- **Pairing:** icon-only buttons must always have `aria-label` and a Tooltip. Icon + label gap is `gap-2` (8px).

---

## 3. Figma Structure

### File organization

One library file (`Bootcamp / Design System`) + one product file (`Bootcamp / Product`).

### Pages in the library file

1. **README** — what this is, version, ownership, change log.
2. **00 Foundations** — color tokens (light + dark + 4 dark themes side-by-side), typography ramp, spacing scale, radius, shadow ramp, iconography rules.
3. **01 Tokens** — Variables collection mirror: `color/*`, `space/*`, `radius/*`, `shadow/*`, `typography/*`. Modes: `Light`, `Dark Default`, `Ocean Blue`, `Ruby Red`, `Minimal Dark`, `Carbon Black`.
4. **02 Primitives** — Button, Input, Select, Checkbox, Radio, Switch, Slider, Badge, Avatar, Tag/Chip, Tooltip, Toast, Skeleton, Divider.
5. **03 Composites** — Card, KPI Card, Stat Card, Empty State, Filter Bar, Pagination, Table Row, Tabs, Segmented, Banner, Subscription Countdown, Subscription Block.
6. **04 Navigation** — Sidebar (expanded + collapsed), Sidebar (mobile drawer), Top Bar, Breadcrumb, Page Header pattern.
7. **05 Patterns** — Form layouts, Confirmation dialog, Destructive confirmation, Filter + table page, Detail page, Analytics dashboard layout, Settings layout, Dual-pane layout, Empty/Error/Loading triad.
8. **06 Screens** — One frame per app route (Home, Dashboard, Roster, Players, Opponents, Maps, Heroes, Draft Stats, Analytics, Team LB, Player LB, Settings, Subscription, Help, Admin). Each screen has Light + Dark Default variants minimum.
9. **07 Mobile** — Mobile variant of each screen + bottom sheet patterns + collapsed sidebar drawer.
10. **08 QA / Audit** — Token usage check, contrast audit, missing-state audit board.

### Naming conventions

- **Components:** `Category/Component` then variants. e.g. `Button/Primary`, `Button/Ghost`, `Card/KPI`, `Table/Row`, `Banner/Subscription Countdown`.
- **Variants (component properties):** `variant`, `size`, `state`, `density`, `theme`, `hasIcon`, `hasTrailing`, `loading`, `disabled`, `selected`. Always boolean for binary states.
- **Tokens (Variables):** lowercase dot-path: `color.background`, `color.card`, `color.primary.default`, `color.primary.foreground`, `color.status.available.bg`, `space.4`, `radius.md`, `shadow.lg`, `font.size.body`.

### Auto Layout

- Every component uses Auto Layout. No absolute positioning except for badges anchored to avatars (use Auto Layout absolute children).
- Padding tokens applied via Variables, not raw numbers.
- Spacing between siblings always uses one of `gap-stack-*` or `gap-grid` tokens.

### Responsive variants

Each screen frame has three sizes:

| Frame | Width | Use |
|---|---|---|
| `Mobile` | 390 | iPhone reference |
| `Tablet` | 834 | iPad |
| `Desktop` | 1440 | Standard laptop |

Use Figma constraints + Auto Layout `Fill` so a single screen frame resizes correctly between Tablet ↔ Desktop. Mobile is its own frame (different navigation pattern).

### Light/dark variants

Each screen has a Mode toggle on the local Variables collection — switch the frame to render in any of the 6 themes without duplicating frames. Components must consume Variables exclusively (no hardcoded fills) for this to work.

### Handoff readiness

- Every Figma component links a `Description` field with: token names, `data-testid` pattern, and the React component path (`@/components/ui/button`).
- Token JSON exported via Tokens Studio plugin → committed to `design/tokens.json` for diff visibility.

---

## 4. Component Library

For each component below: **Variants → Sizes → States → Spacing → A11y → Do/Don't**. All map to existing shadcn implementations under `client/src/components/ui/`.

### 4.1 Button

- **Variants:** `default` (primary), `secondary`, `outline`, `ghost`, `link`, `destructive`.
- **Sizes:** `sm` (h-8, px-3, text-13), `default` (h-9, px-4, text-14), `lg` (h-10, px-6, text-16), `icon` (h-9 w-9 — never set width/height).
- **States:** rest, hover (uses `hover-elevate`), active (uses `active-elevate-2`), focus-visible (`ring-2 ring-ring ring-offset-2`), disabled (`opacity-50`, no events), loading (Lucide `Loader2 h-4 w-4 animate-spin` left of label, label retained).
- **Spacing:** icon-label gap 8 (`gap-2`). Never set hover/active background colors manually — rely on built-in elevate.
- **A11y:** icon-only requires `aria-label` and Tooltip. Loading state announces via `aria-busy="true"`.
- **Do:** primary action per surface should be `default` variant, exactly one per card or dialog.
- **Don't:** stack two `default` buttons next to each other; the second should be `secondary` or `outline`. Don't apply `border-l-4`-style accents.

### 4.2 Inputs (Text, Password, Search, Textarea)

- **Sizes:** `sm` (h-8), `default` (h-9), `lg` (h-10). Padding: `px-3`, with leading icon `pl-9`.
- **States:** rest, focus (`ring-2 ring-ring`), disabled (`bg-muted`), error (`border-destructive`, helper text below in `text-destructive text-13`), readonly (no border focus).
- **Composition:** label above (`Label` shadcn, mb-2), helper text below (`text-muted-foreground text-13`).
- **Search input:** leading `Search` 14px icon, no clear button on web (Esc to clear); on mobile show `X` clear button when value present.
- **Textarea:** min-h 96, autoresize via `field-sizing: content` where supported.
- **A11y:** every input has a `<Label htmlFor>`, never floating labels (poor screen-reader behavior, breaks autofill).
- **Don't:** strip border on Textarea or set `p-0`.

### 4.3 Select / Dropdown / Combobox

- Use shadcn `Select` for ≤ 8 fixed options. Use `Command` (combobox) for searchable lists ≥ 8.
- Trigger height matches sibling Buttons (`h-9` default).
- Menu uses `popover` token, `shadow-md`, `rounded-md`, max-height 320 with internal scroll.
- Selected item: leading check (Lucide `Check` 14px), `bg-accent`.
- A11y: typeahead supported; keyboard `↑↓` navigates, `Enter` selects, `Esc` closes.

### 4.4 Checkbox / Radio / Switch

- Square checkbox 16x16, `rounded-sm`, `border-input`. Checked: `bg-primary`, white check icon.
- Radio 16x16 circle.
- Switch 36x20 track, 16x16 thumb. On = `bg-primary`. Use Switch only for instant settings (no save button); otherwise use Checkbox.
- Touch target on mobile is 24x24 minimum (wrap in 24x24 padding container).

### 4.5 Tabs / Segmented Control

- **Tabs:** underline style for page-level navigation (Stats: Overall / Compare / Map / Hero). Underline 2px `bg-primary`, text `text-foreground` active vs `text-muted-foreground` inactive.
- **Segmented control:** for filter toggles (Win/Loss/All, Day/Week/Month). Pill-rounded, full track `bg-muted`, selected pill `bg-card shadow-xs text-foreground`.
- **Mobile rule:** if tabs > 4 or sum width > 100% of viewport, switch to a horizontal scroll container with snap or to a Select.

### 4.6 Top bar (Header)

- Height 56 desktop, 56 mobile.
- Left: SidebarTrigger (mobile only) + page title (h2). Right: language switcher, notification bell, theme toggle, avatar menu.
- Sticky, `bg-background/80 backdrop-blur` border-b `border-border`. z-index 40.
- On mobile, hide page title in header (it's repeated in the page hero) to save space.

### 4.7 Sidebar

- Use existing `@/components/ui/sidebar` primitives. Width: `--sidebar-width: 16rem` desktop, `--sidebar-width-icon: 4rem` collapsed.
- Sections (`SidebarGroupLabel`): Main, Analytics, Management, Communication.
- Active item: `data-[active=true]:bg-sidebar-accent text-sidebar-accent-foreground`. **No** custom hover color — Buttons handle it.
- Collapsible to icon-only on tablet width; on mobile becomes a Sheet drawer triggered from header.
- Footer: user identity + sign-out icon button (`Button size="icon" variant="ghost"`).

### 4.8 Mobile drawer

- Right-edge swipe or hamburger opens; uses shadcn `Sheet` from left side.
- Width 80vw max 320px.
- Same sidebar content but always expanded (no icon-only mode).
- Closes on route change automatically.

### 4.9 Card

- Default: `bg-card text-card-foreground border border-card-border rounded-lg shadow-xs`.
- Padding: `p-5` desktop, `p-4` mobile.
- Composition: `CardHeader` (h3 title + optional `CardDescription`), `CardContent`, optional `CardFooter` (right-aligned actions).
- Hover-elevate only when the entire card is clickable (links to a detail page). Never on static cards.
- **Never nest** a Card in a Card. If you need grouping inside, use a `border-t border-border` divider.

### 4.10 KPI / Stat Card

- Composition (top → bottom): overline label (`text-13 text-muted-foreground uppercase tracking-wide`), value (`display` style, tabular-nums), trend chip (success/destructive with `ArrowUp/Down`), optional spark (24px tall, theme `chart-1`).
- Width: 1/4 grid on desktop, 1/2 on tablet, 1/1 mobile.
- Loading: skeleton matching the value bounding box (`h-9 w-24`).

### 4.11 Table / List

- Header row: `text-11 uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/50`.
- Body row: `border-b border-border/60`, hover via `hover-elevate`.
- Numeric columns: `text-right tabular-nums`.
- Row height: 44 default, 36 dense.
- Sticky header on scrolled tables (`sticky top-0 z-10 bg-card`).
- **Mobile:** tables convert to a stack of cards (one row → one card with key/value pairs). Provide a `useTableToCards()` hook OR use the `table-responsive` pattern (overflow-x with `min-w-max`) for purely numeric tables (leaderboards).

### 4.12 Badge / Chip

- `sm` (h-5 px-2 text-11), `default` (h-6 px-2.5 text-12).
- Variants: `default` (primary tint), `secondary`, `outline`, `destructive`, plus the domain utility classes (`role-tank`, `event-scrim`, `result-win`, `status-available`).
- Always single-line, never wraps.
- **Don't** put icon-only Badges next to icon-only Buttons of similar size; users will mistake the badge for an action.

### 4.13 Avatar

- Sizes: 24 (inline mention), 32 (list), 40 (default), 64 (page header), 96 (profile).
- `AvatarImage` + `AvatarFallback` (initials, `bg-muted text-muted-foreground`).
- Status dot: 8x8 circle, bottom-right, `border-2 border-background`. Color from `status.online/away/busy/offline`.
- Group avatars: stack with `-ml-2` overlap, max 5 visible + `+N` chip.

### 4.14 Filter bar

- Top of any list/table page. Composition: search input (left), 1–4 select filters, divider, action button(s) (right).
- Sticky below page header on scroll.
- On mobile: collapses into a single "Filters" button opening a Sheet from bottom; active filter count shown as a badge on the button.

### 4.15 Date picker

- shadcn `Calendar` inside `Popover`.
- Range mode for analytics ("Last 7d / 30d / 90d / Custom") with quick-range buttons in the popover footer.
- Mobile: open as bottom Sheet, full month visible, two-finger horizontal swipe to change month.

### 4.16 Tooltip

- 12px text, `bg-popover` border `border-popover-border` `shadow-md`.
- Delay open 300ms, delay close 100ms.
- Required for: every icon-only Button, every truncated text cell, every abbreviated stat header.
- **Don't** use Tooltip for critical info — it's invisible on touch.

### 4.17 Toast

- Position: bottom-right desktop, top-center mobile (avoid bottom on mobile because of system gesture bar).
- Duration: 5s default, 8s for destructive, sticky for confirmation-required.
- Variants: `default`, `destructive`. Success uses `default` with leading `CheckCircle2` icon (no separate variant).
- Stack max 3; older toasts auto-dismiss when overflowed.
- Always paired with screen-reader announcement (`role="status"` for default, `role="alert"` for destructive).

### 4.18 Empty state

- Composition: 48px Lucide icon (in a 64x64 `bg-muted rounded-full` puck), h3 title, body description, primary CTA, optional secondary "Learn more" link.
- Use illustrations only on Home / Help — never on data screens.
- **Always** offer one specific next action ("Create your first roster"), never just say "No data".

### 4.19 Skeleton loader

- Use `bg-muted animate-pulse rounded-md`.
- Match the dimensions of the real content (height, width, count).
- Show within 100ms; hide as soon as data arrives — no minimum display time.
- For tables, render 5 skeleton rows. For KPI grids, render the same number of cards.
- For charts, a 200px tall skeleton block is acceptable.

### 4.20 Modal / Dialog

- Width: `sm:max-w-md` (default), `max-w-lg` (forms), `max-w-2xl` (advanced editors). Never full-screen on desktop.
- Padding `p-6`, footer right-aligned with primary on the right.
- Backdrop `bg-background/80 backdrop-blur-sm`.
- Esc closes, click-outside closes, except destructive confirmations (must use button to dismiss).
- **Mobile:** convert to bottom Sheet < 640px. Drag handle at top, swipe down to dismiss.

### 4.21 Bottom sheet

- Mobile-only equivalent of Dialog and Popover.
- Heights: `auto` (content-fit), `half` (50vh), `full` (90vh with handle).
- Drag handle: 36x4 `bg-muted-foreground/30 rounded-full` centered top.

### 4.22 Accordion

- Expand/collapse 200ms ease.
- Chevron right on collapsed → down on expanded (rotates).
- Used in: Help, Settings (advanced groups), Filters (mobile).

### 4.23 Pagination

- Compact: `← Prev | Page X of Y | Next →` plus a page-size selector (`10 / 25 / 50 / 100`).
- For long lists (> 50 pages) use a Combobox jump.
- Mobile: collapse to `← Prev / Next →` only with page indicator below.

### 4.24 Banner

- Inline alert above content. Variants: `info`, `success`, `warning`, `destructive`.
- Composition: leading icon + title + body + dismiss `X` (icon button).
- Never sticky except the Subscription Countdown.

### 4.25 Subscription countdown banner

- Sticky top, `z-50`, `bg-warning/15 text-warning-foreground border-b border-warning/40`.
- Composition: clock icon + "Your plan expires in {{days}} days" + `My Plan` button + dismiss.
- Days ≤ 3: switch to `bg-destructive/15 border-destructive/40 text-destructive`.
- Mobile: stays sticky but compresses text to "{days}d left".

### 4.26 Subscription block (expired/inactive)

- Full-page interstitial, no sidebar. Centered Card max-w-md. Composition: large Lock icon, h2 title, body, primary CTA "Contact The Bootcamp", secondary "Sign out".
- Used by `SubscriptionBlock.tsx` — keep that as the single source.

### 4.27 Error state

- Page-level: Card centered, `AlertTriangle` icon (28px, `text-destructive`), title, description, primary "Retry" + secondary "Go home".
- Inline (failed widget): use the empty-state composition with destructive icon.

---

## 5. Screen Map

### Information architecture

```
/login                              Auth
/                                   Home (game launchpad)
/games/:gameId                      Games Home (per-game roster grid)
/dashboard                          Org Dashboard (KPIs across rosters)
/roster/:rosterId                   Roster Dashboard
  /events, /events/:id              Events list + detail
  /history                          Past events
  /players                          Players grid
  /opponents                        Opponents
  /maps                             Maps insights
  /heroes                           Hero insights
  /draft                            Draft stats
  /stats                            Overall stats
    /compare                        Compare tab
    /map-insights                   Map insights tab
    /hero-insights                  Hero insights tab
  /leaderboard/team                 Team leaderboard
  /leaderboard/player               Player leaderboard
/settings                           Org settings (admin)
/account                            Personal account
/subscriptions                      Plan/billing
/help                               Help & guide
/admin/users, /roles, /access       Admin/super-admin pages
/media                              Media library
/chat                               Management chat
```

### Per-screen contracts (page goal · hierarchy · primary CTA · secondary actions · key components · responsive notes)

**Login** — Goal: authenticate. Hierarchy: brand → form → support link. CTA: Sign in. Components: Input (username, password), Button primary, language selector. Responsive: single column always, max-w-sm.

**Home (Games launchpad)** — Goal: pick a game to enter. Hierarchy: hero greeting → game grid → recent activity. CTA: enter a game (whole card clickable). Components: Card with game icon, KPI strip, hover-elevate. Responsive: 1 col mobile, 2 col tablet, 3–4 col desktop.

**Org Dashboard** — Goal: cross-roster KPIs. Hierarchy: KPI strip (4 cards) → upcoming events list → recent results table → activity log. CTA: jump to roster. Components: KPI Card, Table, Banner (subscription if relevant). Responsive: KPIs 1/2/4, lists stack on mobile.

**Roster Dashboard** — Goal: at-a-glance state of one roster. Hierarchy: roster header (name, game, members) → next event countdown → recent results → upcoming schedule. CTA: "Create event". Components: UpcomingCountdown, KPI strip, ScheduleTable.

**Events / Results / History** — Goal: schedule + outcome management. Hierarchy: filter bar → table. CTA: "Create event". Components: Filter bar, Table, Badge (event-type, result), Pagination. Responsive: table → cards on mobile.

**Event Details** — Goal: full event context. Hierarchy: header (title, date, status) → opponent block → map vetoes → hero bans → match results → notes. CTA: "Edit". Components: Tabs, Cards, Map/Hero panels.

**Players** — Goal: roster member overview. Hierarchy: filter (role, availability) → grid of player cards (avatar, role badge, status). CTA: open player. Responsive: grid 1/2/3/4.

**Opponents** — Goal: scout opposing teams. Hierarchy: filter → list of opponents with logo, region, last match result. CTA: "Add opponent". Responsive: list → cards on mobile.

**Maps** — Goal: per-map performance. Hierarchy: filter (game mode) → grid of maps with win-rate KPI + trend spark. CTA: open map detail.

**Heroes / Agents** — Goal: per-hero pick-rate / win-rate. Hierarchy: role tabs (Tank/DPS/Support) → hero grid with portrait, pick%, win%. CTA: open hero detail.

**Draft Stats** — Goal: ban/pick analytics across matches. Hierarchy: range filter → ban frequency chart → pick frequency chart → comp matrix. Components: Chart (qualitative palette).

**Analytics / Overall Stats** — Goal: aggregate insights. Hierarchy: time-range segmented control → KPI strip → multi-series chart → breakdown table. Responsive: chart full-width, KPI grid reflows.

**Compare** — Goal: A vs B comparison. Hierarchy: two selectors at top, side-by-side stat columns, diff column in the middle. Mobile: stack A above B.

**Team Leaderboard** — Goal: rank rosters in org. Hierarchy: filter → leaderboard table (rank, team, W-L, win-rate, trend). Tabular-nums everywhere.

**Player Leaderboard** — Goal: rank players within a roster (or org). Same pattern as team LB; columns are player-stat fields.

**Settings (org)** — Goal: configure org/games/rosters/permissions. Hierarchy: section cards (Organization, Logo, Theme, Permissions, Games & Rosters, Activity Log). Each section is a Card; Activity Log is a list.

**Settings (game config)** — Game modes, maps, seasons, stat fields. Two-column layout on desktop (filter rail + table), stack on mobile.

**Subscription** — Goal: see current plan + manage. Hierarchy: SubscriptionPlanCard (plan name, expiry countdown, status badge), feature list, contact CTA.

**Help** — Goal: onboarding + documentation. Hierarchy: search → category grid → article view (typography-heavy, max prose width 720).

**Admin / Users** — Goal: manage users. Hierarchy: filter + search + table with avatar, name, email, org-role badge, status, actions. Bulk actions surface only when rows selected.

**Admin / Roles** — Goal: edit role permissions. Hierarchy: list of roles + detail panel with permission checkboxes grouped.

**Empty / Error / Blocked** — every list and analytics surface needs all three states designed explicitly. The Subscription Block screen replaces the entire `<main>` when the user has no active plan.

---

## 6. Micro-interactions

Motion philosophy: **fast, subtle, functional**. Default duration **150ms**, easing **`cubic-bezier(0.2, 0, 0, 1)`** (ease-out). Never use bounce / overshoot in operational UI.

| Interaction | Behavior |
|---|---|
| Button press | Scale 0.98 for 80ms via `active-elevate-2`. No ripple. |
| Hover (interactive surface) | Elevate via `hover-elevate`; cursor `pointer`. 0ms in / 100ms out. |
| Focus | `ring-2 ring-ring ring-offset-2` instant; persists until blur. Always visible (never `outline:none` without replacement). |
| Selected | `bg-accent text-accent-foreground` + 2px left accent border *only* on list-style items (sidebar, settings rail). |
| Input focus | Border + ring transition 100ms. No label float. |
| Toggle / Switch | Thumb slides 150ms; track color crossfades 100ms. |
| Tab switch | Underline slides 200ms ease-out between tab triggers. Content crossfades 120ms. |
| Dropdown open | `popover` scales from 0.96 → 1 + opacity 0 → 1 over 120ms, origin top. Close 80ms. |
| Modal open | Scrim fade 150ms; dialog slides from `translateY(8px) scale(0.98)` → 0 over 180ms. |
| Bottom sheet | Slides up 220ms ease-out; drag follows finger 1:1; release > 30% triggers dismiss. |
| Toast | Enters from right (desktop) / top (mobile) over 200ms; auto-dismiss countdown not visualized. |
| Tooltip | Open delay 300ms, fade 100ms; close 100ms instant. |
| Empty state | No motion. Static. |
| Loading | Skeleton renders within 100ms; replaced with content via 80ms crossfade. |
| Success confirmation | Toast + (for destructive operations) row green-flash 600ms. |
| Error confirmation | Toast destructive + offending field shake 200ms (translateX ±4px twice). Use sparingly. |
| Destructive confirm | AlertDialog modal; primary button is destructive variant on the right; requires explicit click — no Enter shortcut. |
| Subscription expiry warning | Banner appears on every page on day ≤ 7; pulses 1× when day count decreases. |
| Theme switch | Body crossfade 200ms via `transition-colors`. No element animates individually. |

Reduced motion: respect `prefers-reduced-motion`. All durations collapse to 0ms for users who request it; opacity transitions remain (50ms) for state legibility.

---

## 7. Dark Mode

Dark mode is the **primary** mode. Light mode is a peer, not a fallback.

### Token mapping rules

- `background` is the deepest layer. `card` is one step lighter. `popover` matches `card`. `sidebar` is one step *darker* than `background` (creates depth without shadows).
- `border` is +6–10% lightness above `background`; `card-border` is +2% above `card`. Borders are visible but never harsh.
- `muted-foreground` must hit **WCAG AA 4.5:1** against `background` AND `card`. Verified for all six themes.
- `primary` lightness in dark themes is +5–10 vs light to maintain contrast on dark surfaces.

### Surface layering strategy (3 layers)

1. `background` — page canvas.
2. `card` / `popover` — first elevation. Always paired with `card-border`.
3. `accent` / hover-elevate overlay — second elevation (selection, hover). Achieved via the `--elevate-1` / `--elevate-2` overlay system in `index.css`, **not** by a third color.

### Borders, not shadows

In dark mode, shadows are subtle (already encoded). Use **borders** to separate surfaces. Reserve `shadow-md+` for genuinely floating elements (dropdowns, dialogs).

### Charts in dark mode

Existing `--chart-1..5` already shift +5–10% lightness in dark themes. For sequential scales (heatmaps), invert direction: dark cells = low value, bright cells = high value.

### Common mistakes to avoid

- Pure white text on pure black — use the encoded `foreground` (95–98% lightness, never 100%).
- Large saturated brand color blocks (full-bleed primary headers) — they vibrate on OLED. Use 15–25% opacity tints.
- Shadows substituting for borders.
- Inverting colored badges (don't make `result-win` cyan in dark mode — keep semantic green).
- Elevating cards with white-on-white in light mode — use `card-border` instead.

---

## 8. Responsive / Mobile Rules

### Breakpoints (Tailwind defaults — keep them)

| Name | Min width | Layout intent |
|---|---|---|
| (base) | 0 | Mobile portrait |
| `sm` | 640 | Mobile landscape / small tablet |
| `md` | 768 | Tablet |
| `lg` | 1024 | Small laptop / sidebar starts persistent |
| `xl` | 1280 | Standard desktop |
| `2xl` | 1536 | Large desktop |

### What collapses

| Element | < md | md – lg | ≥ lg |
|---|---|---|---|
| Sidebar | Sheet drawer (closed) | Icon-only collapsible | Expanded persistent |
| Header title | Hidden (in page) | Visible | Visible |
| Filter bar | Single "Filters" button → Sheet | Inline, wraps | Inline single row |
| Tables | Stack as cards (key/value) — except leaderboards which scroll horizontally with sticky first column | Horizontal scroll OK | Full-width |
| KPI grid | 1 col | 2 col | 4 col |
| Card grid (rosters/games/players) | 1 col | 2 col | 3–4 col |
| Tabs | If overflow: horizontal scroll-snap; if > 5 items convert to Select | Inline | Inline |
| Dialog | Bottom Sheet | Centered Dialog | Centered Dialog |
| Date picker | Bottom Sheet, single month | Popover | Popover, two months for ranges |

### Hard rules

- **Touch target ≥ 44x44** on mobile. Wrap small icons in extra padding.
- **Never** rely on hover for critical info on mobile.
- **No horizontal scroll** on mobile except inside opt-in containers (leaderboard tables, draft matrix).
- **One primary action per viewport** on mobile. Secondary actions go inside a `MoreHorizontal` menu.
- **Bottom-safe area:** add `pb-[env(safe-area-inset-bottom)]` to sticky bottom UI.

---

## 9. React Native Starter Code

Architecture:

```
mobile/
├── theme/
│   ├── tokens.ts          # raw HSL tuples (mirror of web)
│   ├── lightTheme.ts
│   ├── darkTheme.ts
│   ├── ThemeProvider.tsx  # context + useTheme hook
│   └── types.ts
├── components/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── TopAppBar.tsx
│   ├── BottomNavigation.tsx
│   ├── StatCard.tsx
│   ├── Sheet.tsx
│   ├── EmptyState.tsx
│   └── Skeleton.tsx
└── icons.ts               # re-export from lucide-react-native
```

### `theme/tokens.ts`

```ts
const hsl = (h: number, s: number, l: number, a = 1) =>
  `hsla(${h}, ${s}%, ${l}%, ${a})`;

export const palette = {
  light: {
    background: hsl(210, 40, 98),
    foreground: hsl(222, 47, 11),
    card: hsl(0, 0, 100),
    cardBorder: hsl(214, 32, 91),
    border: hsl(214, 32, 91),
    sidebar: hsl(210, 40, 96),
    primary: hsl(199, 89, 48),
    primaryFg: hsl(0, 0, 100),
    secondary: hsl(210, 40, 94),
    muted: hsl(210, 40, 96),
    mutedFg: hsl(215, 16, 47),
    accent: hsl(12, 76, 95),
    accentFg: hsl(12, 76, 35),
    destructive: hsl(0, 84, 60),
    destructiveFg: hsl(0, 0, 100),
    success: hsl(142, 71, 45),
    warning: hsl(43, 96, 56),
    chart1: hsl(199, 89, 48),
    chart2: hsl(262, 83, 58),
    chart3: hsl(142, 71, 45),
    chart4: hsl(12, 76, 61),
    chart5: hsl(43, 96, 56),
  },
  dark: {
    background: hsl(222, 47, 11),
    foreground: hsl(210, 40, 98),
    card: hsl(217, 33, 14),
    cardBorder: hsl(217, 33, 22),
    border: hsl(217, 33, 20),
    sidebar: hsl(222, 47, 9),
    primary: hsl(199, 89, 48),
    primaryFg: hsl(0, 0, 100),
    secondary: hsl(217, 33, 18),
    muted: hsl(217, 33, 16),
    mutedFg: hsl(215, 20, 65),
    accent: hsl(12, 76, 25),
    accentFg: hsl(12, 76, 90),
    destructive: hsl(0, 84, 60),
    destructiveFg: hsl(0, 0, 100),
    success: hsl(142, 71, 45),
    warning: hsl(43, 96, 56),
    chart1: hsl(199, 89, 55),
    chart2: hsl(262, 83, 65),
    chart3: hsl(142, 71, 50),
    chart4: hsl(12, 76, 65),
    chart5: hsl(43, 96, 60),
  },
};

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 };
export const radius = { sm: 3, md: 6, lg: 9, full: 9999 };
export const fontSize = { caption: 12, small: 13, body: 14, h4: 16, h3: 18, h2: 22, h1: 28, display: 36 };
export const fontWeight = { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const };
```

### `theme/ThemeProvider.tsx`

```tsx
import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { palette, space, radius, fontSize, fontWeight } from './tokens';

type Mode = 'light' | 'dark' | 'system';
type Theme = ReturnType<typeof buildTheme>;

const buildTheme = (mode: 'light' | 'dark') => ({
  mode,
  colors: palette[mode],
  space, radius, fontSize, fontWeight,
});

const ThemeContext = createContext<{ theme: Theme; mode: Mode; setMode: (m: Mode) => void }>(
  { theme: buildTheme('dark'), mode: 'system', setMode: () => {} }
);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = useColorScheme();
  const [mode, setMode] = useState<Mode>('system');
  const resolved: 'light' | 'dark' = mode === 'system' ? (system ?? 'dark') : mode;
  const theme = useMemo(() => buildTheme(resolved), [resolved]);
  return <ThemeContext.Provider value={{ theme, mode, setMode }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext).theme;
export const useThemeMode = () => useContext(ThemeContext);
```

### `components/Button.tsx`

```tsx
import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'default' | 'lg';

export const Button: React.FC<{
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
}> = ({ label, onPress, variant = 'primary', size = 'default', disabled, loading, leadingIcon }) => {
  const t = useTheme();

  const heights = { sm: 32, default: 44, lg: 48 }; // 44 default for mobile a11y
  const paddings = { sm: t.space[3], default: t.space[4], lg: t.space[5] };
  const fontSizes = { sm: t.fontSize.small, default: t.fontSize.body, lg: t.fontSize.h4 };

  const palettes: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary:     { bg: t.colors.primary,     fg: t.colors.primaryFg },
    secondary:   { bg: t.colors.secondary,   fg: t.colors.foreground },
    outline:     { bg: 'transparent',        fg: t.colors.foreground, border: t.colors.border },
    ghost:       { bg: 'transparent',        fg: t.colors.foreground },
    destructive: { bg: t.colors.destructive, fg: t.colors.destructiveFg },
  };
  const p = palettes[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }): ViewStyle => ({
        height: heights[size],
        paddingHorizontal: paddings[size],
        backgroundColor: p.bg,
        borderRadius: t.radius.md,
        borderWidth: p.border ? 1 : 0,
        borderColor: p.border,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.space[2],
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.fg} />
      ) : (
        leadingIcon && <View>{leadingIcon}</View>
      )}
      <Text style={{ color: p.fg, fontSize: fontSizes[size], fontWeight: t.fontWeight.medium }}>
        {label}
      </Text>
    </Pressable>
  );
};
```

### `components/Input.tsx`

```tsx
import React, { useState } from 'react';
import { TextInput, View, Text, TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Input: React.FC<TextInputProps & {
  label?: string;
  error?: string;
  helper?: string;
}> = ({ label, error, helper, ...rest }) => {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: t.space[2] }}>
      {label && (
        <Text style={{ color: t.colors.foreground, fontSize: t.fontSize.caption, fontWeight: t.fontWeight.medium }}>
          {label}
        </Text>
      )}
      <TextInput
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        placeholderTextColor={t.colors.mutedFg}
        style={{
          height: 44,
          paddingHorizontal: t.space[3],
          color: t.colors.foreground,
          backgroundColor: t.colors.card,
          borderWidth: 1,
          borderColor: error ? t.colors.destructive : focused ? t.colors.primary : t.colors.border,
          borderRadius: t.radius.md,
          fontSize: t.fontSize.body,
        }}
      />
      {(error || helper) && (
        <Text style={{ color: error ? t.colors.destructive : t.colors.mutedFg, fontSize: t.fontSize.small }}>
          {error || helper}
        </Text>
      )}
    </View>
  );
};
```

### `components/Card.tsx`

```tsx
import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Card: React.FC<ViewProps> = ({ style, ...rest }) => {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[{
        backgroundColor: t.colors.card,
        borderColor: t.colors.cardBorder,
        borderWidth: 1,
        borderRadius: t.radius.lg,
        padding: t.space[4],
        gap: t.space[3],
      }, style]}
    />
  );
};
```

### `components/TopAppBar.tsx`

```tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const TopAppBar: React.FC<{
  title: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}> = ({ title, leading, trailing }) => {
  const t = useTheme();
  return (
    <View style={{
      height: 56,
      paddingHorizontal: t.space[4],
      backgroundColor: t.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      flexDirection: 'row', alignItems: 'center', gap: t.space[3],
    }}>
      {leading}
      <Text style={{ flex: 1, color: t.colors.foreground, fontSize: t.fontSize.h3, fontWeight: t.fontWeight.semibold }}>
        {title}
      </Text>
      {trailing}
    </View>
  );
};
```

### `components/BottomNavigation.tsx`

```tsx
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Tab = { key: string; label: string; icon: React.ReactNode };
export const BottomNavigation: React.FC<{ tabs: Tab[]; active: string; onChange: (k: string) => void }> = ({
  tabs, active, onChange,
}) => {
  const t = useTheme();
  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: t.colors.card,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      paddingBottom: 8,
    }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: t.space[2], gap: 2 }}
          >
            {tab.icon}
            <Text style={{
              fontSize: t.fontSize.caption,
              color: isActive ? t.colors.primary : t.colors.mutedFg,
              fontWeight: isActive ? t.fontWeight.semibold : t.fontWeight.regular,
            }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};
```

### `components/StatCard.tsx`

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import { Card } from './Card';
import { useTheme } from '../theme/ThemeProvider';

export const StatCard: React.FC<{ label: string; value: string; trend?: { dir: 'up' | 'down'; value: string } }> = ({
  label, value, trend,
}) => {
  const t = useTheme();
  const trendColor = trend?.dir === 'up' ? t.colors.success : t.colors.destructive;
  return (
    <Card style={{ flex: 1, gap: t.space[1] }}>
      <Text style={{ fontSize: t.fontSize.caption, color: t.colors.mutedFg, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: t.fontSize.display, fontWeight: t.fontWeight.bold, color: t.colors.foreground, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {trend && (
        <Text style={{ fontSize: t.fontSize.small, color: trendColor }}>
          {trend.dir === 'up' ? '▲' : '▼'} {trend.value}
        </Text>
      )}
    </Card>
  );
};
```

### `components/Sheet.tsx` (bottom sheet)

```tsx
import React from 'react';
import { Modal, Pressable, View, Animated, useAnimatedValue, Dimensions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Sheet: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode }> = ({
  open, onClose, children,
}) => {
  const t = useTheme();
  const translateY = useAnimatedValue(Dimensions.get('window').height);
  React.useEffect(() => {
    Animated.timing(translateY, { toValue: open ? 0 : 800, duration: 220, useNativeDriver: true }).start();
  }, [open]);
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <Animated.View style={{
        transform: [{ translateY }],
        backgroundColor: t.colors.card,
        borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg,
        padding: t.space[4], paddingBottom: t.space[8],
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.colors.border, alignSelf: 'center', marginBottom: t.space[3] }} />
        {children}
      </Animated.View>
    </Modal>
  );
};
```

### `components/EmptyState.tsx` & `components/Skeleton.tsx`

```tsx
import React from 'react';
import { View, Text, Animated, useAnimatedValue } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

export const EmptyState: React.FC<{
  icon: React.ReactNode; title: string; description?: string; actionLabel?: string; onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: t.space[8], gap: t.space[3] }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.muted, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ fontSize: t.fontSize.h3, fontWeight: t.fontWeight.semibold, color: t.colors.foreground, textAlign: 'center' }}>{title}</Text>
      {description && (
        <Text style={{ fontSize: t.fontSize.body, color: t.colors.mutedFg, textAlign: 'center' }}>{description}</Text>
      )}
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} />}
    </View>
  );
};

export const Skeleton: React.FC<{ width?: number | string; height?: number; borderRadius?: number }> = ({
  width = '100%', height = 16, borderRadius,
}) => {
  const t = useTheme();
  const opacity = useAnimatedValue(0.5);
  React.useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width, height, borderRadius: borderRadius ?? t.radius.md, backgroundColor: t.colors.muted, opacity }} />;
};
```

---

## 10. Flutter Starter Code

Architecture:

```
lib/
├── theme/
│   ├── tokens.dart
│   ├── app_theme.dart          # ThemeData factory for light & dark
│   └── theme_extensions.dart   # custom extensions (chart palette, semantic colors)
└── components/
    ├── app_button.dart
    ├── app_input.dart
    ├── app_card.dart
    ├── app_top_bar.dart
    ├── app_bottom_nav.dart
    ├── stat_card.dart
    ├── app_sheet.dart
    ├── empty_state.dart
    └── skeleton.dart
```

### `theme/tokens.dart`

```dart
import 'package:flutter/material.dart';

class Tokens {
  static Color hsl(double h, double s, double l, [double a = 1]) =>
      HSLColor.fromAHSL(a, h, s / 100, l / 100).toColor();

  // Spacing (4px base)
  static const space0 = 0.0, space1 = 4.0, space2 = 8.0, space3 = 12.0,
      space4 = 16.0, space5 = 20.0, space6 = 24.0, space8 = 32.0,
      space10 = 40.0, space12 = 48.0, space16 = 64.0;

  // Radius
  static const radiusSm = 3.0, radiusMd = 6.0, radiusLg = 9.0, radiusFull = 9999.0;

  // Type
  static const fsCaption = 12.0, fsSmall = 13.0, fsBody = 14.0, fsH4 = 16.0,
      fsH3 = 18.0, fsH2 = 22.0, fsH1 = 28.0, fsDisplay = 36.0;
}

class AppPalette {
  final Color background, foreground, card, cardBorder, border, sidebar;
  final Color primary, primaryFg, secondary, muted, mutedFg, accent, accentFg;
  final Color destructive, destructiveFg, success, warning;
  final List<Color> chart;
  const AppPalette({
    required this.background, required this.foreground, required this.card,
    required this.cardBorder, required this.border, required this.sidebar,
    required this.primary, required this.primaryFg, required this.secondary,
    required this.muted, required this.mutedFg, required this.accent, required this.accentFg,
    required this.destructive, required this.destructiveFg,
    required this.success, required this.warning, required this.chart,
  });
}

final lightPalette = AppPalette(
  background: Tokens.hsl(210, 40, 98),
  foreground: Tokens.hsl(222, 47, 11),
  card: Tokens.hsl(0, 0, 100),
  cardBorder: Tokens.hsl(214, 32, 91),
  border: Tokens.hsl(214, 32, 91),
  sidebar: Tokens.hsl(210, 40, 96),
  primary: Tokens.hsl(199, 89, 48),
  primaryFg: Tokens.hsl(0, 0, 100),
  secondary: Tokens.hsl(210, 40, 94),
  muted: Tokens.hsl(210, 40, 96),
  mutedFg: Tokens.hsl(215, 16, 47),
  accent: Tokens.hsl(12, 76, 95),
  accentFg: Tokens.hsl(12, 76, 35),
  destructive: Tokens.hsl(0, 84, 60),
  destructiveFg: Tokens.hsl(0, 0, 100),
  success: Tokens.hsl(142, 71, 45),
  warning: Tokens.hsl(43, 96, 56),
  chart: [Tokens.hsl(199,89,48), Tokens.hsl(262,83,58), Tokens.hsl(142,71,45), Tokens.hsl(12,76,61), Tokens.hsl(43,96,56)],
);

final darkPalette = AppPalette(
  background: Tokens.hsl(222, 47, 11),
  foreground: Tokens.hsl(210, 40, 98),
  card: Tokens.hsl(217, 33, 14),
  cardBorder: Tokens.hsl(217, 33, 22),
  border: Tokens.hsl(217, 33, 20),
  sidebar: Tokens.hsl(222, 47, 9),
  primary: Tokens.hsl(199, 89, 48),
  primaryFg: Tokens.hsl(0, 0, 100),
  secondary: Tokens.hsl(217, 33, 18),
  muted: Tokens.hsl(217, 33, 16),
  mutedFg: Tokens.hsl(215, 20, 65),
  accent: Tokens.hsl(12, 76, 25),
  accentFg: Tokens.hsl(12, 76, 90),
  destructive: Tokens.hsl(0, 84, 60),
  destructiveFg: Tokens.hsl(0, 0, 100),
  success: Tokens.hsl(142, 71, 45),
  warning: Tokens.hsl(43, 96, 56),
  chart: [Tokens.hsl(199,89,55), Tokens.hsl(262,83,65), Tokens.hsl(142,71,50), Tokens.hsl(12,76,65), Tokens.hsl(43,96,60)],
);
```

### `theme/app_theme.dart`

```dart
import 'package:flutter/material.dart';
import 'tokens.dart';
import 'theme_extensions.dart';

ThemeData buildAppTheme(AppPalette p, Brightness brightness) {
  final base = ThemeData(useMaterial3: true, brightness: brightness);
  return base.copyWith(
    scaffoldBackgroundColor: p.background,
    colorScheme: ColorScheme(
      brightness: brightness,
      primary: p.primary, onPrimary: p.primaryFg,
      secondary: p.secondary, onSecondary: p.foreground,
      error: p.destructive, onError: p.destructiveFg,
      surface: p.card, onSurface: p.foreground,
      surfaceContainerHighest: p.muted,
      outline: p.border, outlineVariant: p.cardBorder,
    ),
    textTheme: base.textTheme.copyWith(
      displayLarge: TextStyle(fontSize: Tokens.fsDisplay, fontWeight: FontWeight.w700, color: p.foreground),
      headlineMedium: TextStyle(fontSize: Tokens.fsH1, fontWeight: FontWeight.w700, color: p.foreground),
      titleLarge: TextStyle(fontSize: Tokens.fsH2, fontWeight: FontWeight.w600, color: p.foreground),
      titleMedium: TextStyle(fontSize: Tokens.fsH3, fontWeight: FontWeight.w600, color: p.foreground),
      bodyMedium: TextStyle(fontSize: Tokens.fsBody, color: p.foreground),
      bodySmall: TextStyle(fontSize: Tokens.fsSmall, color: p.mutedFg),
      labelSmall: TextStyle(fontSize: Tokens.fsCaption, fontWeight: FontWeight.w500, color: p.mutedFg),
    ),
    extensions: [AppSemantics(success: p.success, warning: p.warning, accent: p.accent, accentFg: p.accentFg, chart: p.chart, sidebar: p.sidebar)],
  );
}

final appLight = buildAppTheme(lightPalette, Brightness.light);
final appDark  = buildAppTheme(darkPalette,  Brightness.dark);
```

### `theme/theme_extensions.dart`

```dart
import 'package:flutter/material.dart';

@immutable
class AppSemantics extends ThemeExtension<AppSemantics> {
  final Color success, warning, accent, accentFg, sidebar;
  final List<Color> chart;
  const AppSemantics({required this.success, required this.warning, required this.accent, required this.accentFg, required this.sidebar, required this.chart});

  @override AppSemantics copyWith({Color? success, Color? warning, Color? accent, Color? accentFg, Color? sidebar, List<Color>? chart}) =>
    AppSemantics(success: success ?? this.success, warning: warning ?? this.warning, accent: accent ?? this.accent, accentFg: accentFg ?? this.accentFg, sidebar: sidebar ?? this.sidebar, chart: chart ?? this.chart);

  @override AppSemantics lerp(ThemeExtension<AppSemantics>? other, double t) {
    if (other is! AppSemantics) return this;
    return AppSemantics(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentFg: Color.lerp(accentFg, other.accentFg, t)!,
      sidebar: Color.lerp(sidebar, other.sidebar, t)!,
      chart: List.generate(chart.length, (i) => Color.lerp(chart[i], other.chart[i], t)!),
    );
  }
}
```

### `components/app_button.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/tokens.dart';

enum AppButtonVariant { primary, secondary, outline, ghost, destructive }
enum AppButtonSize { sm, md, lg }

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final IconData? leadingIcon;
  final bool loading;
  const AppButton({super.key, required this.label, this.onPressed, this.variant = AppButtonVariant.primary, this.size = AppButtonSize.md, this.leadingIcon, this.loading = false});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final heights = {AppButtonSize.sm: 32.0, AppButtonSize.md: 44.0, AppButtonSize.lg: 48.0};
    final paddings = {AppButtonSize.sm: 12.0, AppButtonSize.md: 16.0, AppButtonSize.lg: 20.0};
    final fontSizes = {AppButtonSize.sm: Tokens.fsSmall, AppButtonSize.md: Tokens.fsBody, AppButtonSize.lg: Tokens.fsH4};

    Color bg; Color fg; BorderSide? border;
    switch (variant) {
      case AppButtonVariant.primary:     bg = cs.primary; fg = cs.onPrimary; break;
      case AppButtonVariant.secondary:   bg = cs.secondary; fg = cs.onSurface; break;
      case AppButtonVariant.outline:     bg = Colors.transparent; fg = cs.onSurface; border = BorderSide(color: cs.outline); break;
      case AppButtonVariant.ghost:       bg = Colors.transparent; fg = cs.onSurface; break;
      case AppButtonVariant.destructive: bg = cs.error; fg = cs.onError; break;
    }

    return SizedBox(
      height: heights[size],
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: bg, foregroundColor: fg,
          padding: EdgeInsets.symmetric(horizontal: paddings[size]!),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.radiusMd), side: border ?? BorderSide.none),
          textStyle: TextStyle(fontSize: fontSizes[size], fontWeight: FontWeight.w500),
        ),
        child: loading
          ? SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
          : Row(mainAxisSize: MainAxisSize.min, children: [
              if (leadingIcon != null) ...[Icon(leadingIcon, size: 16), const SizedBox(width: Tokens.space2)],
              Text(label),
            ]),
      ),
    );
  }
}
```

### `components/app_input.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/tokens.dart';

class AppInput extends StatelessWidget {
  final String? label, helper, error, hint;
  final TextEditingController? controller;
  final bool obscure;
  const AppInput({super.key, this.label, this.helper, this.error, this.hint, this.controller, this.obscure = false});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (label != null) Padding(padding: const EdgeInsets.only(bottom: Tokens.space2),
        child: Text(label!, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: cs.onSurface))),
      TextField(
        controller: controller, obscureText: obscure,
        decoration: InputDecoration(
          hintText: hint,
          filled: true, fillColor: cs.surface,
          contentPadding: const EdgeInsets.symmetric(horizontal: Tokens.space3, vertical: Tokens.space3),
          border:        OutlineInputBorder(borderSide: BorderSide(color: cs.outline), borderRadius: BorderRadius.circular(Tokens.radiusMd)),
          enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: error != null ? cs.error : cs.outline), borderRadius: BorderRadius.circular(Tokens.radiusMd)),
          focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: error != null ? cs.error : cs.primary, width: 2), borderRadius: BorderRadius.circular(Tokens.radiusMd)),
        ),
      ),
      if (error != null || helper != null) Padding(padding: const EdgeInsets.only(top: Tokens.space2),
        child: Text(error ?? helper!, style: TextStyle(fontSize: Tokens.fsSmall, color: error != null ? cs.error : cs.onSurfaceVariant))),
    ]);
  }
}
```

### `components/app_card.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/tokens.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(Tokens.space4)});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: cs.surface,
        border: Border.all(color: cs.outlineVariant),
        borderRadius: BorderRadius.circular(Tokens.radiusLg),
      ),
      child: child,
    );
  }
}
```

### `components/app_top_bar.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/tokens.dart';

class AppTopBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  const AppTopBar({super.key, required this.title, this.actions, this.leading});

  @override Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return AppBar(
      title: Text(title, style: Theme.of(context).textTheme.titleMedium),
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      leading: leading,
      actions: actions,
      shape: Border(bottom: BorderSide(color: cs.outline)),
      toolbarHeight: 56,
    );
  }
}
```

### `components/app_bottom_nav.dart`

```dart
import 'package:flutter/material.dart';

class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<NavigationDestination> destinations;
  const AppBottomNav({super.key, required this.currentIndex, required this.onTap, required this.destinations});

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      destinations: destinations,
      backgroundColor: Theme.of(context).colorScheme.surface,
      indicatorColor: Theme.of(context).colorScheme.primary.withOpacity(0.15),
    );
  }
}
```

### `components/stat_card.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/tokens.dart';
import '../theme/theme_extensions.dart';
import 'app_card.dart';

class StatCard extends StatelessWidget {
  final String label; final String value;
  final ({String value, bool up})? trend;
  const StatCard({super.key, required this.label, required this.value, this.trend});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final sem = Theme.of(context).extension<AppSemantics>()!;
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label.toUpperCase(), style: TextStyle(fontSize: Tokens.fsCaption, letterSpacing: 0.5, color: cs.onSurfaceVariant)),
      const SizedBox(height: Tokens.space1),
      Text(value, style: TextStyle(fontSize: Tokens.fsDisplay, fontWeight: FontWeight.w700, color: cs.onSurface, fontFeatures: const [FontFeature.tabularFigures()])),
      if (trend != null) Padding(padding: const EdgeInsets.only(top: Tokens.space1),
        child: Text('${trend!.up ? "▲" : "▼"} ${trend!.value}', style: TextStyle(fontSize: Tokens.fsSmall, color: trend!.up ? sem.success : cs.error))),
    ]));
  }
}
```

### `components/app_sheet.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/tokens.dart';

Future<T?> showAppSheet<T>(BuildContext context, {required Widget child, bool fullHeight = false}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: fullHeight,
    backgroundColor: Theme.of(context).colorScheme.surface,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Tokens.radiusLg))),
    builder: (_) => Padding(
      padding: const EdgeInsets.fromLTRB(Tokens.space4, Tokens.space3, Tokens.space4, Tokens.space8),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 36, height: 4, decoration: BoxDecoration(color: Theme.of(context).colorScheme.outline, borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: Tokens.space3),
        Flexible(child: child),
      ]),
    ),
  );
}
```

### `components/empty_state.dart` & `components/skeleton.dart`

```dart
import 'package:flutter/material.dart';
import '../theme/tokens.dart';
import 'app_button.dart';

class EmptyState extends StatelessWidget {
  final IconData icon; final String title; final String? description; final String? actionLabel; final VoidCallback? onAction;
  const EmptyState({super.key, required this.icon, required this.title, this.description, this.actionLabel, this.onAction});
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(padding: const EdgeInsets.all(Tokens.space8),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 64, height: 64, decoration: BoxDecoration(color: cs.surfaceContainerHighest, shape: BoxShape.circle), child: Icon(icon, size: 28, color: cs.onSurface)),
        const SizedBox(height: Tokens.space3),
        Text(title, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
        if (description != null) Padding(padding: const EdgeInsets.only(top: Tokens.space2), child: Text(description!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant), textAlign: TextAlign.center)),
        if (actionLabel != null && onAction != null) Padding(padding: const EdgeInsets.only(top: Tokens.space4), child: AppButton(label: actionLabel!, onPressed: onAction)),
      ]),
    );
  }
}

class Skeleton extends StatefulWidget {
  final double? width; final double height; final double? radius;
  const Skeleton({super.key, this.width, this.height = 16, this.radius});
  @override State<Skeleton> createState() => _SkeletonState();
}
class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat(reverse: true);
  @override void dispose() { c.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return AnimatedBuilder(animation: c, builder: (_, __) => Opacity(opacity: 0.5 + 0.5 * c.value,
      child: Container(width: widget.width, height: widget.height,
        decoration: BoxDecoration(color: cs.surfaceContainerHighest, borderRadius: BorderRadius.circular(widget.radius ?? Tokens.radiusMd)))));
  }
}
```

---

## 11. Engineering Handoff

### Token naming convention

`<category>.<role>[.<modifier>]` — lowercase, dot-separated.

Examples:
- `color.background`, `color.foreground`, `color.muted.foreground`
- `color.primary`, `color.primary.foreground`, `color.primary.border`
- `color.status.available.bg`, `color.status.available.fg`
- `space.4`, `radius.md`, `shadow.lg`, `font.size.body`, `font.weight.semibold`

In CSS, keep current `--background`, `--card-foreground` style (already established). In Figma, mirror as Variables with the dot path. Both sides lookup the same `design/tokens.json`.

### Recommended folder structure (web — matches today's repo)

```
client/src/
├── components/
│   ├── ui/                  # shadcn primitives (don't fork; extend via wrapper)
│   ├── app-sidebar.tsx
│   ├── SubscriptionCountdownBanner.tsx
│   └── …
├── pages/                   # one file per route
├── hooks/
├── lib/
├── i18n/
└── index.css                # tokens (single source of truth for color)
design/
├── DESIGN_SYSTEM.md         # this file
└── tokens.json              # exported from Figma Variables
```

### Component naming convention

- Primitives: PascalCase, single noun (`Button`, `Card`, `Badge`).
- Composites: PascalCase, two words (`StatCard`, `EmptyState`, `FilterBar`).
- Page-specific compositions: PascalCase + page suffix only when reused (`PlayersGrid`, `RosterHeader`); otherwise inline within the page file.
- Boolean props: `isLoading`, `isDisabled`, `hasIcon` — never negative (`isNotDisabled`).
- Variant props: union literal types (`variant: "primary" | "secondary" | "ghost"`), never enums.
- Test IDs: `{action}-{target}` for interactive, `{type}-{content}` for display, append `${id}` for repeated items. Already enforced in this codebase.

### Build order — what to standardize first

Phase 1 (foundation, no visible change):
1. Audit every page for raw color literals → replace with semantic tokens. Keep `status-*`, `role-*`, `event-*`, `result-*` utility classes intact.
2. Audit every page for raw spacing values that don't match the 4px scale. Replace with Tailwind scale.
3. Verify all interactive elements have `data-testid`.

Phase 2 (component normalization):
4. Replace any custom Buttons, Cards, Badges with shadcn primitives.
5. Standardize page header pattern (icon + h1 + description + right-aligned action) across all pages.
6. Standardize Filter Bar usage on every list page.
7. Add explicit Empty / Error / Loading states to every list and analytics widget.

Phase 3 (mobile pass):
8. Convert dialogs to bottom Sheet on `< 640px`.
9. Convert tables to card stacks (or sticky-first-column scroll for leaderboards).
10. Audit touch targets to ≥ 44px on mobile.

Phase 4 (motion + a11y):
11. Migrate any custom transitions to the standard 150ms / cubic-bezier easing.
12. Add `prefers-reduced-motion` support globally (CSS media query that zeroes durations).
13. Run axe / WAVE audit on every page; fix label, contrast, and focus-order issues.

### What to audit later (recurring)

- Token diff: `design/tokens.json` vs `index.css` — automate in CI as a JSON-vs-CSS comparator.
- Contrast: WCAG AA (4.5:1 text, 3:1 UI) for every theme on first paint of every page.
- Empty / error / loading triad: every list, every chart, every form.
- Mobile heuristics: every new page must include a 390px screenshot in PR.
- Translation keys: no raw English in JSX strings (already enforced via wave audits).

### How design and engineering stay in sync

- **Single source of truth for color and spacing is `client/src/index.css`.** Figma Variables export to `design/tokens.json`; CI fails if `tokens.json` diverges from `index.css`.
- **One PR template field:** "Tokens used / new tokens introduced" — must be empty or call out additions explicitly.
- **Weekly 30-min design QA pass** on the `08 QA / Audit` Figma page — review any new `data-testid`s and component variants from the past week.
- **No new colors without a token.** New domain semantic colors (e.g., a future `event-bootcamp` class) live in `index.css` utilities, not inline.
- **Component changes are versioned** in the Figma library description and called out in CHANGELOG.

### What to standardize before redesigning screens

Do not redesign screens until:

1. Token usage is clean (Phase 1 above).
2. Page-header / filter-bar / table-row / empty-state / loading-state patterns are defined as reusable components and applied to one reference page (suggest: Players or Events).
3. Mobile responsive rules above are encoded as Tailwind utilities you can reach for (`md:hidden`, `md:flex`, drawer/sheet conventions).

After those three are true, screen redesigns become token + composition work — fast and consistent. Without them, every screen drifts.

---

**End of Design System v1.0.**
Ownership: design + engineering, jointly. Update by PR to `design/DESIGN_SYSTEM.md` with corresponding Figma library version bump.
