/**
 * Pure predicate shared between the client UI and the server handler.
 *
 * The result of this function is what gates ALL purchase entry points:
 * - the mouse click on "Acheter"
 * - keyboard activation (Enter / Space) on the same button
 * - rapid double-clicks (each click re-evaluates the predicate)
 * - direct calls to the `initiatePayment` server function from any caller
 *
 * Keeping the rule in one place is what lets the test suite cover every
 * entry point with a single set of unit tests.
 */
export type PurchaseGuardCoupon = {
  status?: "draft" | "published" | "archived" | null;
  end_date?: string | null;
  event_date?: string | null;
  disable_purchase_action?: boolean | null;
};

export type PurchaseBlockReason =
  | "not_published"
  | "ended"
  | "in_progress"
  | "purchase_disabled";

export function evaluatePurchase(
  coupon: PurchaseGuardCoupon,
  now: Date = new Date(),
): { allowed: true } | { allowed: false; reason: PurchaseBlockReason } {
  if (coupon.status && coupon.status !== "published") {
    return { allowed: false, reason: "not_published" };
  }
  if (coupon.end_date && new Date(coupon.end_date).getTime() <= now.getTime()) {
    return { allowed: false, reason: "ended" };
  }
  if (coupon.event_date && new Date(coupon.event_date).getTime() <= now.getTime()) {
    return { allowed: false, reason: "in_progress" };
  }
  if (coupon.disable_purchase_action === true) {
    return { allowed: false, reason: "purchase_disabled" };
  }
  return { allowed: true };
}

export const PURCHASE_BLOCK_MESSAGES: Record<PurchaseBlockReason, string> = {
  not_published: "Coupon non disponible.",
  ended: "Ce coupon est terminé et n'est plus disponible à l'achat.",
  in_progress: "Les matchs ont commencé, ce coupon n'est plus disponible à l'achat.",
  purchase_disabled: "Achat indisponible pour ce coupon.",
};
