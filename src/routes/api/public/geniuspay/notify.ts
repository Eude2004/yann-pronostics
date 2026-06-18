import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * GeniusPay webhook receiver.
 *
 * Signature format (per GeniusPay docs):
 *   X-Webhook-Signature: HMAC-SHA256(timestamp + "." + rawJsonBody, GENIUSPAY_WEBHOOK_SECRET)
 * Replay window: 5 minutes.
 *
 * Events handled:
 *   payment.success                          -> transactions.status = completed
 *   payment.failed / .cancelled / .expired   -> transactions.status = failed
 *
 * Transaction id is read from payload.data.metadata.tx_id (set at initiation).
 */
export const Route = createFileRoute("/api/public/geniuspay/notify")({
  server: {
    handlers: {
      GET: async () =>
        new Response("GeniusPay webhook endpoint", { status: 200 }),
      POST: async ({ request }) => {
        try {
          const secret = process.env.GENIUSPAY_WEBHOOK_SECRET;
          if (!secret) {
            console.error("[geniuspay] missing GENIUSPAY_WEBHOOK_SECRET");
            return new Response("Webhook not configured", { status: 503 });
          }

          const signature = request.headers.get("x-webhook-signature");
          const timestamp = request.headers.get("x-webhook-timestamp");
          const event = request.headers.get("x-webhook-event") ?? "";
          if (!signature || !timestamp) {
            return new Response("Missing signature headers", { status: 401 });
          }

          // Read RAW body for signature verification — never re-serialize.
          const rawBody = await request.text();
          const signedPayload = `${timestamp}.${rawBody}`;
          const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

          const sigBuf = Buffer.from(signature, "hex");
          const expBuf = Buffer.from(expected, "hex");
          if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
            return new Response("Invalid signature", { status: 401 });
          }

          // Replay protection: 5 minutes max
          const ts = Number(timestamp);
          if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
            return new Response("Timestamp too old", { status: 400 });
          }

          if (event === "webhook.test") {
            return new Response("ok");
          }

          let payload: {
            event?: string;
            data?: {
              reference?: string;
              status?: string;
              metadata?: Record<string, unknown>;
            };
          };
          try {
            payload = JSON.parse(rawBody);
          } catch {
            return new Response("Invalid JSON", { status: 400 });
          }

          const eventName = payload.event ?? event;
          const reference = payload.data?.reference ?? null;
          const txId = (payload.data?.metadata?.tx_id as string | undefined) ?? null;
          if (!txId || !reference) {
            return new Response("Missing metadata.tx_id or reference", { status: 400 });
          }

          let newStatus: "completed" | "failed" | null = null;
          if (eventName === "payment.success") newStatus = "completed";
          else if (
            eventName === "payment.failed" ||
            eventName === "payment.cancelled" ||
            eventName === "payment.expired"
          )
            newStatus = "failed";

          if (!newStatus) {
            // Event we don't track (e.g. payment.initiated, payment.refunded) — ack only.
            return new Response("ok");
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("transactions")
            .update({ status: newStatus, notes: `GeniusPay event: ${eventName}` })
            .eq("id", txId)
            .eq("reference", reference)
            .eq("status", "pending");
          if (error) {
            console.error("[geniuspay] DB update error", error);
            return new Response("DB error", { status: 500 });
          }

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
          console.error("[geniuspay] notify exception", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
