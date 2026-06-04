import { describe, it, expect } from "vitest";
import { evaluatePurchase, PURCHASE_BLOCK_MESSAGES } from "@/lib/purchase-guard";

const NOW = new Date("2026-06-04T12:00:00Z");
const future = new Date(NOW.getTime() + 3600_000).toISOString();
const past = new Date(NOW.getTime() - 3600_000).toISOString();

const basePublishedCoupon = {
  status: "published" as const,
  end_date: future,
  event_date: future,
  disable_purchase_action: false,
};

describe("evaluatePurchase — single source of truth for all entry points", () => {
  it("allows a normal published coupon", () => {
    expect(evaluatePurchase(basePublishedCoupon, NOW)).toEqual({ allowed: true });
  });

  it("blocks when disable_purchase_action is true (admin kill-switch)", () => {
    const res = evaluatePurchase(
      { ...basePublishedCoupon, disable_purchase_action: true },
      NOW,
    );
    expect(res).toEqual({ allowed: false, reason: "purchase_disabled" });
  });

  it("blocks when status is not published", () => {
    expect(evaluatePurchase({ ...basePublishedCoupon, status: "draft" }, NOW))
      .toEqual({ allowed: false, reason: "not_published" });
    expect(evaluatePurchase({ ...basePublishedCoupon, status: "archived" }, NOW))
      .toEqual({ allowed: false, reason: "not_published" });
  });

  it("blocks when end_date has passed", () => {
    expect(evaluatePurchase({ ...basePublishedCoupon, end_date: past }, NOW))
      .toEqual({ allowed: false, reason: "ended" });
  });

  it("blocks when event has started", () => {
    expect(evaluatePurchase({ ...basePublishedCoupon, event_date: past }, NOW))
      .toEqual({ allowed: false, reason: "in_progress" });
  });

  it("returns the same result for repeated calls (covers click + Enter + Space + double-click)", () => {
    // The Button's onClick is invoked by mouse click, keyboard Enter/Space, and
    // each individual click of a double-click. Each invocation re-evaluates the
    // predicate against the same coupon snapshot, so the predicate must be
    // deterministic and idempotent.
    const c = { ...basePublishedCoupon, disable_purchase_action: true };
    const a = evaluatePurchase(c, NOW);
    const b = evaluatePurchase(c, NOW);
    const d = evaluatePurchase(c, NOW);
    expect(a).toEqual(b);
    expect(b).toEqual(d);
    expect(a).toEqual({ allowed: false, reason: "purchase_disabled" });
  });

  it("treats undefined disable_purchase_action as not blocking (field hidden from public select)", () => {
    // Public select intentionally omits the field, so the client sees `undefined`.
    // Server side still enforces because the server fn reads the column directly.
    const { disable_purchase_action: _omitted, ...publicShape } = basePublishedCoupon;
    expect(evaluatePurchase(publicShape, NOW)).toEqual({ allowed: true });
  });

  it("exposes a localized message for every block reason", () => {
    expect(PURCHASE_BLOCK_MESSAGES.purchase_disabled).toMatch(/indisponible/i);
    expect(PURCHASE_BLOCK_MESSAGES.ended).toMatch(/terminé/i);
    expect(PURCHASE_BLOCK_MESSAGES.in_progress).toMatch(/commencé/i);
    expect(PURCHASE_BLOCK_MESSAGES.not_published).toMatch(/disponible/i);
  });
});

describe("Server endpoint contract: direct calls must be rejected too", () => {
  // The server's initiatePayment handler reads the coupon row server-side and
  // runs the same predicate. A direct curl/fetch with a blocked coupon must
  // throw before any CinetPay transaction is created.
  it("simulates the server check: direct call with a disabled coupon is refused", () => {
    const couponFromDb = {
      status: "published" as const,
      end_date: future,
      event_date: future,
      disable_purchase_action: true,
    };
    const res = evaluatePurchase(couponFromDb, NOW);
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(PURCHASE_BLOCK_MESSAGES[res.reason]).toBeTruthy();
    }
  });
});
