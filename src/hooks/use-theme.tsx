import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";
type Ctx = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  fallbackTheme: ResolvedTheme;
  reduceMotion: boolean;
  systemReduceMotion: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setFallbackTheme: (t: ResolvedTheme) => void;
  setReduceMotion: (v: boolean) => void;
};

const ThemeContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "yann-theme";
const FALLBACK_KEY = "yann-theme-fallback";
const RM_KEY = "yann-reduce-motion";
const DEFAULT_FALLBACK: ResolvedTheme = "dark";

function safeMM(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

function getSystemTheme(fallback: ResolvedTheme): ResolvedTheme {
  const light = safeMM("(prefers-color-scheme: light)");
  const dark = safeMM("(prefers-color-scheme: dark)");
  // If neither media query is recognised, prefers-color-scheme is unavailable → fallback
  if (!light || !dark) return fallback;
  if (light.matches) return "light";
  if (dark.matches) return "dark";
  // Unexpected: nothing matched (e.g. "no-preference") → fallback
  return fallback;
}

function getSystemReduceMotion(): boolean {
  return !!safeMM("(prefers-reduced-motion: reduce)")?.matches;
}

function applyTheme(theme: ResolvedTheme, animate: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (animate) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 350);
  } else {
    root.classList.remove("theme-transition");
  }

  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

function applyReduceMotion(value: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", value);
}

function readStored<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>("system");
  const [fallbackTheme, setFallbackThemeState] = useState<ResolvedTheme>(DEFAULT_FALLBACK);
  const [reduceMotionUser, setReduceMotionUser] = useState<boolean>(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState<boolean>(false);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(DEFAULT_FALLBACK);
  const remoteLoadedFor = useRef<string | null>(null);

  const reduceMotion = reduceMotionUser || systemReduceMotion;

  // Initial load from localStorage + system preferences
  useEffect(() => {
    const storedFallback = readStored<ResolvedTheme>(FALLBACK_KEY, ["light", "dark"]) ?? DEFAULT_FALLBACK;
    const storedTheme = readStored<Theme>(STORAGE_KEY, ["system", "light", "dark"]) ?? "system";
    const storedRM = (() => {
      try { return localStorage.getItem(RM_KEY) === "1"; } catch { return false; }
    })();
    const sysRM = getSystemReduceMotion();

    setFallbackThemeState(storedFallback);
    setThemeState(storedTheme);
    setReduceMotionUser(storedRM);
    setSystemReduceMotion(sysRM);

    const resolved = storedTheme === "system" ? getSystemTheme(storedFallback) : storedTheme;
    setResolvedTheme(resolved);
    applyTheme(resolved, false);
    applyReduceMotion(storedRM || sysRM);
  }, []);

  // Watch system color-scheme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mql = safeMM("(prefers-color-scheme: light)");
    if (!mql) return;
    const handler = () => {
      const resolved = getSystemTheme(fallbackTheme);
      setResolvedTheme(resolved);
      applyTheme(resolved, !reduceMotion);
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [theme, fallbackTheme, reduceMotion]);

  // Watch system reduced-motion changes
  useEffect(() => {
    const mql = safeMM("(prefers-reduced-motion: reduce)");
    if (!mql) return;
    const handler = () => {
      const v = mql.matches;
      setSystemReduceMotion(v);
      applyReduceMotion(v || reduceMotionUser);
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [reduceMotionUser]);

  // Sync from remote (profiles) on sign-in
  useEffect(() => {
    if (!user) {
      remoteLoadedFor.current = null;
      return;
    }
    if (remoteLoadedFor.current === user.id) return;
    remoteLoadedFor.current = user.id;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("theme_preference, reduce_motion")
        .eq("id", user.id)
        .maybeSingle();
      if (!data) return;
      const remoteTheme = (["system", "light", "dark"] as const).includes(data.theme_preference as Theme)
        ? (data.theme_preference as Theme)
        : "system";
      const remoteRM = !!data.reduce_motion;
      setThemeState(remoteTheme);
      setReduceMotionUser(remoteRM);
      try {
        localStorage.setItem(STORAGE_KEY, remoteTheme);
        localStorage.setItem(RM_KEY, remoteRM ? "1" : "0");
      } catch {}
      const resolved = remoteTheme === "system" ? getSystemTheme(fallbackTheme) : remoteTheme;
      setResolvedTheme(resolved);
      applyTheme(resolved, false);
      applyReduceMotion(remoteRM || systemReduceMotion);
    })();
  }, [user, fallbackTheme, systemReduceMotion]);

  const persistRemote = async (patch: { theme_preference?: Theme; reduce_motion?: boolean }) => {
    if (!user) return;
    await supabase.from("profiles").update(patch).eq("id", user.id);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    const resolved = t === "system" ? getSystemTheme(fallbackTheme) : t;
    setResolvedTheme(resolved);
    applyTheme(resolved, !reduceMotion);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    void persistRemote({ theme_preference: t });
  };

  const setFallbackTheme = (t: ResolvedTheme) => {
    setFallbackThemeState(t);
    try { localStorage.setItem(FALLBACK_KEY, t); } catch {}
    if (theme === "system") {
      const resolved = getSystemTheme(t);
      setResolvedTheme(resolved);
      applyTheme(resolved, !reduceMotion);
    }
  };

  const setReduceMotion = (v: boolean) => {
    setReduceMotionUser(v);
    try { localStorage.setItem(RM_KEY, v ? "1" : "0"); } catch {}
    applyReduceMotion(v || systemReduceMotion);
    void persistRemote({ reduce_motion: v });
  };

  const toggleTheme = () => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        fallbackTheme,
        reduceMotion,
        systemReduceMotion,
        toggleTheme,
        setTheme,
        setFallbackTheme,
        setReduceMotion,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
