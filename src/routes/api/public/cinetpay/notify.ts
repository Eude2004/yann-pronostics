import { createFileRoute } from "@tanstack/react-router";

/**
 * CinetPay payment notification webhook.
 *
 * CinetPay sends a POST with `cpm_trans_id` (our `reference`) when payment
 * status changes. We must call /v2/payment/check to verify before trusting
 * the status. Never mark a transaction completed based on the POST alone.
 */
export const Route = createFileRoute("/api/public/cinetpay/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.CINETPAY_API_KEY;
          const siteId = process.env.CINETPAY_SITE_ID;
          if (!apiKey || !siteId) {
            return new Response("CinetPay not configured", { status: 503 });
          }

          // CinetPay posts application/x-www-form-urlencoded
          const ct = request.headers.get("content-type") ?? "";
          let reference: string | null = null;
          if (ct.includes("application/json")) {
            const json = (await request.json()) as { cpm_trans_id?: string };
            reference = json.cpm_trans_id ?? null;
          } else {
            const form = await request.formData();
            reference = (form.get("cpm_trans_id") as string | null) ?? null;
          }
          if (!reference) return new Response("Missing cpm_trans_id", { status: 400 });

          // Verify with CinetPay
          const checkRes = await fetch("https://api-checkout.cinetpay.com/v2/payment/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apikey: apiKey,
              site_id: siteId,
              transaction_id: reference,
            }),
          });
          const check = (await checkRes.json()) as {
            code?: string;
            data?: { status?: string; metadata?: string };
          };

          const status = check.data?.status; // ACCEPTED, REFUSED, etc.
          const txId = check.data?.metadata;
          if (!txId) return new Response("Missing metadata", { status: 400 });

          const newStatus = status === "ACCEPTED" ? "completed" : "failed";

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("transactions")
            .update({ status: newStatus, notes: `CinetPay status: ${status ?? "unknown"}` })
            .eq("id", txId)
            .eq("reference", reference)
            .eq("status", "pending");
          if (error) {
            console.error("notify update error", error);
            return new Response("DB error", { status: 500 });
          }

          // Bump coupon sales_count when a coupon purchase is completed
          if (newStatus === "completed") {
            const { data: tx } = await supabaseAdmin
              .from("transactions")
              .select("coupon_id, kind")
              .eq("id", txId)
              .maybeSingle();
            if (tx?.kind === "coupon" && tx.coupon_id) {
              const { data: cur } = await supabaseAdmin
                .from("coupons")
                .select("sales_count")
                .eq("id", tx.coupon_id)
                .maybeSingle();
              await supabaseAdmin
                .from("coupons")
                .update({ sales_count: (cur?.sales_count ?? 0) + 1 })
                .eq("id", tx.coupon_id);
            }
          }

          return new Response("ok");
        } catch (e) {
          console.error("notify exception", e);
          return new Response("error", { status: 500 });
        }
      },
      GET: async () => new Response("CinetPay webhook endpoint", { status: 200 }),
    },
  },
});
