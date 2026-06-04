import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { useServerTimeOffset, serverNow } from "@/hooks/use-server-time-offset";
import { getBrowserTimezone } from "@/lib/coupon-status";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}j ${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
  return `${pad(h)}h ${pad(m)}m ${pad(sec)}s`;
}

type Props = {
  eventDate: string;
  /** Optional override; defaults to admin timezone Africa/Lagos. */
  displayTimezone?: string;
  /** Compact = single line, no secondary time label. Used in coupon card. */
  compact?: boolean;
  className?: string;
};

/**
 * Server-time-synchronized countdown to a coupon's event start.
 * Returns null once the countdown reaches 0 (caller switches to "EN COURS").
 *
 * - Synced against the server clock via `useServerTimeOffset` so a wrong
 *   device clock cannot delay or accelerate the flip.
 * - Always renders the absolute start time (admin tz + user tz) so the user
 *   sees the exact wall-clock instant the coupon becomes locked.
 * - Theme-independent: uses semantic emerald tokens that work in light/dark.
 */
export function EventCountdown({ eventDate, displayTimezone = "Africa/Lagos", compact, className }: Props) {
  const offset = useServerTimeOffset();
  const target = new Date(eventDate).getTime();
  const [remaining, setRemaining] = useState(() => target - serverNow(offset));

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setRemaining(target - serverNow(offset));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, [target, offset]);

  if (!Number.isFinite(target) || remaining <= 0) return null;

  const fmt = (tz: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(target));

  const userTz = getBrowserTimezone();
  const showUserTz = userTz && userTz !== displayTimezone;

  return (
    <div
      className={`mt-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold tracking-wide border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ${className ?? ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          Les événements de ce coupon débuteront dans{" "}
          <span className="font-mono tabular-nums">{formatCountdown(remaining)}</span>
        </span>
      </div>
      {!compact && (
        <div className="mt-1 pl-5 text-[10px] font-normal opacity-90">
          Coup d'envoi : {fmt(displayTimezone)} ({displayTimezone})
          {showUserTz && <> · {fmt(userTz)} (heure locale)</>}
        </div>
      )}
    </div>
  );
}
