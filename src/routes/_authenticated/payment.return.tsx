import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, XCircle, ArrowRight, Loader2, Play, Lock, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  getTransactionStatus,
  simulatePaymentCompletion,
  recheckCinetPayStatus,
} from "@/lib/payments.functions";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  tx: z.string().uuid(),
});

export const Route = createFileRoute("/_authenticated/payment/return")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Récapitulatif de paiement — YANN PRONOSTICS" },
      { name: "description", content: "Confirmation et statut de votre paiement." },
    ],
  }),
  component: PaymentReturn,
});

// Au-delà de 30 min, un paiement resté pending est considéré abandonné.
const PENDING_EXPIRY_MS = 30 * 60 * 1000;

function PaymentReturn() {
  const { t } = useTranslation();
  const { tx } = useSearch({ from: "/_authenticated/payment/return" });
  const fetchStatus = useServerFn(getTransactionStatus);
  const simulate = useServerFn(simulatePaymentCompletion);
  const recheck = useServerFn(recheckCinetPayStatus);
  const getVideo = useServerFn(getCouponVideoAccess);
  const [simulating, setSimulating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [couponTitle, setCouponTitle] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  const query = useQuery({
    queryKey: ["transaction-status", tx],
    queryFn: () => fetchStatus({ data: { transactionId: tx } }),
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 4000 : false),
  });

  const status = query.data?.status;
  const reference = query.data?.reference ?? null;
  const couponId = query.data?.coupon_id ?? null;
  const createdAt = query.data?.created_at ? new Date(query.data.created_at).getTime() : null;
  const isMock = !!reference?.startsWith("MOCK-");
  const expired =
    status === "pending" && createdAt !== null && Date.now() - createdAt > PENDING_EXPIRY_MS;

  // Realtime
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

  // Mode test : auto-complétion à l'arrivée
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

  // Mode live : re-check périodique auprès de CinetPay (filet de sécurité si
  // le webhook notify n'arrive pas). S'arrête dès que ce n'est plus pending.
  useEffect(() => {
    if (isMock || status !== "pending") return;
    const id = setInterval(async () => {
      try {
        const r = await recheck({ data: { transactionId: tx } });
        if (r.changed) await query.refetch();
      } catch {}
    }, 10_000);
    return () => clearInterval(id);
  }, [isMock, status, recheck, tx, query]);

  // Récupération du coupon (titre) + URL vidéo signée si paiement validé
  useEffect(() => {
    if (!couponId) return;
    (async () => {
      const { data } = await supabase
        .from("coupons").select("title").eq("id", couponId).maybeSingle();
      if (data?.title) setCouponTitle(data.title);
    })();
  }, [couponId]);

  useEffect(() => {
    if (status !== "completed" || !couponId || videoUrl) return;
    (async () => {
      try {
        const v = await getVideo({ data: { couponId } });
        if (v.url) setVideoUrl(v.url);
      } catch {}
    })();
  }, [status, couponId, getVideo, videoUrl]);

  // Nettoyage du flag de paiement en cours
  useEffect(() => {
    if (status === "completed" || status === "failed" || status === "refunded") {
      try { sessionStorage.removeItem("yp:pending-payment"); } catch {}
    }
  }, [status]);

  const statusLabel =
    status === "completed" ? t("payment.validated")
    : status === "pending" ? (expired ? "Paiement expiré" : t("payment.pending"))
    : status === "failed" ? t("payment.refused")
    : status === "refunded" ? "Remboursé"
    : t("payment.checking");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-8 shadow-glow">
        <div className="text-center">
          {query.isLoading && <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />}
          {status === "completed" && <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />}
          {status === "pending" && !expired && <Clock className="w-14 h-14 mx-auto text-primary animate-pulse" />}
          {(status === "failed" || status === "refunded" || (status === "pending" && expired)) && (
            <XCircle className="w-14 h-14 mx-auto text-destructive" />
          )}

          <h1 className="mt-6 font-display text-3xl">{statusLabel}</h1>

          {query.data && (
            <div className="mt-6 rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-left space-y-2">
              {couponTitle && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Coupon</span>
                  <span className="text-foreground font-medium text-right">{couponTitle}</span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("payment.reference")}</span>
                <span className="font-mono text-foreground text-xs">{reference ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("payment.amount")}</span>
                <span className="text-foreground">{query.data.amount_xaf.toLocaleString("fr-FR")} XAF</span>
              </div>
              <div className="flex justify-between gap-3 items-center">
                <span className="text-muted-foreground">Statut</span>
                <Badge
                  variant="outline"
                  className={
                    status === "completed" ? "border-emerald-500/40 text-emerald-500"
                    : status === "pending" ? "border-primary/40 text-primary"
                    : "border-destructive/40 text-destructive"
                  }
                >
                  {statusLabel}
                </Badge>
              </div>
              <div className="flex justify-between gap-3 items-center">
                <span className="text-muted-foreground">Accès vidéo</span>
                {status === "completed" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" /> Activé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Lock className="w-4 h-4" /> Verrouillé
                  </span>
                )}
              </div>
              {isMock && (
                <div className="pt-1">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {t("payment.test_mode")}
                  </Badge>
                </div>
              )}
              {isMock && status === "pending" && (
                <p className="text-xs text-primary inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t("payment.auto_completing")}
                </p>
              )}
              {!isMock && status === "pending" && !expired && (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Vérification automatique en cours…
                </p>
              )}
              {status === "pending" && expired && (
                <p className="text-xs text-destructive">
                  Aucune confirmation reçue après 30 min. La transaction sera marquée comme échouée.
                </p>
              )}
            </div>
          )}

          {status === "completed" && videoUrl && (
            <div className="mt-4 rounded-xl overflow-hidden border border-border bg-black aspect-video">
              <video src={videoUrl} controls className="w-full h-full" />
            </div>
          )}
          {status === "completed" && !videoUrl && couponId && (
            <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 text-xs text-muted-foreground inline-flex items-center gap-2">
              <Play className="w-4 h-4 opacity-60" />
              La vidéo de ce coupon sera disponible dès qu'elle sera publiée.
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
            {status === "completed" ? (
              <Link to="/dashboard">
                <Button className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
                  {t("payment.see_content")} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            ) : status === "failed" || (status === "pending" && expired) ? (
              <>
                <Link to="/">
                  <Button className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
                    <RotateCw className="w-4 h-4 mr-2" /> Réessayer un paiement
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="outline">Mon espace</Button>
                </Link>
              </>
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
