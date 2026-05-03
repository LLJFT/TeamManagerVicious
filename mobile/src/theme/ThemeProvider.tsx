import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  palette,
  spacing,
  radii,
  shadows,
  buildTypography,
  ColorScheme,
  Palette,
  ThemeName,
  ThemePreference,
  ALL_THEMES,
  Typography,
} from './tokens';

type ThemeContextValue = {
  /** Resolved color scheme — 'light' or 'dark'. Used for status-bar etc. */
  scheme: ColorScheme;
  /** Resolved concrete theme name (after resolving 'system'). */
  themeName: ThemeName;
  /** Raw user preference, including 'system'. */
  preference: ThemePreference;
  /** Update the user preference. Persisted to AsyncStorage. */
  setScheme: (s: ThemePreference) => void;
  /** Convenience: light <-> darkDefault. */
  toggle: () => void;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: Typography;
  shadows: typeof shadows;
  /** True once the Inter font family has finished loading. */
  fontsLoaded: boolean;
  /** Setter so App.tsx can flip this once useFonts resolves. */
  setFontsLoaded: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'theme.preference';

function resolveSystem(): ColorScheme {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

function resolveThemeName(pref: ThemePreference, sys: ColorScheme): ThemeName {
  if (pref === 'system') return sys === 'light' ? 'light' : 'darkDefault';
  return pref;
}

const VALID_PREFS = new Set<ThemePreference>([
  'system',
  ...ALL_THEMES.map((t) => t.name),
]);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(resolveSystem());
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Hydrate persisted preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v && VALID_PREFS.has(v as ThemePreference)) {
        setPreference(v as ThemePreference);
      } else if (v === 'dark') {
        // Backward-compat: previous releases stored 'dark' for the default dark theme.
        setPreference('darkDefault');
      }
    });
  }, []);

  // Subscribe to OS appearance changes so 'system' preference stays live.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, []);

  const themeName = resolveThemeName(preference, systemScheme);
  const themeMeta = ALL_THEMES.find((t) => t.name === themeName)!;
  const scheme: ColorScheme = themeMeta.scheme;

  const setScheme = (next: ThemePreference) => {
    setPreference(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      themeName,
      preference,
      setScheme,
      toggle: () => setScheme(scheme === 'dark' ? 'light' : 'darkDefault'),
      colors: palette[themeName],
      spacing,
      radii,
      typography: buildTypography(fontsLoaded),
      shadows,
      fontsLoaded,
      setFontsLoaded,
    }),
    [scheme, themeName, preference, fontsLoaded],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
