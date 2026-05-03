// Mirrors design/DESIGN_SYSTEM.md tokens. HSL kept inline for readability.
// Radii follow the spec (sm=3, md=6, lg=9). Mobile body bumps to 16px to
// avoid iOS input-focus zoom, per the spec's mobile typography rule.

export const palette = {
  light: {
    background: '#F5F8FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF2F7',
    border: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    primary: '#0EA5E9', // hsl(199 89% 48%)
    primaryFg: '#FFFFFF',
    accent: '#F97316',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    overlay: 'rgba(15,23,42,0.45)',
  },
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceAlt: '#172033',
    border: '#27324A',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    primary: '#0EA5E9', // hsl(199 89% 48%) — spec keeps primary stable across light/dark default
    primaryFg: '#FFFFFF',
    accent: '#FB923C',
    success: '#22C55E',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

// 4px spacing scale (subset of the spec's full 0/1/2/3/4/5/6/8/10/12/16).
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Spec radii: sm=3, md=6, lg=9. xl reserved for sheet corners.
export const radii = { sm: 3, md: 6, lg: 9, xl: 16, pill: 999 } as const;

// Body bumps to 16 on mobile (spec § 2.4, "Mobile rule").
export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  heading: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  overline: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 1 },
};

// fontVariant for tabular numerics (KPIs, scores, leaderboards).
export const numericTextStyle = { fontVariant: ['tabular-nums' as const] };

export const shadows = {
  sm: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
};

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = ColorScheme | 'system';
export type Palette = typeof palette.light;
