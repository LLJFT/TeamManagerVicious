import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  palette,
  spacing,
  radii,
  typography,
  shadows,
  ColorScheme,
  Palette,
  ThemePreference,
} from './tokens';

type ThemeContextValue = {
  scheme: ColorScheme;
  preference: ThemePreference;
  setScheme: (s: ThemePreference) => void;
  toggle: () => void;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'theme.preference';

function resolveSystem(): ColorScheme {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(resolveSystem());

  // Hydrate persisted preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPreference(v);
    });
  }, []);

  // Subscribe to OS appearance changes so 'system' preference stays live.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, []);

  const scheme: ColorScheme = preference === 'system' ? systemScheme : preference;

  const setScheme = (next: ThemePreference) => {
    setPreference(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      preference,
      setScheme,
      toggle: () => setScheme(scheme === 'dark' ? 'light' : 'dark'),
      colors: palette[scheme],
      spacing,
      radii,
      typography,
      shadows,
    }),
    [scheme, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
