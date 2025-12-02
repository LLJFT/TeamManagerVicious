import { createContext, useContext, useEffect, useState } from "react";

export type ThemeStyle = "classic-dark" | "midnight-blue" | "crimson-edge" | "soft-shadow" | "carbon-black";

export interface ThemeInfo {
  id: ThemeStyle;
  name: string;
  description: string;
  previewColor: string;
}

export const themes: ThemeInfo[] = [
  {
    id: "classic-dark",
    name: "Classic Dark",
    description: "The original dark theme with vibrant cyan accents",
    previewColor: "#0ea5e9",
  },
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    description: "Refined blue accents with a professional feel",
    previewColor: "#3b82f6",
  },
  {
    id: "crimson-edge",
    name: "Crimson Edge",
    description: "Clean dark theme with subtle red accents",
    previewColor: "#ef4444",
  },
  {
    id: "soft-shadow",
    name: "Soft Shadow",
    description: "Minimalistic with smooth, muted tones",
    previewColor: "#a1a1aa",
  },
  {
    id: "carbon-black",
    name: "Carbon Black",
    description: "High-contrast premium dark mode",
    previewColor: "#22c55e",
  },
];

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeStyle;
};

type ThemeProviderState = {
  theme: ThemeStyle;
  setTheme: (theme: ThemeStyle) => void;
  themes: ThemeInfo[];
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = "classic-dark",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeStyle>(() => {
    const stored = localStorage.getItem("theme-style");
    if (stored && themes.some(t => t.id === stored)) {
      return stored as ThemeStyle;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    themes.forEach(t => {
      root.classList.remove(`theme-${t.id}`);
    });
    root.classList.remove("light", "dark");
    root.classList.add(`theme-${theme}`);
    localStorage.setItem("theme-style", theme);
  }, [theme]);

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
