import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";
type PendingPatch = { theme_preference?: Theme; reduce_motion?: boolean };
type Ctx = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  fallbackTheme: ResolvedTheme;
  reduceMotion: boolean;
  systemReduceMotion: boolean;
  syncStatus: "synced" | "pending" | "offline";
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setFallbackTheme: (t: ResolvedTheme) => void;
  setReduceMotion: (v: boolean) => void;
};

const ThemeContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "yann-theme";
const FALLBACK_KEY = "yann-theme-fallback";
const RM_KEY = "yann-reduce-motion";
const PENDING_KEY = "yann-theme-pending";
const DEFAULT_FALLBACK: ResolvedTheme = "dark";

function safeMM(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  try { return window.matchMedia(query); } catch { return null; }
}

function getSystemTheme(fallback: ResolvedTheme): ResolvedTheme {
  const light = safeMM("(prefers-color-scheme: light)");
  const dark = safeMM("(prefers-color-scheme: dark)");
  if (!light || !dark) return fallback;
  if (light.matches) return "light";
  if (dark.matches) return "dark";
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
  } catch { return null; }
}

function readPending(): PendingPatch {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "{}"); } catch { return {}; }
}
function writePending(p: PendingPatch) {
  try {
    if (Object.keys(p).length === 0) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>("system");
  const [fallbackTheme, setFallbackThemeState] = useState<ResolvedTheme>(DEFAULT_FALLBACK);
  const [reduceMotionUser, setReduceMotionUser] = useState<boolean>(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState<boolean>(false);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(DEFAULT_FALLBACK);
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "offline">("synced");
  const remoteLoadedFor = useRef<string | null>(null);
  const lastWriteAt = useRef<number>(0);

  const reduceMotion = reduceMotionUser || systemReduceMotion;

  // ---- Initial load ----
  useEffect(() => {
    const storedFallback = readStored<ResolvedTheme>(FALLBACK_KEY, ["light", "dark"]) ?? DEFAULT_FALLBACK;
    const storedTheme = readStored<Theme>(STORAGE_KEY, ["system", "light", "dark"]) ?? "system";
    const storedRM = (() => { try { return localStorage.getItem(RM_KEY) === "1"; } catch { return false; } })();
    const sysRM = getSystemReduceMotion();

    setFallbackThemeState(storedFallback);
    setThemeState(storedTheme);
    setReduceMotionUser(storedRM);
    setSystemReduceMotion(sysRM);

    const resolved = storedTheme === "system" ? getSystemTheme(storedFallback) : storedTheme;
    setResolvedTheme(resolved);
    applyTheme(resolved, false);
    applyReduceMotion(storedRM || sysRM);

    if (Object.keys(readPending()).length > 0) setSyncStatus("pending");
    if (typeof navigator !== "undefined" && navigator.onLine === false) setSyncStatus("offline");
  }, []);

  // ---- Watch system color-scheme ----
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

  // ---- Watch system reduced-motion ----
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

  // ---- Persist remote with offline queue ----
  const flushPending = async (uid: string) => {
    const pending = readPending();
    if (Object.keys(pending).length === 0) {
      setSyncStatus("synced");
      return;
    }
    try {
      const { error } = await supabase.from("profiles").update(pending).eq("id", uid);
      if (error) throw error;
      writePending({});
      lastWriteAt.current = Date.now();
      setSyncStatus("synced");
    } catch {
      setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
    }
  };

  const persistRemote = async (patch: PendingPatch) => {
    if (!user) return;
    // Merge into pending queue first (durable)
    const merged = { ...readPending(), ...patch };
    writePending(merged);
    setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
    await flushPending(user.id);
  };

  // ---- Retry queue when back online or auth changes ----
  useEffect(() => {
    if (!user) return;
    flushPending(user.id);
    const onOnline = () => flushPending(user.id);
    const onOffline = () => setSyncStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = window.setInterval(() => {
      if (Object.keys(readPending()).length > 0) flushPending(user.id);
    }, 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(interval);
    };
  }, [user]);

  // ---- Remote sync on sign-in + realtime subscription ----
  useEffect(() => {
    if (!user) { remoteLoadedFor.current = null; return; }

    let cancelled = false;
    const loadRemote = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("theme_preference, reduce_motion")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || error || !data) return;
        applyRemote(data.theme_preference as Theme, !!data.reduce_motion);
        remoteLoadedFor.current = user.id;
      } catch { /* offline — keep local */ }
    };
    loadRemote();

    // Realtime: instant cross-device sync
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          // Ignore echoes of our own very recent writes
          if (Date.now() - lastWriteAt.current < 1500) return;
          const row = payload.new as { theme_preference?: string; reduce_motion?: boolean };
          if (row.theme_preference) {
            applyRemote(row.theme_preference as Theme, !!row.reduce_motion);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, fallbackTheme]);

  const applyRemote = (remoteTheme: Theme, remoteRM: boolean) => {
    const validTheme = (["system", "light", "dark"] as const).includes(remoteTheme) ? remoteTheme : "system";
    setThemeState(validTheme);
    setReduceMotionUser(remoteRM);
    try {
      localStorage.setItem(STORAGE_KEY, validTheme);
      localStorage.setItem(RM_KEY, remoteRM ? "1" : "0");
    } catch {}
    const resolved = validTheme === "system" ? getSystemTheme(fallbackTheme) : validTheme;
    setResolvedTheme(resolved);
    applyTheme(resolved, !(remoteRM || systemReduceMotion));
    applyReduceMotion(remoteRM || systemReduceMotion);
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    const resolved = t === "system" ? getSystemTheme(fallbackTheme) : t;
    setResolvedTheme(resolved);
    applyTheme(resolved, !reduceMotion);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    lastWriteAt.current = Date.now();
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
    lastWriteAt.current = Date.now();
    void persistRemote({ reduce_motion: v });
  };

  const toggleTheme = () => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme, resolvedTheme, fallbackTheme,
        reduceMotion, systemReduceMotion, syncStatus,
        toggleTheme, setTheme, setFallbackTheme, setReduceMotion,
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
