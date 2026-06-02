import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * CinetPay payment orchestration.
 *
 * Test mode (no API key set): creates a `pending` transaction and returns a
 * URL pointing back to /payment/return where the user can simulate completion.
 *
 * Live mode (CINETPAY_API_KEY + CINETPAY_SITE_ID set): calls CinetPay
 * /v2/payment and returns the hosted payment_url.
 */
export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        kind: z.enum(["coupon", "subscription"]),
        couponId: z.string().uuid().optional(),
        planId: z.string().uuid().optional(),
        returnOrigin: z.string().url(),
        customer: z
          .object({
            name: z.string().max(120).optional(),
            email: z.string().email().optional(),
            phone: z.string().max(20).optional(),
          })
          .optional(),
      })
      .refine((d) => (d.kind === "coupon" ? !!d.couponId : !!d.planId), {
        message: "couponId required for coupon kind, planId for subscription",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Resolve amount + label from DB
    let amountXaf = 0;
    let description = "";
    let subscriptionId: string | null = null;

    if (data.kind === "coupon" && data.couponId) {
      const { data: c, error } = await supabase
        .from("coupons")
        .select("id, title, price_xaf, status")
        .eq("id", data.couponId)
        .maybeSingle();
      if (error || !c) throw new Error("Coupon introuvable.");
      if (c.status !== "published") throw new Error("Coupon non disponible.");
      amountXaf = c.price_xaf;
      description = `Coupon: ${c.title}`;
    } else if (data.kind === "subscription" && data.planId) {
      const { data: p, error } = await supabase
        .from("subscription_plans")
        .select("id, name, price_xaf, is_active")
        .eq("id", data.planId)
        .maybeSingle();
      if (error || !p) throw new Error("Plan introuvable.");
      if (!p.is_active) throw new Error("Plan non disponible.");
      amountXaf = p.price_xaf;
      description = `Abonnement: ${p.name}`;

      // Create an inactive subscription tied to this transaction;
      // the existing DB trigger will activate it when the tx becomes completed.
      const { data: sub, error: sErr } = await supabase
        .from("subscriptions")
        .insert({ user_id: userId, plan_id: p.id, status: "inactive" })
        .select("id")
        .single();
      if (sErr || !sub) throw new Error(sErr?.message ?? "Création abonnement échouée.");
      subscriptionId = sub.id;
    } else {
      throw new Error("Paramètres invalides.");
    }

    // 2. Create pending transaction
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        kind: data.kind,
        coupon_id: data.kind === "coupon" ? data.couponId : null,
        subscription_id: subscriptionId,
        amount_xaf: amountXaf,
        status: "pending",
        payment_method: "cinetpay",
      })
      .select("id")
      .single();
    if (txErr || !tx) throw new Error(txErr?.message ?? "Création transaction échouée.");

    // 3. Call CinetPay if configured, else fall back to test mode
    const apiKey = process.env.CINETPAY_API_KEY;
    const siteId = process.env.CINETPAY_SITE_ID;
    const origin = data.returnOrigin.replace(/\/$/, "");
    const notifyUrl = `${origin}/api/public/cinetpay/notify`;
    const returnUrl = `${origin}/payment/return?tx=${tx.id}`;

    if (!apiKey || !siteId) {
      // Test mode — no real provider call
      await supabase
        .from("transactions")
        .update({
          reference: `MOCK-${tx.id.slice(0, 8)}`,
          notes: "Mode test (CinetPay non configuré)",
        })
        .eq("id", tx.id);
      return {
        mode: "test" as const,
        transactionId: tx.id,
        paymentUrl: returnUrl,
        reference: `MOCK-${tx.id.slice(0, 8)}`,
      };
    }

    // Live mode: CinetPay v2 init
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
 * Read the current status of one of the caller's transactions
 * (used by the return page to poll completion).
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
      .select("id, status, kind, amount_xaf, reference, coupon_id, subscription_id, notes, created_at")
      .eq("id", data.transactionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tx) throw new Error("Transaction introuvable.");
    return tx;
  });

/**
 * Test-mode only: mark a pending transaction as completed so the user can
 * exercise the unlock flow without a real provider. Refuses to work when a
 * real CinetPay key is configured.
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
    if (process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID) {
      throw new Error("Simulation indisponible : CinetPay est configuré.");
    }
    const { supabase, userId } = context;
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
