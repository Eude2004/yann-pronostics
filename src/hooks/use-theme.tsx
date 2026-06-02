import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";
type Ctx = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "yann-theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Theme | null;
    const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);
    const resolved = initial === "system" ? getSystemTheme() : initial;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Listen to system preference changes when in "system" mode
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    const resolved = t === "system" ? getSystemTheme() : t;
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  };

  const toggleTheme = () => {
    // Cycle: system -> light -> dark -> system
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
