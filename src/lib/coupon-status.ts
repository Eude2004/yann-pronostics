export type CouponLifecycleStatus = "draft" | "published" | "archived";

export type CouponLifecycleInfo = {
  status: CouponLifecycleStatus;
  nextAt: Date | null;
  nextStatus: CouponLifecycleStatus | null;
};

/**
 * Returns true when the event has started but the coupon isn't archived yet.
 * Used to lock the purchase button and show the "EN COURS" banner.
 */
export function isCouponInProgress(
  eventDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!eventDate) return false;
  const ev = new Date(eventDate).getTime();
  if (Number.isNaN(ev)) return false;
  const nowMs = now.getTime();
  if (nowMs < ev) return false;
  if (endDate) {
    const e = new Date(endDate).getTime();
    if (!Number.isNaN(e) && nowMs >= e) return false;
  }
  return true;
}

/** Compute the auto-status of a coupon given its start/end dates, matching the DB logic. */
export function computeCouponLifecycle(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  now: Date = new Date(),
): CouponLifecycleInfo {
  if (!startIso) {
    return { status: "draft", nextAt: null, nextStatus: null };
  }
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;

  if (now < start) {
    return { status: "draft", nextAt: start, nextStatus: "published" };
  }
  if (!end || now < end) {
    return { status: "published", nextAt: end, nextStatus: end ? "archived" : null };
  }
  return { status: "archived", nextAt: null, nextStatus: null };
}

/** Format a duration in ms as "2j 3h 15m" / "1h 04m" / "47s". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "maintenant";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (days > 0) return `${days}j ${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/* ---------- Timezone helpers (for datetime-local <-> UTC ISO) ---------- */

export const DEFAULT_TIMEZONES = [
  "Africa/Douala",
  "Africa/Lagos",
  "Africa/Abidjan",
  "Africa/Casablanca",
  "Europe/Paris",
  "Europe/London",
  "UTC",
];

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getTimeZoneOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - date.getTime();
}

/** Convert a `datetime-local` string ("YYYY-MM-DDTHH:mm") interpreted in `tz` to a UTC ISO string. */
export function zonedInputToIso(local: string, tz: string): string | null {
  if (!local) return null;
  const pseudo = new Date(local + ":00Z"); // pretend the local string is UTC
  if (Number.isNaN(pseudo.getTime())) return null;
  const offset = getTimeZoneOffsetMs(pseudo, tz);
  return new Date(pseudo.getTime() - offset).toISOString();
}

/** Convert a UTC ISO string to a `datetime-local` value displayed in `tz`. */
export function isoToZonedInput(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
