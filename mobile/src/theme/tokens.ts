// Mirrors design/DESIGN_SYSTEM.md tokens. Hex values are derived from the
// spec's HSL triplets so the mobile app stays visually faithful to the web
// design system. All six themes live here so the picker in Settings can swap
// between them without recomputing palettes.
//
// Themes (spec § 2.1):
//   light          — hsl(210 40% 98%) base
//   darkDefault    — hsl(222 47% 11%) base, primary cyan
//   oceanBlue      — hsl(210 50% 10%) base, primary teal-cyan
//   rubyRed        — hsl(0 20% 10%) base, primary crimson
//   minimalDark    — hsl(220 15% 12%) base, primary indigo
//   carbonBlack    — hsl(0 0% 5%)  base, primary emerald

export type ThemeName =
  | 'light'
  | 'darkDefault'
  | 'oceanBlue'
  | 'rubyRed'
  | 'minimalDark'
  | 'carbonBlack';

export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryFg: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  overlay: string;
};

export const palette: Record<ThemeName, Palette> = {
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
  darkDefault: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceAlt: '#172033',
    border: '#27324A',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    primary: '#0EA5E9',
    primaryFg: '#FFFFFF',
    accent: '#FB923C',
    success: '#22C55E',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
    overlay: 'rgba(0,0,0,0.6)',
  },
  oceanBlue: {
    background: '#0D1F33',
    surface: '#122739',
    surfaceAlt: '#0F2230',
    border: '#21425C',
    text: '#ECF6FA',
    textSecondary: '#A8C7D6',
    textTertiary: '#84A3B5',
    primary: '#1CC4C9',
    primaryFg: '#021A20',
    accent: '#1A6663',
    success: '#2EB78A',
    warning: '#E8B33A',
    danger: '#DC4040',
    info: '#3DA3D6',
    overlay: 'rgba(0,10,20,0.6)',
  },
  rubyRed: {
    background: '#1F1414',
    surface: '#271A1A',
    surfaceAlt: '#221717',
    border: '#463434',
    text: '#F4F0F0',
    textSecondary: '#C7B6B6',
    textTertiary: '#A38F8F',
    primary: '#DF2058',
    primaryFg: '#FFFFFF',
    accent: '#663919',
    success: '#2EB762',
    warning: '#E8B53A',
    danger: '#DD3030',
    info: '#C97C8E',
    overlay: 'rgba(20,0,0,0.6)',
  },
  minimalDark: {
    background: '#1A1D24',
    surface: '#21252C',
    surfaceAlt: '#1D2027',
    border: '#383D45',
    text: '#E7E9EC',
    textSecondary: '#A8AEB8',
    textTertiary: '#828892',
    primary: '#4A7CD4',
    primaryFg: '#FFFFFF',
    accent: '#2D3852',
    success: '#3AAB66',
    warning: '#DFA01F',
    danger: '#D14545',
    info: '#6E92D9',
    overlay: 'rgba(10,12,16,0.6)',
  },
  carbonBlack: {
    background: '#0D0D0D',
    surface: '#141414',
    surfaceAlt: '#101010',
    border: '#333333',
    text: '#F2F2F2',
    textSecondary: '#B3B3B3',
    textTertiary: '#8C8C8C',
    primary: '#1DC979',
    primaryFg: '#01170C',
    accent: '#1A4D34',
    success: '#29BC7A',
    warning: '#ECAA1F',
    danger: '#DD4040',
    info: '#3F9F77',
    overlay: 'rgba(0,0,0,0.7)',
  },
};

// 4px spacing scale (subset of the spec's full 0/1/2/3/4/5/6/8/10/12/16).
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Spec radii: sm=3, md=6, lg=9. xl reserved for sheet corners.
export const radii = { sm: 3, md: 6, lg: 9, xl: 16, pill: 999 } as const;

// Inter font family (loaded via expo-font in App.tsx). The provider swaps these
// to system defaults until the font has loaded so the first paint never blocks.
export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type Typography = {
  display: { fontSize: number; fontWeight: '700'; lineHeight: number; fontFamily?: string };
  title: { fontSize: number; fontWeight: '700'; lineHeight: number; fontFamily?: string };
  heading: { fontSize: number; fontWeight: '600'; lineHeight: number; fontFamily?: string };
  body: { fontSize: number; fontWeight: '400'; lineHeight: number; fontFamily?: string };
  caption: { fontSize: number; fontWeight: '400'; lineHeight: number; fontFamily?: string };
  overline: { fontSize: number; fontWeight: '600'; lineHeight: number; letterSpacing: number; fontFamily?: string };
};

// Body bumps to 16 on mobile (spec § 2.4, "Mobile rule"). When `fontsLoaded`
// is true the provider injects the Inter family into each variant.
export function buildTypography(fontsLoaded: boolean): Typography {
  const f = fontsLoaded ? fontFamilies : null;
  return {
    display: { fontSize: 32, fontWeight: '700', lineHeight: 36, fontFamily: f?.bold },
    title: { fontSize: 22, fontWeight: '700', lineHeight: 28, fontFamily: f?.bold },
    heading: { fontSize: 18, fontWeight: '600', lineHeight: 24, fontFamily: f?.semibold },
    body: { fontSize: 16, fontWeight: '400', lineHeight: 22, fontFamily: f?.regular },
    caption: { fontSize: 13, fontWeight: '400', lineHeight: 18, fontFamily: f?.regular },
    overline: { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 1, fontFamily: f?.semibold },
  };
}

// Default typography (without Inter) — kept as a static export so existing
// imports continue to work; ThemeProvider supplies the live, font-aware version.
export const typography = buildTypography(false);

// fontVariant for tabular numerics (KPIs, scores, leaderboards).
export const numericTextStyle = { fontVariant: ['tabular-nums' as const] };

export const shadows = {
  sm: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
};

// 'system' resolves to 'light' or 'darkDefault' based on OS appearance.
export type ColorScheme = 'light' | 'dark';
export type ThemePreference = ThemeName | 'system';

export const ALL_THEMES: { name: ThemeName; scheme: ColorScheme }[] = [
  { name: 'light', scheme: 'light' },
  { name: 'darkDefault', scheme: 'dark' },
  { name: 'oceanBlue', scheme: 'dark' },
  { name: 'rubyRed', scheme: 'dark' },
  { name: 'minimalDark', scheme: 'dark' },
  { name: 'carbonBlack', scheme: 'dark' },
];
