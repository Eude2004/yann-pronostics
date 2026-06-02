import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * CinetPay payment orchestration — coupons uniquement (pas d'abonnement).
 *
 * Test mode : si `CINETPAY_API_KEY`/`CINETPAY_SITE_ID` manquent, OU si le
 * réglage admin `test_pay_mode = 'true'` est actif, on crée une transaction
 * pending et on renvoie une URL locale vers /payment/return pour simulation.
 *
 * Live mode : appel CinetPay v2 et redirection vers le payment_url hébergé.
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

    // Lecture du réglage Mode Test Pay (admin uniquement → permet à l'admin d'acheter en simulation)
    const { data: testRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "test_pay_mode")
      .maybeSingle();
    const testPayMode = testRow?.value === "true";

    // Détection rôle admin (les admins ne peuvent acheter que si Mode Test Pay est ON)
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

    // Résolution du coupon
    const { data: c, error } = await supabase
      .from("coupons")
      .select("id, title, price_xaf, status")
      .eq("id", data.couponId)
      .maybeSingle();
    if (error || !c) throw new Error("Coupon introuvable.");
    if (c.status !== "published") throw new Error("Coupon non disponible.");
    const amountXaf = c.price_xaf;
    const description = `Coupon: ${c.title}`;

    // Création transaction pending
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        kind: "coupon",
        coupon_id: data.couponId,
        amount_xaf: amountXaf,
        status: "pending",
        payment_method: "cinetpay",
      })
      .select("id")
      .single();
    if (txErr || !tx) throw new Error(txErr?.message ?? "Création transaction échouée.");

    const apiKey = process.env.CINETPAY_API_KEY;
    const siteId = process.env.CINETPAY_SITE_ID;
    const origin = data.returnOrigin.replace(/\/$/, "");
    const notifyUrl = `${origin}/api/public/cinetpay/notify`;
    const returnUrl = `${origin}/payment/return?tx=${tx.id}`;

    // Mode test : pas de clés OU Mode Test Pay activé
    if (!apiKey || !siteId || testPayMode) {
      await supabase
        .from("transactions")
        .update({
          reference: `MOCK-${tx.id.slice(0, 8)}`,
          notes: testPayMode ? "Mode Test Pay (admin)" : "Mode test (CinetPay non configuré)",
        })
        .eq("id", tx.id);
      return {
        mode: "test" as const,
        transactionId: tx.id,
        paymentUrl: returnUrl,
        reference: `MOCK-${tx.id.slice(0, 8)}`,
      };
    }

    // Live mode
    const reference = `YP-${tx.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-5)}`;
    const payload = {
      apikey: apiKey,
      site_id: siteId,
      transaction_id: reference,
      amount: amountXaf,
      currency: "XAF",
      description: description.slice(0, 250),
      notify_url: notifyUrl,
      return_url: returnUrl,
      channels: "ALL",
      customer_name: data.customer?.name?.slice(0, 60) ?? "Client",
      customer_email: data.customer?.email ?? "",
      customer_phone_number: data.customer?.phone ?? "",
      metadata: tx.id,
    };

    let paymentUrl: string | null = null;
    let providerError: string | null = null;
    try {
      const res = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        code?: string;
        message?: string;
        data?: { payment_url?: string };
      };
      if (json.code === "201" && json.data?.payment_url) {
        paymentUrl = json.data.payment_url;
      } else {
        providerError = json.message ?? `CinetPay code ${json.code}`;
      }
    } catch (e) {
      providerError = e instanceof Error ? e.message : "Network error";
    }

    await supabase
      .from("transactions")
      .update({
        reference,
        notes: providerError ?? "CinetPay init OK",
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
      reference,
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
 * Simulation manuelle d'un paiement (mode test).
 * Autorisée si CinetPay n'est pas configuré, OU si Mode Test Pay est actif.
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
    const cinetpayConfigured = !!(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);

    if (cinetpayConfigured) {
      const { data: testRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "test_pay_mode")
        .maybeSingle();
      if (testRow?.value !== "true") {
        throw new Error("Simulation indisponible : CinetPay est configuré et le Mode Test Pay est désactivé.");
      }
    }

    const { data: tx, error } = await supabase
      .from("transactions")
      .update({ status: data.outcome, notes: `Simulé (${data.outcome})` })
      .eq("id", data.transactionId)
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Transaction déjà finalisée ou introuvable.");
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
