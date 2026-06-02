import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";
type PendingPatch = {
  theme_preference?: Theme;
  reduce_motion?: boolean;
  ts: string; // ISO timestamp of the latest local change (for conflict resolution)
};
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
const LAST_LOCAL_TS_KEY = "yann-theme-last-local-ts";
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
function readPending(): PendingPatch | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object" || !p.ts) return null;
    return p as PendingPatch;
  } catch { return null; }
}
function writePending(p: PendingPatch | null) {
  try {
    if (!p) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {}
}
function readLastLocalTs(): string {
  try { return localStorage.getItem(LAST_LOCAL_TS_KEY) || "1970-01-01T00:00:00.000Z"; } catch { return "1970-01-01T00:00:00.000Z"; }
}
function writeLastLocalTs(ts: string) {
  try { localStorage.setItem(LAST_LOCAL_TS_KEY, ts); } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>("system");
  const [fallbackTheme, setFallbackThemeState] = useState<ResolvedTheme>(DEFAULT_FALLBACK);
  const [reduceMotionUser, setReduceMotionUser] = useState<boolean>(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState<boolean>(false);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(DEFAULT_FALLBACK);
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "offline">("synced");
  const lastEchoAt = useRef<number>(0);

  const reduceMotion = reduceMotionUser || systemReduceMotion;

  // ---- Initial local load ----
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

    if (readPending()) setSyncStatus("pending");
    if (typeof navigator !== "undefined" && navigator.onLine === false) setSyncStatus("offline");
  }, []);

  // ---- System color-scheme listener ----
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

  // ---- System reduced-motion listener ----
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

  // ---- Conflict-aware flush ----
  const flushPending = async (uid: string) => {
    const pending = readPending();
    if (!pending) { setSyncStatus("synced"); return; }

    try {
      // Read remote state and its timestamp to resolve conflicts (last-write-wins by ts)
      const { data: remote, error: readErr } = await supabase
        .from("profiles")
        .select("theme_preference, reduce_motion, preferences_updated_at")
        .eq("id", uid)
        .maybeSingle();
      if (readErr) throw readErr;

      const remoteTs = remote?.preferences_updated_at ?? "1970-01-01T00:00:00.000Z";
      if (remote && remoteTs > pending.ts) {
        // Remote was modified more recently on another device — remote wins, drop pending.
        writePending(null);
        applyRemote(remote.theme_preference as Theme, !!remote.reduce_motion, remoteTs);
        setSyncStatus("synced");
        return;
      }

      // Local wins — push with our timestamp.
      const payload: Record<string, unknown> = { preferences_updated_at: pending.ts };
      if (pending.theme_preference !== undefined) payload.theme_preference = pending.theme_preference;
      if (pending.reduce_motion !== undefined) payload.reduce_motion = pending.reduce_motion;

      const { error } = await supabase.from("profiles").update(payload).eq("id", uid);
      if (error) throw error;

      writePending(null);
      lastEchoAt.current = Date.now();
      writeLastLocalTs(pending.ts);
      setSyncStatus("synced");
    } catch {
      setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
    }
  };

  const queueLocalChange = async (patch: Omit<PendingPatch, "ts">) => {
    if (!user) return;
    const now = new Date().toISOString();
    const existing = readPending();
    const merged: PendingPatch = { ...(existing ?? {}), ...patch, ts: now };
    writePending(merged);
    writeLastLocalTs(now);
    setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
    await flushPending(user.id);
  };

  // ---- Retry queue: online event, auth change, periodic ----
  useEffect(() => {
    if (!user) return;
    flushPending(user.id);
    const onOnline = () => flushPending(user.id);
    const onOffline = () => setSyncStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = window.setInterval(() => {
      if (readPending()) flushPending(user.id);
    }, 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(interval);
    };
  }, [user]);

  // ---- Initial remote sync + realtime cross-device updates ----
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const loadRemote = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("theme_preference, reduce_motion, preferences_updated_at")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || error || !data) return;
        const remoteTs = data.preferences_updated_at ?? "1970-01-01T00:00:00.000Z";
        const pending = readPending();
        // If we have a newer local pending change, keep local; flush will reconcile.
        if (pending && pending.ts > remoteTs) return;
        applyRemote(data.theme_preference as Theme, !!data.reduce_motion, remoteTs);
      } catch { /* offline — keep local */ }
    };
    loadRemote();

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          if (Date.now() - lastEchoAt.current < 1500) return;
          const row = payload.new as { theme_preference?: string; reduce_motion?: boolean; preferences_updated_at?: string };
          const incomingTs = row.preferences_updated_at ?? new Date().toISOString();
          // Conflict resolution: ignore if our local change is newer
          if (incomingTs <= readLastLocalTs()) return;
          const pending = readPending();
          if (pending && pending.ts > incomingTs) return;
          if (row.theme_preference) {
            applyRemote(row.theme_preference as Theme, !!row.reduce_motion, incomingTs);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, fallbackTheme]);

  const applyRemote = (remoteTheme: Theme, remoteRM: boolean, remoteTs: string) => {
    const validTheme = (["system", "light", "dark"] as const).includes(remoteTheme) ? remoteTheme : "system";
    setThemeState(validTheme);
    setReduceMotionUser(remoteRM);
    try {
      localStorage.setItem(STORAGE_KEY, validTheme);
      localStorage.setItem(RM_KEY, remoteRM ? "1" : "0");
    } catch {}
    writeLastLocalTs(remoteTs);
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
    void queueLocalChange({ theme_preference: t });
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
    void queueLocalChange({ reduce_motion: v });
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
