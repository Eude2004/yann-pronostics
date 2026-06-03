import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { getTransactionStatus, simulatePaymentCompletion } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  tx: z.string().uuid(),
});

export const Route = createFileRoute("/_authenticated/payment/return")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Paiement — YANN PRONOSTICS" }] }),
  component: PaymentReturn,
});

function PaymentReturn() {
  const { t } = useTranslation();
  const { tx } = useSearch({ from: "/_authenticated/payment/return" });
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getTransactionStatus);
  const simulate = useServerFn(simulatePaymentCompletion);
  const [simulating, setSimulating] = useState(false);
  const autoTriggered = useRef(false);

  const query = useQuery({
    queryKey: ["transaction-status", tx],
    queryFn: () => fetchStatus({ data: { transactionId: tx } }),
    // Polling as a fallback; realtime below is the primary path.
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 3000 : false),
  });

  const status = query.data?.status;
  const isMock = !!query.data?.reference?.startsWith("MOCK-");

  // Realtime: listen for updates on this transaction
  useEffect(() => {
    const channel = supabase
      .channel(`tx-${tx}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${tx}` },
        () => query.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tx, query]);

  // Auto-complete: in test mode, simulate success automatically on arrival
  useEffect(() => {
    if (autoTriggered.current) return;
    if (!isMock || status !== "pending" || simulating) return;
    autoTriggered.current = true;
    (async () => {
      setSimulating(true);
      try {
        await simulate({ data: { transactionId: tx, outcome: "completed" } });
        await query.refetch();
        toast.success(t("payment.sim_success"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
        autoTriggered.current = false;
      } finally {
        setSimulating(false);
      }
    })();
  }, [isMock, status, simulating, simulate, tx, query, t]);

  // Auto-redirect to dashboard once completed (test OR live)
  useEffect(() => {
    if (status === "completed") {
      try { sessionStorage.removeItem("yp:pending-payment"); } catch {}
      toast.success(t("payment.validated"));
      const id = setTimeout(() => navigate({ to: "/dashboard" }), 1500);
      return () => clearTimeout(id);
    }
    if (status === "failed" || status === "refunded") {
      try { sessionStorage.removeItem("yp:pending-payment"); } catch {}
    }
  }, [status, navigate, t]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-8 shadow-glow">
        <div className="text-center">
          {query.isLoading && <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />}
          {status === "completed" && <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />}
          {status === "pending" && <Clock className="w-14 h-14 mx-auto text-primary animate-pulse" />}
          {(status === "failed" || status === "refunded") && <XCircle className="w-14 h-14 mx-auto text-destructive" />}

          <h1 className="mt-6 font-display text-3xl">
            {status === "completed" && t("payment.validated")}
            {status === "pending" && t("payment.pending")}
            {status === "failed" && t("payment.refused")}
            {!status && t("payment.checking")}
          </h1>

          {query.data && (
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              <div>
                {t("payment.reference")}{" "}
                <span className="font-mono text-foreground">{query.data.reference ?? "—"}</span>
              </div>
              <div>
                {t("payment.amount")}{" "}
                <span className="text-foreground">
                  {query.data.amount_xaf.toLocaleString("fr-FR")} XAF
                </span>
              </div>
              <div>
                {t("payment.type")} <span className="text-foreground">{t("payment.coupon")}</span>
              </div>
              {isMock && (
                <Badge variant="outline" className="mt-2 border-primary/40 text-primary">
                  {t("payment.test_mode")}
                </Badge>
              )}
              {isMock && status === "pending" && (
                <p className="mt-3 text-xs text-primary inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t("payment.auto_completing")}
                </p>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
            {status === "completed" ? (
              <Link to="/dashboard">
                <Button className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
                  {t("payment.see_content")} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/">
                <Button variant="outline">{t("common.back")}</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
