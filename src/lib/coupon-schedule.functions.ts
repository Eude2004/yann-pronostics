import { createServerFn } from "@tanstack/react-start";

/**
 * Force-runs the coupon lifecycle refresh and returns the next scheduled
 * transition timestamp (earliest future start_date for a draft, or earliest
 * future end_date for a published+featured coupon). Used by the homepage to
 * schedule a precise client-side timer so the auto-publish happens with zero
 * visible latency at start_date.
 *
 * Public on purpose (no auth) — it only triggers a cheap idempotent refresh
 * and reads non-sensitive scheduling timestamps. Filtered by `status IN
 * ('draft','published')` so archived coupons never leak.
 */
export const refreshAndGetNextTransition = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Trigger the optimized refresh (idempotent, only touches rows on a boundary).
    await supabaseAdmin.rpc("refresh_coupon_statuses");

    const nowIso = new Date().toISOString();

    // Earliest upcoming draft -> published transition
    const { data: nextStart } = await supabaseAdmin
      .from("coupons")
      .select("start_date")
      .eq("status", "draft")
      .gt("start_date", nowIso)
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Earliest upcoming published+featured -> expired transition
    const { data: nextEnd } = await supabaseAdmin
      .from("coupons")
      .select("end_date")
      .eq("status", "published")
      .eq("is_featured", true)
      .not("end_date", "is", null)
      .gt("end_date", nowIso)
      .order("end_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    const candidates = [nextStart?.start_date, nextEnd?.end_date].filter(
      (v): v is string => typeof v === "string",
    );
    const nextTransitionAt = candidates.length
      ? candidates.reduce((a, b) => (new Date(a) < new Date(b) ? a : b))
      : null;

    return { nextTransitionAt };
  });
