import { createContext, useContext, useEffect, useState } from "react";

export type SiteStyle = "default-dark" | "ocean-blue" | "ruby-red" | "minimal-dark" | "carbon-black";

const VALID_STYLES: ReadonlyArray<SiteStyle> = [
  "default-dark",
  "ocean-blue",
  "ruby-red",
  "minimal-dark",
  "carbon-black",
];

export const siteStyles: { id: SiteStyle; name: string; description: string }[] = [
  { id: "default-dark", name: "Default Dark", description: "Refined SaaS dark — slate-navy surfaces with steel-blue accents (default)" },
  { id: "ocean-blue", name: "Ocean Blue", description: "Deep ocean with teal highlights" },
  { id: "ruby-red", name: "Ruby Red", description: "Warm dark with crimson accents" },
  { id: "minimal-dark", name: "Minimal Dark", description: "Clean and understated" },
  { id: "carbon-black", name: "Carbon Black", description: "Pure black with emerald accents" },
];

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultStyle?: SiteStyle;
};

type ThemeProviderState = {
  style: SiteStyle;
  setStyle: (style: SiteStyle) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultStyle = "default-dark",
}: ThemeProviderProps) {
  const [style, setStyle] = useState<SiteStyle>(() => {
    const stored = localStorage.getItem("site-style");
    // Migrate any unknown / removed values (e.g. 'light-pro') to the default.
    if (stored && VALID_STYLES.includes(stored as SiteStyle)) {
      return stored as SiteStyle;
    }
    return defaultStyle;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      "theme-light-pro",
      "theme-default-dark",
      "theme-ocean-blue",
      "theme-ruby-red",
      "theme-minimal-dark",
      "theme-carbon-black",
      "light",
      "dark"
    );
    root.classList.add(`theme-${style}`);
    localStorage.setItem("site-style", style);
  }, [style]);

  return (
    <ThemeProviderContext.Provider value={{ style, setStyle }}>
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
