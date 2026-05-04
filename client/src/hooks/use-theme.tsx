import { createContext, useContext, useEffect, useState } from "react";

export type SiteStyle = "light-pro" | "default-dark" | "ocean-blue" | "ruby-red" | "minimal-dark" | "carbon-black";

export const siteStyles: { id: SiteStyle; name: string; description: string }[] = [
  { id: "light-pro", name: "Light Pro", description: "Clean, formal SaaS look — warm off-white with steel-blue accents (default)" },
  { id: "default-dark", name: "Default Dark", description: "The Bootcamp dark — onyx surfaces with crimson accents" },
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
  defaultStyle = "light-pro",
}: ThemeProviderProps) {
  const [style, setStyle] = useState<SiteStyle>(() => {
    const stored = localStorage.getItem("site-style");
    // Honour any explicitly-saved preference (including legacy 'default-dark').
    // New visitors with no stored choice get the new Light Pro default.
    return (stored as SiteStyle) || defaultStyle;
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
