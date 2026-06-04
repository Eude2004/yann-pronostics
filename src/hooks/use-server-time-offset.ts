import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getServerTime } from "@/lib/server-time.functions";

/**
 * Hook returning `offsetMs` = serverNow - clientNow at the moment of
 * synchronization. Use `Date.now() + offsetMs` everywhere a countdown
 * needs an authoritative "now". Refreshes every 5 minutes.
 *
 * Single in-memory cache shared across all subscribers so the same offset
 * is used by every countdown rendered on the page.
 */
let cachedOffsetMs: number | null = null;
const listeners = new Set<(v: number) => void>();
let inFlight: Promise<void> | null = null;

export function useServerTimeOffset(): number {
  const fetchTime = useServerFn(getServerTime);
  const [offset, setOffset] = useState<number>(cachedOffsetMs ?? 0);

  useEffect(() => {
    const update = (v: number) => setOffset(v);
    listeners.add(update);

    const sync = async () => {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        const sentAt = Date.now();
        try {
          const { now } = await fetchTime();
          const rtt = Date.now() - sentAt;
          // Adjust server timestamp by half the round-trip to best estimate
          // the server's clock at the instant we receive the response.
          const next = now + Math.floor(rtt / 2) - Date.now();
          cachedOffsetMs = next;
          listeners.forEach((fn) => fn(next));
        } catch {
          // ignore — keep last known offset (default 0)
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    };

    if (cachedOffsetMs === null) {
      void sync();
    } else {
      setOffset(cachedOffsetMs);
    }
    const id = window.setInterval(() => void sync(), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      listeners.delete(update);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchTime]);

  return offset;
}

/** Synchronous read of the server-corrected current time in ms. */
export function serverNow(offsetMs: number): number {
  return Date.now() + offsetMs;
}
