import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron : pour toutes les transactions restées en `pending`,
 *   - si GeniusPay est configuré et qu'on a une référence non MOCK → on
 *     interroge GET /payments/{reference} et on bascule le statut en
 *     `completed` ou `failed` selon le retour.
 *   - si la transaction est en pending depuis plus de PENDING_EXPIRY_MIN
 *     minutes → on la force en `failed` (paiement abandonné).
 *
 * Sécurité : protégé par l'en-tête `apikey` Supabase (anon/publishable).
 * Le préfixe /api/public/ bypass l'auth d'édition côté Lovable ; on valide
 * quand même la clé pour éviter les appels arbitraires.
 */

const PENDING_EXPIRY_MIN = 30;

export const Route = createFileRoute("/api/public/hooks/expire-pending-payments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoffIso = new Date(Date.now() - PENDING_EXPIRY_MIN * 60_000).toISOString();

        const { data: pendings, error } = await supabaseAdmin
          .from("transactions")
          .select("id, reference, created_at, kind, coupon_id")
          .eq("status", "pending")
          .limit(200);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const apiKey = process.env.GENIUSPAY_API_KEY;
        const apiSecret = process.env.GENIUSPAY_API_SECRET;
        let completed = 0, failed = 0, expired = 0, stillPending = 0;

        for (const tx of pendings ?? []) {
          const isMock = !tx.reference || tx.reference.startsWith("MOCK-") || tx.reference.startsWith("YP-T");
          let finalized = false;

          // 1) Re-check GeniusPay en mode live
          if (!isMock && apiKey && apiSecret && tx.reference) {
            try {
              const res = await fetch(
                `https://geniuspay.ci/api/v1/merchant/payments/${encodeURIComponent(tx.reference)}`,
                {
                  method: "GET",
                  headers: {
                    "X-API-Key": apiKey,
                    "X-API-Secret": apiSecret,
                    Accept: "application/json",
                  },
                },
              );
              const json = (await res.json()) as { data?: { status?: string } };
              const gp = json.data?.status;
              if (gp === "completed") {
                await supabaseAdmin
                  .from("transactions")
                  .update({ status: "completed", notes: "Cron recheck: completed" })
                  .eq("id", tx.id).eq("status", "pending");
                if (tx.kind === "coupon" && tx.coupon_id) {
                  const { data: cur } = await supabaseAdmin
                    .from("coupons").select("sales_count").eq("id", tx.coupon_id).maybeSingle();
                  await supabaseAdmin
                    .from("coupons")
                    .update({ sales_count: (cur?.sales_count ?? 0) + 1 })
                    .eq("id", tx.coupon_id);
                }
                completed++; finalized = true;
              } else if (gp === "failed" || gp === "expired" || gp === "cancelled") {
                await supabaseAdmin
                  .from("transactions")
                  .update({ status: "failed", notes: `Cron recheck: ${gp}` })
                  .eq("id", tx.id).eq("status", "pending");
                failed++; finalized = true;
              }
            } catch {
              // ignore, gérera l'expiration plus bas
            }
          }

          // 2) Expiration si trop ancien et toujours pending
          if (!finalized) {
            const isExpired = tx.created_at && tx.created_at < cutoffIso;
            if (isExpired) {
              await supabaseAdmin
                .from("transactions")
                .update({ status: "failed", notes: "Expiré (pending > 30 min)" })
                .eq("id", tx.id).eq("status", "pending");
              expired++;
            } else {
              stillPending++;
            }
          }
        }

        return new Response(
          JSON.stringify({
            scanned: pendings?.length ?? 0,
            completed,
            failed,
            expired,
            stillPending,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
      GET: async () => new Response("expire-pending-payments cron endpoint", { status: 200 }),
    },
  },
});
