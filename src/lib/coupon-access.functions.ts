import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns a time-limited URL to the coupon video ONLY if the caller has
 * either an active VIP subscription OR a completed transaction for that coupon.
 *
 * - If coupons.video_url stores a storage path inside the private `coupon-videos`
 *   bucket, we issue a signed URL (60 min).
 * - If it stores a full http(s) URL, we return it as-is (still gated by the check).
 */
export const getCouponVideoAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ couponId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Fetch the coupon (RLS allows reading published rows, admins see all)
    const { data: coupon, error: cErr } = await supabase
      .from("coupons")
      .select("id, video_url, status")
      .eq("id", data.couponId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!coupon) throw new Error("Coupon introuvable.");
    if (!coupon.video_url) {
      return { url: null as string | null, reason: "no_video" as const };
    }

    // 2. Check access: active VIP OR paid for this coupon (OR admin)
    const [{ data: vip }, { data: paid }, { data: rolesRow }] = await Promise.all([
      supabase.rpc("has_active_vip", { _user_id: userId }),
      supabase.rpc("has_paid_coupon", { _user_id: userId, _coupon_id: coupon.id }),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const isAdmin = Array.isArray(rolesRow) && rolesRow.some((r) => r.role === "admin");
    const allowed = isAdmin || vip === true || paid === true;
    if (!allowed) {
      return { url: null, reason: "forbidden" as const };
    }

    // 3. If it's an external URL, return as-is.
    if (/^https?:\/\//i.test(coupon.video_url)) {
      return { url: coupon.video_url, reason: "ok" as const };
    }

    // 4. Otherwise treat as storage path inside `coupon-videos`.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage.from("coupon-videos")
      .createSignedUrl(coupon.video_url, 60 * 60);

    if (sErr || !signed) throw new Error(sErr?.message ?? "URL signée indisponible.");
    return { url: signed.signedUrl, reason: "ok" as const };
  });
