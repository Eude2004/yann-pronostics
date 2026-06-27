import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";


/**
 * PawaPay deposit callback (sandbox + production).
 *
 * Body: { depositId, status, amount, currency, ... }
 * Sandbox callbacks are not cryptographically signed — we use the callback
 * as a TRIGGER and re-fetch the deposit via GET /v2/deposits/{depositId}
 * with our Bearer token to authoritatively confirm status before any DB
 * mutation. This prevents spoofed callbacks from completing a transaction.
 *
 * The depositId is stored in transactions.reference at initiation and
 * tx.id is also embedded in metadata[].
 */
export const Route = createFileRoute("/api/public/pawapay/callback")({
  server: {
    handlers: {
      GET: async () => new Response("PawaPay callback endpoint", { status: 200 }),
      POST: async ({ request }) => {
        try {
          const token = process.env.PAWAPAY_API_TOKEN_SANDBOX;
          if (!token) {
            console.error("[pawapay] missing PAWAPAY_API_TOKEN_SANDBOX");
            return new Response("Callback not configured", { status: 503 });
          }

          let payload: {
            depositId?: string;
            status?: string;
            metadata?: Array<{ fieldName?: string; fieldValue?: string }>;
          };
          try {
            payload = await request.json();
          } catch {
            return new Response("Invalid JSON", { status: 400 });
          }

          const depositId = payload.depositId;
          if (!depositId) {
            return new Response("Missing depositId", { status: 400 });
          }

          // Authoritative re-fetch — never trust callback body alone.
          let confirmedStatus: string | null = null;
          try {
            const res = await fetch(
              `https://api.sandbox.pawapay.io/v2/deposits/${encodeURIComponent(depositId)}`,
              { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
            );
            const json = (await res.json()) as {
              status?: string;
              data?: { status?: string };
            };
            confirmedStatus = (json.data?.status ?? json.status ?? "").toUpperCase() || null;
          } catch (e) {
            console.error("[pawapay] verify fetch failed", e);
            return new Response("Verify failed", { status: 502 });
          }

          let newStatus: "completed" | "failed" | null = null;
          if (confirmedStatus === "COMPLETED") newStatus = "completed";
          else if (
            confirmedStatus === "FAILED" ||
            confirmedStatus === "REJECTED" ||
            confirmedStatus === "EXPIRED"
          )
            newStatus = "failed";

          if (!newStatus) return new Response("ok"); // ACCEPTED / pending — wait

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: tx, error: selErr } = await supabaseAdmin
            .from("transactions")
            .select("id, status, coupon_id, kind")
            .eq("reference", depositId)
            .eq("payment_method", "pawapay")
            .maybeSingle();
          if (selErr) {
            console.error("[pawapay] select error", selErr);
            return new Response("DB error", { status: 500 });
          }
          if (!tx) return new Response("Unknown depositId", { status: 404 });
          if (tx.status !== "pending") return new Response("ok"); // idempotent

          const { error: updErr } = await supabaseAdmin
            .from("transactions")
            .update({ status: newStatus, notes: `PawaPay callback: ${confirmedStatus}` })
            .eq("id", tx.id)
            .eq("status", "pending");
          if (updErr) {
            console.error("[pawapay] update error", updErr);
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
          console.error("[pawapay] callback exception", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
