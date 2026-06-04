import { describe, it, expect } from "vitest";
import { isCouponInProgress, computeCouponLifecycle, formatDuration } from "@/lib/coupon-status";
import { evaluatePurchase } from "@/lib/purchase-guard";

const T0 = new Date("2026-06-04T12:00:00Z");
const at = (deltaMs: number) => new Date(T0.getTime() + deltaMs);
const iso = (deltaMs: number) => at(deltaMs).toISOString();

describe("Countdown / lifecycle edge cases", () => {
  it("isCouponInProgress is false strictly before event start", () => {
    expect(isCouponInProgress(iso(1000), iso(3600_000), T0)).toBe(false);
  });

  it("flips to in-progress exactly at the start second (>= boundary)", () => {
    // The same wall clock instant that the countdown shows '0' must already
    // count as 'in progress' — no off-by-one half-second gap.
    expect(isCouponInProgress(iso(0), iso(3600_000), T0)).toBe(true);
  });

  it("returns false again once end_date passes (expired)", () => {
    expect(isCouponInProgress(iso(-7200_000), iso(-1000), T0)).toBe(false);
  });

  it("treats invalid / null event_date as not in progress (no crash)", () => {
    expect(isCouponInProgress(null, null, T0)).toBe(false);
    expect(isCouponInProgress("not-a-date", null, T0)).toBe(false);
  });

  it("computeCouponLifecycle reports the next transition timestamp", () => {
    const draft = computeCouponLifecycle(iso(5000), iso(3600_000), T0);
    expect(draft.status).toBe("draft");
    expect(draft.nextStatus).toBe("published");
    expect(draft.nextAt?.toISOString()).toBe(iso(5000));

    const live = computeCouponLifecycle(iso(-5000), iso(3600_000), T0);
    expect(live.status).toBe("published");
    expect(live.nextStatus).toBe("archived");
  });

  it("formatDuration handles sub-minute and multi-day", () => {
    expect(formatDuration(45_000)).toMatch(/45s/);
    expect(formatDuration(3 * 86400_000 + 2 * 3600_000)).toMatch(/^3j 2h/);
    expect(formatDuration(0)).toBe("maintenant");
  });
});

describe("Server purchase guard: event-start lock (matches initiatePayment)", () => {
  it("rejects a direct endpoint call once the event has started", () => {
    // Mirror of the check inside src/lib/payments.functions.ts: the same
    // predicate gates the server handler and the UI button, so a curl
    // hitting initiatePayment with an in-progress coupon must be refused.
    const res = evaluatePurchase(
      { status: "published", end_date: iso(3600_000), event_date: iso(-1) },
      T0,
    );
    expect(res).toEqual({ allowed: false, reason: "in_progress" });
  });

  it("still allows purchase 1 second before kickoff", () => {
    const res = evaluatePurchase(
      { status: "published", end_date: iso(3600_000), event_date: iso(1000) },
      T0,
    );
    expect(res).toEqual({ allowed: true });
  });
});
