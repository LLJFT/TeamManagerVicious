# Vicious — Brand Guidelines

Version 1.0 · Visual Identity System for the Vicious Esports Multi-Game Management Platform.

This document defines the brand strategy, logo system, color, typography, graphic language, applications, usage rules, and extensions for the Vicious platform. It is the single source of truth for the in-app UI, sales decks, documentation, social profiles, and any future marketing surface.

---

## 1. Brand Strategy

### Positioning
Vicious is the command center for serious multi-game esports organizations. Coaches, managers, and analysts use it to schedule rosters, prep matches, scout opponents, and scale their operation across many games and many teams — without juggling spreadsheets, group chats, and ad-hoc trackers.

### Personality
- Tactical
- Premium
- Confident, not loud
- Operator-grade — built for people who run teams, not for casual fans
- Quietly intense

### Tone
- Direct, technical, and respectful of the user's time
- Short sentences, strong verbs
- No hype, no emojis, no startup fluff
- Speaks like a head coach in a film-review room

### Audience
- Org owners and team managers running 3+ rosters across multiple titles
- Head coaches and analysts preparing scrims, tournaments, and VOD reviews
- Players and staff who consume schedules, stats, and assignments

### Emotional positioning
We make organizations feel **in control**. Vicious replaces the chaos of running a team with structured, repeatable competitive workflows.

### Visual direction
- Dark, premium surfaces with restrained color
- One sharp accent (Vicious Crimson) used as a tactical highlight, never as wallpaper
- Carbon and steel neutrals
- Geometric, type-led — not illustrative
- Clean grid, tight spacing, confident typography
- Inspired by tactical dashboards, broadcast lower-thirds, and professional sports operations software

### Feels like
Tactical command center · Pro broadcast graphics · Premium analytics dashboard · Coach's playbook · Operations console.

### Does NOT feel like
Cartoonish gaming · Neon RGB clutter · Generic SaaS startup · Casual social app · Marketing landing-page kit.

---

## 2. Logo System

The Vicious mark is built around a sharp, angular **V** that reads as both a chevron (forward momentum, velocity) and a peak (apex, top performance). It is paired with a heavy, wide-tracked geometric wordmark.

### Variants and where to use them
| Variant | File | Use |
|---|---|---|
| Icon mark (dark bg) | `logos/vicious-icon.svg` | App icon, social avatar, favicons, splash |
| Icon mark (light bg) | `logos/vicious-icon-light.svg` | Light-mode favicons and avatars |
| Symbol only | `logos/vicious-symbol.svg` | Inline UI mark, monochrome contexts (uses `currentColor`) |
| Wordmark | `logos/vicious-wordmark.svg` | Standalone wordmark on covers, banners |
| Horizontal lockup (dark) | `logos/vicious-horizontal-dark.svg` | Headers, deck covers, doc covers on dark surfaces |
| Horizontal lockup (light) | `logos/vicious-horizontal-light.svg` | Headers, deck covers, doc covers on light surfaces |
| Stacked lockup | `logos/vicious-stacked.svg` | Posters, deck dividers, square placements |
| Header logo | `logos/vicious-header.svg` | In-app sidebar / nav header |
| Compact icon | `logos/vicious-small.svg` | UI ≤16 px contexts, footers, inline badges |
| App icon (master) | `logos/vicious-app-icon.svg` | Mobile app icon, OG image base |
| Favicon | `logos/vicious-favicon.svg` | Browser favicon |

### Clear space
Reserve clear space on all sides equal to the **width of one bar of the V**. Nothing — text, icons, edges, or imagery — may enter that zone.

### Minimum size
- Icon mark: 16 × 16 px
- Wordmark: 80 px wide
- Horizontal lockup: 120 px wide
- Stacked lockup: 96 px wide

### Don'ts
- Don't recolor the V mark outside the approved palette
- Don't outline, drop-shadow, or 3D-effect the mark
- Don't stretch, skew, or rotate the lockups
- Don't place the dark-background lockup on a light background (and vice versa)
- Don't typeset "Vicious" in a different font and pretend it is the wordmark
- Don't crowd the mark with other logos — give it clear space

---

## 3. Color System

The system is restrained on purpose. **Crimson** is the only loud color. Everything else is carbon, steel, and bone — neutrals that let data and product UI breathe.

### Core palette

| Token | Hex | HSL | Role |
|---|---|---|---|
| Vicious Crimson | `#E11D2E` | `354 75% 50%` | Primary brand color, key actions, focus rings, brand accents |
| Onyx | `#0E1117` | `220 24% 7%` | App background (dark), deck backgrounds |
| Carbon | `#1A1F2A` | `220 23% 13%` | Cards, panels, sidebar surfaces (dark) |
| Steel | `#5B6573` | `216 12% 40%` | Secondary text, muted UI |
| Bone | `#F5F6F8` | `220 14% 97%` | Foreground text on dark, light-mode background |
| Signal | `#F59E0B` | `38 92% 50%` | Warnings, attention, secondary accent — **never** as primary |

### Semantic palette
| Token | Hex | Use |
|---|---|---|
| Success | `#16A34A` | Wins, positive deltas, confirmations |
| Warning | `#F59E0B` | Attention, soft alerts |
| Destructive | `#DC2626` | Destructive actions, hard alerts |
| Info | `#3B82F6` | Neutral info chips |

### Chart palette
Use in this order for stacked bars and line charts so colors are reserved consistently across the platform:
1. Crimson `#E11D2E`
2. Steel-blue `#5B7FB1`
3. Success `#16A34A`
4. Signal `#F59E0B`
5. Violet `#8B5CF6`

### Mode behavior
- **Dark mode (default):** Onyx background, Carbon cards, Bone text, Crimson primary.
- **Light mode:** Bone background, white cards, Onyx text, Crimson primary held back to ~10% surface tint.
- Crimson never floods large surfaces — keep it under ~10% of any view.

### Accessibility
- Bone (`#F5F6F8`) on Onyx (`#0E1117`) → **18.6:1** (AAA)
- Bone on Carbon (`#1A1F2A`) → **15.9:1** (AAA)
- Onyx on Bone (light mode body) → **18.6:1** (AAA)
- White on Crimson (`#E11D2E`) → **4.7:1** (AA for normal text, AAA for large)
- Steel (`#5B6573`) on Onyx → **5.0:1** (AA) — use only for secondary text

---

## 4. Typography

**Single family: Inter.** Inter ships with the platform, renders cleanly on every OS, and has the geometric edge the brand needs. We do not pair multiple display fonts — hierarchy comes from weight, size, and tracking.

### Hierarchy
| Role | Weight | Size | Tracking |
|---|---|---|---|
| Display (decks, hero) | 900 | 48–72 px | +0.06em uppercase |
| H1 (page title) | 800 | 28–32 px | -0.01em |
| H2 (section) | 700 | 20–22 px | normal |
| H3 (card title) | 600 | 16–18 px | normal |
| Body | 400 | 14–15 px | normal |
| Caption / meta | 500 | 11–12 px | +0.12em uppercase |
| Mono (data, codes) | 500 | 12–13 px | normal |

### Rules
- All-caps is reserved for the wordmark, eyebrow labels, and section dividers.
- Line height: 1.5 for body, 1.2 for display.
- Don't mix Inter with another sans for body — it weakens the system.
- Tabular figures (`font-feature-settings: "tnum"`) for any numeric column.

---

## 5. Graphic Language

### Shapes & geometry
- Sharp, deliberate angles (the V mark sets the tone)
- Right angles, thin 1 px rules, hairline dividers
- One accent color per surface — Crimson or nothing

### Corner radius
- Buttons, inputs, badges: **6 px** (`rounded-md`)
- Cards, panels, dialogs: **9 px** (`rounded-lg`)
- Avatars and pills: full circle

### Borders & elevation
- Borders are barely-perceivable — one shade off the surface
- No drop shadows on inline UI; subtle shadows only on floating elements (dialogs, popovers, toasts)
- Hover/active interaction is conveyed via the elevation utilities (`hover-elevate` / `active-elevate-2`), never via custom hover backgrounds

### Iconography
- Lucide icons throughout the product
- 1.5 px stroke, sized 16–20 px in UI
- `react-icons/si` only for game/company logos

### Data visualization
- Charts use the chart palette in order
- Crimson is reserved for the user's own roster / "us" series
- Grid lines are hairlines in Steel @ 30% opacity
- No gradients, no 3D, no drop-shadows on chart elements

### Motion feel
- 150–200 ms ease-out for entries
- 100 ms for hover/elevate
- No bouncing, no parallax, no decorative animation — motion confirms an action, it does not perform

---

## 6. Brand Applications

### In-app (web)
- **Sidebar header:** `vicious-header.svg`, Crimson V on Carbon sidebar.
- **Top bar:** unbranded — let the page own the screen.
- **Login / splash:** stacked lockup centered above the auth card on Onyx background.
- **Favicon:** `vicious-favicon.svg`.
- **OG image / share card:** app icon @ 512 with horizontal lockup, generated from `vicious-app-icon.svg`.

### Mobile app
- Master app icon: `vicious-app-icon.svg` (export to PNG @ 512, 1024).
- Splash: black Onyx background, centered icon mark, no wordmark.

### Sales decks (Individuals & Organizations)
- Cover: stacked lockup on Onyx, Crimson divider line, deck name in Inter Black.
- Section dividers: full-bleed Onyx, large eyebrow caption + section title.
- Footer watermark on every content slide: `VICIOUS` wordmark @ ~10% opacity, bottom-right, plus page number Steel.
- Body slides: white Bone surface or Onyx — no in-between greys.

### Documents
- PDF cover: full Onyx bleed, Crimson hairline at 62% height, wordmark + subtitle stacked left.
- Body pages: white background, Onyx text, Crimson H2s, Steel rules.

### Social
- Avatar: `vicious-icon.svg` (1:1).
- Header: stacked lockup on Onyx with `pattern-grid.svg` extension behind at 30% opacity.

---

## 7. Usage Guidelines

**Do**
- Pair Crimson with Onyx or Bone for maximum impact.
- Use the wordmark with default tracking — it is part of the identity.
- Keep one V mark per surface.
- Respect clear space at every size.

**Don't**
- Don't use Crimson for backgrounds, large fills, or as a chart color for opponents.
- Don't introduce new typefaces.
- Don't combine the dark-bg lockup with light-bg lockup variants in the same composition.
- Don't add gradients, glows, or RGB effects to the mark.
- Don't use emoji in product UI or marketing copy.

---

## 8. Extensions

Supporting brand elements that compose with the core system:

- `extensions/divider-tactical.svg` — Crimson section divider with directional notch for decks and docs
- `extensions/badge-pro.svg` — Outlined "VICIOUS PLATFORM" badge for footers and credits
- `extensions/pattern-grid.svg` — Subtle Onyx grid with Crimson nodes for hero backgrounds and social headers

These extensions can be tinted to match the surface but should never compete with the V mark.

---

## 9. Copy

### Tagline (header)
**Run your roster like a pro.**

### One-line product description
The command center for multi-game esports teams — schedule, scout, and scale your roster from one tactical platform.

### Social bio (≤160 chars)
Vicious — the tactical command center for serious esports orgs. Schedule, scout, and scale your roster across every game you compete in.

### Boilerplate (≤320 chars)
Vicious is a multi-game esports management platform built for organizations that run more than one team. Coaches, managers, and analysts use Vicious to schedule scrims and tournaments, manage rosters and staff, scout opponents, and turn match history into a measurable competitive edge.

---

## 10. Implementation Notes

- All logos ship as SVG under `brand/logos/`. Convert to PNG only when a target surface (e.g. mobile app icon, OG share image) requires raster.
- The web app loads color tokens from `client/src/index.css` — token names match this guide (`--primary` = Crimson, `--background` = Onyx in dark mode, etc.).
- Inter is loaded from Google Fonts at app entry; do not swap to a system font fallback for branded surfaces.
- Sales deck templates should reuse the cover, divider, and footer patterns described in section 6 so that future decks stay on system without a designer in the loop.
- The rendered PDF version of this document lives at `brand/Vicious-Brand-Guidelines.pdf`. Re-build it with `node scripts/build-brand-pdf.mjs` after editing the markdown source.
