# Design Guidelines: Marvel Rivals Roster Attendance Manager

## Design Approach
**Selected Approach:** Modern, Bright, Energetic Design System  
**Justification:** Creates an exciting, motivational environment for esports team management while maintaining clean UI and clear information hierarchy.

**Key Design Principles:**
- Modern and energetic: Vibrant colors that inspire action
- Clean and readable: Clear hierarchy with excellent contrast
- Motivational: Design that energizes team management activities
- Efficient data entry: Minimize clicks and cognitive load

## Color System

### Primary Colors
- **Primary:** Vibrant Cyan/Teal (hsl 199 89% 48%) - Heroic, energetic
- **Accent:** Warm Coral (hsl 12 76%) - Exciting, motivational
- **Success:** Emerald Green (hsl 142 71% 45%) - Positive outcomes
- **Warning:** Amber (hsl 43 96% 56%) - Attention needed
- **Destructive:** Red (hsl 0 84% 60%) - Negative/danger

### Background Colors
- **Light Mode:** Clean blue-gray tones (hsl 210 40% 98%)
- **Dark Mode:** Deep blue-gray (hsl 222 47% 11%)

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
