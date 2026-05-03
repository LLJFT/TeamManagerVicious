export const palette = {
  light: {
    background: '#F5F8FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF2F7',
    border: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    primary: '#0EA5E9',
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
    primary: '#38BDF8',
    primaryFg: '#02131F',
    accent: '#FB923C',
    success: '#22C55E',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 4, md: 8, lg: 12, xl: 16, pill: 999 } as const;
export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  heading: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 1 },
};
export const shadows = {
  sm: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
};

export type ColorScheme = 'light' | 'dark';
export type Palette = typeof palette.light;
