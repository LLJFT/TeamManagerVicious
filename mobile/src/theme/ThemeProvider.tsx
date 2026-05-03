import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, spacing, radii, typography, shadows, ColorScheme, Palette } from './tokens';

type ThemeContextValue = {
  scheme: ColorScheme;
  setScheme: (s: ColorScheme | 'system') => void;
  toggle: () => void;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'theme.scheme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  const [scheme, setSchemeState] = useState<ColorScheme>(system);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark') setSchemeState(v);
    });
  }, []);

  const setScheme = (s: ColorScheme | 'system') => {
    const next = s === 'system' ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark') : s;
    setSchemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      setScheme,
      toggle: () => setScheme(scheme === 'dark' ? 'light' : 'dark'),
      colors: palette[scheme],
      spacing,
      radii,
      typography,
      shadows,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
