import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TZ = "Africa/Lagos";
let cached: string | null = null;
const listeners = new Set<(v: string) => void>();
let loading: Promise<void> | null = null;

async function load() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "admin_timezone")
        .maybeSingle();
      const tz = (data?.value && typeof data.value === "string" ? data.value : DEFAULT_TZ) || DEFAULT_TZ;
      cached = tz;
      listeners.forEach((fn) => fn(tz));
    } catch {
      cached = DEFAULT_TZ;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/**
 * Admin-configurable display timezone used to render countdowns and the
 * "EN COURS" switch consistently for every visitor. Realtime-synced via the
 * `app_settings` change stream so an admin change reaches every connected
 * client without reload.
 */
export function useAdminTimezone(): string {
  const [tz, setTz] = useState<string>(cached ?? DEFAULT_TZ);

  useEffect(() => {
    const update = (v: string) => setTz(v);
    listeners.add(update);
    if (cached === null) void load();
    else setTz(cached);

    const channel = supabase
      .channel(`app-settings-tz-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.admin_timezone" },
        () => {
          cached = null;
          void load();
        },
      )
      .subscribe();

    return () => {
      listeners.delete(update);
      supabase.removeChannel(channel);
    };
  }, []);

  return tz;
}
