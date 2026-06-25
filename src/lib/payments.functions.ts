import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Allowlist of trusted origins for building success_url / error_url.
// Prevents client-controlled returnOrigin from redirecting payments to an
// attacker-controlled domain (open redirect / webhook hijacking).
const ALLOWED_ORIGIN_HOSTS = [
  "yann-pronostics.lovable.app",
  "project--0731879a-c6b1-42f6-af7b-fbaa2d39bce9.lovable.app",
  "project--0731879a-c6b1-42f6-af7b-fbaa2d39bce9-dev.lovable.app",
];
const ALLOWED_ORIGIN_SUFFIXES = [".lovable.app", ".lovableproject.com"];

function safeOrigin(candidate: string | undefined): string {
  const fallback = "https://yann-pronostics.lovable.app";
  if (!candidate) return process.env.APP_ORIGIN || fallback;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
    const host = u.hostname;
    const ok =
      ALLOWED_ORIGIN_HOSTS.includes(host) ||
      ALLOWED_ORIGIN_SUFFIXES.some((s) => host.endsWith(s));
    if (!ok) return process.env.APP_ORIGIN || fallback;
    return `${u.protocol}//${u.host}`;
  } catch {
    return process.env.APP_ORIGIN || fallback;
  }
}

const GENIUSPAY_BASE = "https://geniuspay.ci/api/v1/merchant";
const PAWAPAY_SANDBOX_BASE = "https://api.sandbox.pawapay.io";

function pawapayStatementDesc(title: string): string {
  // PawaPay statementDescription: 4-22 chars, alphanumeric + spaces only.
  const cleaned = title.replace(/[^a-zA-Z0-9 ]/g, "").trim().slice(0, 22);
  return cleaned.length >= 4 ? cleaned : "Yann Coupon";
}

/**
 * GeniusPay payment orchestration — coupons uniquement.
 *
 * Live : POST /payments sans `payment_method` → checkout_url hébergé GeniusPay
 * (Wave / Orange / MTN / Moov / carte). Webhook signé HMAC-SHA256 sur
 * /api/public/geniuspay/notify. Filet de sécurité côté retour via
 * `recheckGeniusPayStatus` (GET /payments/{reference}).
 *
 * Test : si les clés GeniusPay manquent OU si l'admin a activé
 * `test_pay_mode = 'true'`, on renvoie une URL locale vers /payment/return
 * pour simulation.
 */
export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        kind: z.literal("coupon"),
        couponId: z.string().uuid(),
        returnOrigin: z.string().url(),
        customer: z
          .object({
            name: z.string().max(120).optional(),
            email: z.string().email().optional(),
            phone: z.string().max(20).optional(),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Lecture du Mode Test Pay : la policy RLS app_settings restreint la
    // lecture aux admins, mais le mode test doit aussi s'appliquer aux
    // utilisateurs réguliers lorsqu'il est activé.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: testRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "test_pay_mode")
      .maybeSingle();
    const testPayMode = testRow?.value === "true";

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    if (isAdmin && !testPayMode) {
      throw new Error(
        "Les comptes administrateurs ne peuvent pas acheter de coupons. Activez le Mode Test Pay dans les paramètres pour simuler un achat.",
      );
    }

    const { data: c, error } = await supabase
      .from("coupons")
      .select("id, title, price_xaf, status, end_date, event_date, disable_purchase_action")
      .eq("id", data.couponId)
      .maybeSingle();
    if (error || !c) throw new Error("Coupon introuvable.");
    if (c.status !== "published") throw new Error("Coupon non disponible.");
    if ((c as any).disable_purchase_action === true) {
      try {
        await supabaseAdmin.from("admin_audit_log").insert({
          actor_id: context.userId,
          action: "purchase_attempt_blocked",
          entity_type: "coupon",
          entity_id: data.couponId,
          details: { reason: "disable_purchase_action", title: c.title },
        });
      } catch {}
      throw new Error("Achat indisponible pour ce coupon.");
    }
    if (c.end_date && new Date(c.end_date).getTime() <= Date.now()) {
      throw new Error("Ce coupon est terminé et n'est plus disponible à l'achat.");
    }
    if (c.event_date && new Date(c.event_date).getTime() <= Date.now()) {
      throw new Error("Les matchs ont commencé, ce coupon n'est plus disponible à l'achat.");
    }
    const amountXaf = c.price_xaf;
    const description = `Coupon: ${c.title}`;

    // Idempotence : une transaction par (user_id, coupon_id).
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("coupon_id", data.couponId)
      .eq("kind", "coupon")
      .maybeSingle();

    if (existing && existing.status === "completed") {
      throw new Error("Vous avez déjà acheté ce coupon.");
    }

    // ⚠️ MODE TEST GLOBAL : à retirer avant la mise en production.
    const TEST_AUTO_COMPLETE = false;
    const initialStatus = TEST_AUTO_COMPLETE ? "completed" : "pending";

    let tx: { id: string };
    if (existing) {
      // Admin client: UPDATE on `transactions` is restricted to admins by RLS,
      // but a regular user must be able to retry their own pending tx.
      // Ownership is verified via the `eq("user_id", userId)` filter.
      const { data: upd, error: updErr } = await supabaseAdmin
        .from("transactions")
        .update({
          status: initialStatus,
          amount_xaf: amountXaf,
          payment_method: "geniuspay",
          notes: TEST_AUTO_COMPLETE ? "Auto-validé (mode test)" : "Nouvelle tentative",
        })
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (updErr || !upd) throw new Error(updErr?.message ?? "Réutilisation transaction échouée.");
      tx = upd;
    } else {
      const { data: ins, error: txErr } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          kind: "coupon",
          coupon_id: data.couponId,
          amount_xaf: amountXaf,
          status: initialStatus,
          payment_method: "geniuspay",
          notes: TEST_AUTO_COMPLETE ? "Auto-validé (mode test)" : null,
        })
        .select("id")
        .single();
      if (txErr || !ins) throw new Error(txErr?.message ?? "Création transaction échouée.");
      tx = ins;
    }

    const apiKey = process.env.GENIUSPAY_API_KEY;
    const apiSecret = process.env.GENIUSPAY_API_SECRET;
    const origin = safeOrigin(data.returnOrigin);
    const successUrl = `${origin}/payment/return?tx=${tx.id}`;
    const errorUrl = `${origin}/payment/return?tx=${tx.id}`;

    // Mode test : auto-complete, pas de clés OU Mode Test Pay activé
    if (TEST_AUTO_COMPLETE || !apiKey || !apiSecret || testPayMode) {
      const ref = `YP-T${Date.now().toString().slice(-6)}`;
      // Admin client: see RLS note above.
      await supabaseAdmin
        .from("transactions")
        .update({
          reference: ref,
          notes: TEST_AUTO_COMPLETE
            ? "Auto-validé (mode test global)"
            : testPayMode
              ? "Mode Test Pay (admin)"
              : "Mode test (GeniusPay non configuré)",
        })
        .eq("id", tx.id);

      if (TEST_AUTO_COMPLETE && !existing) {
        const { data: cur } = await supabaseAdmin
          .from("coupons").select("sales_count").eq("id", data.couponId).maybeSingle();
        await supabaseAdmin
          .from("coupons")
          .update({ sales_count: (cur?.sales_count ?? 0) + 1 })
          .eq("id", data.couponId);
      }

      return {
        mode: "test" as const,
        transactionId: tx.id,
        paymentUrl: successUrl,
        reference: ref,
      };
    }

    // Live mode — GeniusPay hosted checkout (no payment_method)
    // ============================================================
    // PROVIDER SELECTION — PawaPay sandbox prioritaire, sinon GeniusPay
    // ============================================================
    const pawapayToken = process.env.PAWAPAY_API_TOKEN_SANDBOX;

    if (pawapayToken) {
      // ----- PawaPay v2 Payment Page -----
      const depositId = crypto.randomUUID();
      const ppPayload = {
        depositId,
        returnUrl: successUrl,
        statementDescription: pawapayStatementDesc(c.title),
        amount: String(amountXaf),
        currency: "XOF",
        country: "CIV",
        reason: description.slice(0, 22).replace(/[^a-zA-Z0-9 ]/g, "") || "Coupon",
        metadata: [
          { fieldName: "txId", fieldValue: tx.id },
          { fieldName: "couponId", fieldValue: data.couponId },
        ],
      };

      let paymentUrl: string | null = null;
      let providerError: string | null = null;
      try {
        const res = await fetch(`${PAWAPAY_SANDBOX_BASE}/v2/paymentpage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${pawapayToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(ppPayload),
        });
        const json = (await res.json()) as {
          status?: string;
          redirectUrl?: string;
          failureReason?: { failureCode?: string; failureMessage?: string };
          errorMessage?: string;
        };
        if (res.ok && json.redirectUrl) {
          paymentUrl = json.redirectUrl;
        } else {
          providerError =
            json.failureReason?.failureMessage ??
            json.errorMessage ??
            `PawaPay HTTP ${res.status}`;
        }
      } catch (e) {
        providerError = e instanceof Error ? e.message : "Network error";
      }

      await supabaseAdmin
        .from("transactions")
        .update({
          reference: depositId,
          payment_method: "pawapay",
          notes: providerError ?? "PawaPay sandbox init OK",
          status: providerError ? "failed" : "pending",
        })
        .eq("id", tx.id);

      if (!paymentUrl) {
        throw new Error(`Initialisation paiement échouée: ${providerError ?? "raison inconnue"}`);
      }

      return {
        mode: "live" as const,
        transactionId: tx.id,
        paymentUrl,
        reference: depositId,
      };
    }

    // ----- GeniusPay hosted checkout (fallback) -----
    const ourRef = `YP-${Date.now().toString().slice(-6)}`;
    const payload = {
      amount: amountXaf,
      currency: "XOF",
      description: description.slice(0, 500),
      reference: ourRef,
      external_reference: ourRef,
      customer: {
        name: data.customer?.name?.slice(0, 120) ?? "Client",
        email: data.customer?.email ?? undefined,
        phone: data.customer?.phone ?? undefined,
      },
      success_url: successUrl,
      error_url: errorUrl,
      metadata: { tx_id: tx.id, coupon_id: data.couponId, our_ref: ourRef },
    };

    let paymentUrl: string | null = null;
    let reference: string | null = null;
    let providerError: string | null = null;
    try {
      const res = await fetch(`${GENIUSPAY_BASE}/payments`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "X-API-Secret": apiSecret,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { reference?: string; checkout_url?: string; payment_url?: string };
        error?: { message?: string };
        message?: string;
      };
      if (res.ok && json.success && json.data?.reference) {
        reference = json.data.reference;
        paymentUrl = json.data.checkout_url ?? json.data.payment_url ?? null;
      } else {
        providerError = json.error?.message ?? json.message ?? `GeniusPay HTTP ${res.status}`;
      }
    } catch (e) {
      providerError = e instanceof Error ? e.message : "Network error";
    }

    await supabaseAdmin
      .from("transactions")
      .update({
        reference: reference ?? `YP-${Date.now().toString().slice(-6)}`,
        notes: providerError ?? "GeniusPay init OK",
        status: providerError ? "failed" : "pending",
      })
      .eq("id", tx.id);

    if (!paymentUrl) {
      throw new Error(`Initialisation paiement échouée: ${providerError ?? "raison inconnue"}`);
    }

    return {
      mode: "live" as const,
      transactionId: tx.id,
      paymentUrl,
      reference: reference!,
    };
  });

/**
 * Lit le statut d'une transaction (utilisé par la page /payment/return).
 */
export const getTransactionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ transactionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tx, error } = await supabase
      .from("transactions")
      .select("id, status, kind, amount_xaf, reference, coupon_id, notes, created_at")
      .eq("id", data.transactionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Transaction introuvable.");
    return tx;
  });

/**
 * Re-vérifie auprès de GeniusPay le statut d'une transaction restée en pending,
 * et met à jour la base si le paiement a été accepté ou refusé entre-temps.
 * Utilisé par la page /payment/return en filet de sécurité quand le webhook
 * n'est pas arrivé.
 */
export const recheckGeniusPayStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ transactionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: tx } = await supabase
      .from("transactions")
      .select("id, status, reference, coupon_id, kind, payment_method")
      .eq("id", data.transactionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!tx) throw new Error("Transaction introuvable.");
    if (tx.status !== "pending") return { status: tx.status, changed: false };
    if (!tx.reference || tx.reference.startsWith("YP-T") || tx.reference.startsWith("MOCK-")) {
      return { status: tx.status, changed: false };
    }

    const markCompleted = async (label: string) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("transactions")
        .update({ status: "completed", notes: `Recheck ${label}: completed` })
        .eq("id", tx.id)
        .eq("status", "pending");
      if (tx.kind === "coupon" && tx.coupon_id) {
        const { data: cur } = await supabaseAdmin
          .from("coupons").select("sales_count").eq("id", tx.coupon_id).maybeSingle();
        await supabaseAdmin
          .from("coupons")
          .update({ sales_count: (cur?.sales_count ?? 0) + 1 })
          .eq("id", tx.coupon_id);
      }
    };
    const markFailed = async (label: string, status: string) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed", notes: `Recheck ${label}: ${status}` })
        .eq("id", tx.id)
        .eq("status", "pending");
    };

    // PawaPay branch
    if (tx.payment_method === "pawapay") {
      const ppToken = process.env.PAWAPAY_API_TOKEN_SANDBOX;
      if (!ppToken) return { status: tx.status, changed: false };
      try {
        const res = await fetch(
          `${PAWAPAY_SANDBOX_BASE}/v2/deposits/${encodeURIComponent(tx.reference)}`,
          { headers: { Authorization: `Bearer ${ppToken}`, Accept: "application/json" } },
        );
        const json = (await res.json()) as {
          status?: string;
          data?: { status?: string };
        };
        // v2 returns either { status:"FOUND", data:{ status:"COMPLETED" } } or flat.
        const ppStatus = (json.data?.status ?? json.status ?? "").toUpperCase();
        if (ppStatus === "COMPLETED") {
          await markCompleted("PawaPay");
          return { status: "completed" as const, changed: true };
        }
        if (ppStatus === "FAILED" || ppStatus === "REJECTED" || ppStatus === "EXPIRED") {
          await markFailed("PawaPay", ppStatus);
          return { status: "failed" as const, changed: true };
        }
        return { status: "pending" as const, changed: false };
      } catch (e) {
        return { status: "pending" as const, changed: false, error: e instanceof Error ? e.message : "network" };
      }
    }

    // GeniusPay branch (default)
    const apiKey = process.env.GENIUSPAY_API_KEY;
    const apiSecret = process.env.GENIUSPAY_API_SECRET;
    if (!apiKey || !apiSecret) return { status: tx.status, changed: false };

    try {
      const res = await fetch(
        `${GENIUSPAY_BASE}/payments/${encodeURIComponent(tx.reference)}`,
        {
          method: "GET",
          headers: { "X-API-Key": apiKey, "X-API-Secret": apiSecret, Accept: "application/json" },
        },
      );
      const json = (await res.json()) as { success?: boolean; data?: { status?: string } };
      const gpStatus = json.data?.status;
      if (gpStatus === "completed") {
        await markCompleted("GeniusPay");
        return { status: "completed" as const, changed: true };
      }
      if (gpStatus === "failed" || gpStatus === "expired" || gpStatus === "cancelled") {
        await markFailed("GeniusPay", gpStatus);
        return { status: "failed" as const, changed: true };
      }
      return { status: "pending" as const, changed: false };
    } catch (e) {
      return { status: "pending" as const, changed: false, error: e instanceof Error ? e.message : "network" };
    }
  });

/**
 * Simulation manuelle d'un paiement (mode test).
 * Autorisée si GeniusPay n'est pas configuré, OU si Mode Test Pay est actif.
 */
export const simulatePaymentCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        transactionId: z.string().uuid(),
        outcome: z.enum(["completed", "failed"]).default("completed"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const geniuspayConfigured = !!(process.env.GENIUSPAY_API_KEY && process.env.GENIUSPAY_API_SECRET);
    const mode = geniuspayConfigured ? "live" : "test";
    const logCtx = {
      step: "simulatePaymentCompletion",
      transaction_id: data.transactionId,
      user_id: userId,
      mode,
      outcome: data.outcome,
    };
    console.log("[payments]", JSON.stringify({ ...logCtx, event: "start" }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (geniuspayConfigured) {
      const { data: testRow } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "test_pay_mode")
        .maybeSingle();
      if (testRow?.value !== "true") {
        console.warn("[payments]", JSON.stringify({ ...logCtx, event: "blocked_live_mode" }));
        throw new Error("Simulation indisponible : GeniusPay est configuré et le Mode Test Pay est désactivé.");
      }
    }

    // Ownership check via user-scoped client (RLS allows users to read their own tx).
    const { data: pre } = await supabase
      .from("transactions")
      .select("id, status, user_id, coupon_id, kind")
      .eq("id", data.transactionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!pre) {
      console.warn("[payments]", JSON.stringify({ ...logCtx, event: "not_found" }));
      throw new Error("Transaction introuvable.");
    }
    if (pre.status !== "pending") {
      console.log("[payments]", JSON.stringify({ ...logCtx, event: "already_finalized", current_status: pre.status }));
      return { id: pre.id, status: pre.status };
    }

    // Update via admin client: the `transactions` RLS policy restricts UPDATE
    // to admins, but in test/simulation mode regular users must be able to
    // finalize their OWN pending transaction. We've already verified ownership
    // above, so bypassing RLS here is safe and required.
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .update({ status: data.outcome, notes: `Simulé (${data.outcome})` })
      .eq("id", data.transactionId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();
    if (error) {
      console.error("[payments]", JSON.stringify({ ...logCtx, event: "update_error", error_message: error.message }));
      throw new Error(error.message);
    }
    if (!tx) {
      console.warn("[payments]", JSON.stringify({ ...logCtx, event: "vanished" }));
      throw new Error("Transaction introuvable.");
    }

    // Bump sales_count on first successful coupon purchase (mirrors webhook).
    if (data.outcome === "completed" && pre.kind === "coupon" && pre.coupon_id) {
      const { data: cur } = await supabaseAdmin
        .from("coupons").select("sales_count").eq("id", pre.coupon_id).maybeSingle();
      await supabaseAdmin
        .from("coupons")
        .update({ sales_count: (cur?.sales_count ?? 0) + 1 })
        .eq("id", pre.coupon_id);
    }

    console.log("[payments]", JSON.stringify({ ...logCtx, event: "finalized", status: tx.status }));
    return tx;
  });

/**
 * Bascule Mode Test Pay — réservé aux admins.
 */
export const setTestPayMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");

    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "test_pay_mode", value: data.enabled ? "true" : "false" }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { enabled: data.enabled };
  });
