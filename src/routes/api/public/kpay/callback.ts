import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * KPay webhook receiver (production + sandbox).
 *
 * Security:
 *   1. HMAC-SHA256 of the raw JSON body is compared to `X-KPAY-Signature`
 *      in constant time using KPAY_WEBHOOK_SECRET.
 *   2. Even after a valid signature, we re-fetch the payment via
 *      GET /api/v1/payments/{reference} with our API keys as the source
 *      of truth before mutating the DB (defence in depth against a
 *      compromised secret).
 *   3. Update is idempotent: only pending transactions transition.
 *
 * Endpoint URL to configure in the KPay dashboard:
 *   https://yann-pronostics.lovable.app/api/public/kpay/callback
 */
export const Route = createFileRoute("/api/public/kpay/callback")({
  server: {
    handlers: {
      GET: async () =>
        new Response("KPay callback endpoint", { status: 200 }),

      POST: async ({ request }) => {
        try {
          const webhookSecret = process.env.KPAY_WEBHOOK_SECRET;
          const apiKey = process.env.KPAY_API_KEY;
          const apiSecret = process.env.KPAY_SECRET_KEY;
          if (!webhookSecret || !apiKey || !apiSecret) {
            console.error("[kpay] missing KPAY_* env vars");
            return new Response("Callback not configured", { status: 503 });
          }

          const rawBody = await request.text();
          if (!rawBody) return new Response("Empty body", { status: 400 });

          // 1. HMAC verification on the raw body (constant time).
          const sigHeader =
            request.headers.get("x-kpay-signature") ??
            request.headers.get("X-KPAY-Signature") ??
            "";
          if (!sigHeader) return new Response("Missing signature", { status: 401 });

          const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
          try {
            const a = Buffer.from(sigHeader.replace(/^sha256=/i, ""), "hex");
            const b = Buffer.from(expected, "hex");
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              return new Response("Invalid signature", { status: 401 });
            }
          } catch {
            return new Response("Invalid signature", { status: 401 });
          }

          let payload: {
            event?: string;
            paymentId?: string;
            reference?: string;
            externalId?: string;
            status?: string;
          };
          try {
            payload = JSON.parse(rawBody);
          } catch {
            return new Response("Invalid JSON", { status: 400 });
          }

          const kpayId = payload.reference ?? payload.paymentId;
          if (!kpayId) return new Response("Missing reference", { status: 400 });

          // Only handle deposit (payment.*) events. Ignore payouts/refunds.
          if (payload.event && !payload.event.startsWith("payment.")) {
            return new Response("ok");
          }

          // 2. Re-fetch as authoritative source.
          let confirmedStatus: string | null = null;
          try {
            const res = await fetch(
              `https://admin.kpay.site/api/v1/payments/${encodeURIComponent(kpayId)}`,
              {
                headers: {
                  "X-API-Key": apiKey,
                  "X-Secret-Key": apiSecret,
                  Accept: "application/json",
                },
              },
            );
            const json = (await res.json()) as { status?: string };
            confirmedStatus = (json.status ?? "").toUpperCase() || null;
          } catch (e) {
            console.error("[kpay] verify fetch failed", e);
            return new Response("Verify failed", { status: 502 });
          }

          let newStatus: "completed" | "failed" | null = null;
          if (confirmedStatus === "COMPLETED") newStatus = "completed";
          else if (
            confirmedStatus === "FAILED" ||
            confirmedStatus === "CANCELLED" ||
            confirmedStatus === "EXPIRED"
          )
            newStatus = "failed";

          if (!newStatus) return new Response("ok"); // still pending

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: tx, error: selErr } = await supabaseAdmin
            .from("transactions")
            .select("id, status, coupon_id, kind")
            .eq("reference", kpayId)
            .eq("payment_method", "kpay")
            .maybeSingle();
          if (selErr) {
            console.error("[kpay] select error", selErr);
            return new Response("DB error", { status: 500 });
          }
          if (!tx) return new Response("Unknown reference", { status: 404 });
          if (tx.status !== "pending") return new Response("ok"); // idempotent

          const { error: updErr } = await supabaseAdmin
            .from("transactions")
            .update({ status: newStatus, notes: `KPay webhook: ${confirmedStatus}` })
            .eq("id", tx.id)
            .eq("status", "pending");
          if (updErr) {
            console.error("[kpay] update error", updErr);
            return new Response("DB error", { status: 500 });
          }

          if (newStatus === "completed" && tx.kind === "coupon" && tx.coupon_id) {
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

          return new Response("ok");
        } catch (e) {
          console.error("[kpay] callback exception", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
