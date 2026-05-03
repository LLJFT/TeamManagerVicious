# Design Guidelines: Vicious Esports Multi-Game Management Platform

## Design Approach
**Selected Approach:** Vicious Brand Identity System (v1.0) — tactical, premium, restrained.
**Justification:** A serious operations console for esports orgs needs trust, clarity, and a single sharp brand color — not bright "energetic" SaaS palettes. See `brand/Vicious-Brand-Guidelines.md` for the full system; the rules below are the in-product subset.

**Key Design Principles:**
- Tactical and operator-grade: dark Onyx surfaces, restrained accent
- Premium and confident: type-led hierarchy, hairline rules, no decoration
- One sharp color: Crimson is reserved for primary actions, focus, "us" data
- Quietly intense: motion confirms actions, never performs

## Color System

### Primary Colors
- **Primary (Vicious Crimson):** hsl 354 75% 50% / `#E11D2E` — Brand accent, primary actions, focus rings, "us" series in charts
- **Signal (amber):** hsl 38 92% 50% / `#F59E0B` — Warnings and soft attention only; never used as primary
- **Success:** hsl 142 65% 38% / `#16A34A`
- **Warning:** hsl 38 92% 50% / `#F59E0B`
- **Destructive:** hsl 0 78% 48% / `#DC2626`

### Background Colors
- **Light Mode:** Bone (hsl 220 14% 97% / `#F5F6F8`) with white cards
- **Dark Mode (default):** Onyx (hsl 220 24% 7% / `#0E1117`) with Carbon cards (hsl 220 23% 11% / `#1A1F2A`)

### Status Colors
- Available: Emerald green
- Unavailable: Red
- Maybe/Unknown: Slate/gray
- Pending: Amber

### Role Colors
- Tank: Blue tones
- DPS: Red tones
- Support: Green tones

### Event Type Colors
- Tournament: Purple
- Scrim: Cyan
- VOD Review: Orange

## Typography System

**Font Family:** Inter (via system-ui fallback)

**Hierarchy:**
- Page Title: text-3xl font-bold
- Section Headers: text-xl font-semibold
- Card Titles: text-lg font-semibold
- Table Headers: text-sm font-medium uppercase tracking-wide
- Body Text: text-sm font-normal
- Helper Text: text-xs text-muted-foreground

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8

**Container Structure:**
- Page wrapper: max-w-7xl mx-auto px-6 py-6
- Card containers: rounded-lg border with p-6
- Section spacing: space-y-6 between major sections
- Table cell padding: px-4 py-3

## Component Library

### Cards
- Clean white/dark backgrounds with subtle borders
- Consistent padding (p-6)
- Rounded corners (rounded-lg)
- Optional hover elevation for interactive cards

### Buttons
- Primary: Cyan background with white text
- Secondary: Light gray background
- Outline: Border with transparent background
- Destructive: Red background
- Ghost: Transparent with hover effect

### Badges
- Use semantic colors based on context
- Smaller size for status indicators
- Consistent padding and border-radius

### Tables
- Clean borders with alternating row colors in some contexts
- Sticky headers for scrollable tables
- Consistent cell padding
- Clear visual hierarchy between headers and data

### Progress Bars
- Color-coded based on value (green > amber > red)
- Rounded ends
- Clear labels

### Forms
- Clean input styling with focus states
- Clear labels and helper text
- Validation feedback
- Consistent spacing

## Responsive Behavior

**Desktop (lg and above):**
- Full table view with all columns visible
- Comfortable cell spacing
- Side-by-side layouts for related content

**Tablet (md):**
- Horizontal scroll for wide tables
- Stacked layouts where appropriate
- Compressed button groups

**Mobile (base):**
- Card-based layouts
- Full-width elements
- Collapsed navigation

## Interaction Patterns

- Hover effects for clickable elements
- Clear focus states for accessibility
- Toast notifications for feedback
- Loading states for async operations
- Smooth transitions (200ms duration)

## Accessibility Requirements

- ARIA labels for all interactive elements
- Keyboard navigation support
- Focus indicators
- Screen reader announcements
- Sufficient color contrast (WCAG AA)
- Touch targets minimum 44x44px on mobile
