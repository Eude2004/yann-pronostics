import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  Lock, TrendingUp, Trophy, Zap, Flame, Calendar, Loader2, Play, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCountdown } from "@/components/EventCountdown";
import { useAuth } from "@/hooks/use-auth";
import { useServerTimeOffset } from "@/hooks/use-server-time-offset";
import { supabase } from "@/integrations/supabase/client";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
import { refreshAndGetNextTransition } from "@/lib/coupon-schedule.functions";
import { initiatePayment, simulatePaymentCompletion } from "@/lib/payments.functions";
import { toast } from "sonner";

export type CouponType = "cote_10" | "cote_30" | "cote_50" | "pair_corner";

export type Coupon = {
  id: string; coupon_type: CouponType | null; title: string;
  description: string | null; price_xaf: number; image_url: string | null;
  video_url: string | null; start_date: string | null; end_date: string | null;
  event_date: string | null;
  sales_count: number; status: "draft" | "published" | "archived";
  disable_purchase_action?: boolean | null;
};

const TYPE_META: Record<CouponType, { icon: any; gradient: string; hot: boolean }> = {
  cote_10: { icon: TrendingUp, gradient: "from-blue-500/20 to-primary/20", hot: false },
  cote_30: { icon: Zap, gradient: "from-orange-500/20 to-primary/20", hot: true },
  cote_50: { icon: Flame, gradient: "from-red-500/20 to-primary/20", hot: true },
  pair_corner: { icon: Trophy, gradient: "from-purple-500/20 to-primary/20", hot: false },
};

const COUPON_TYPE_LABEL: Record<CouponType, string> = {
  cote_10: "Cote de 10+",
  cote_30: "Cote de 30+",
  cote_50: "Cote de 50+",
  pair_corner: "Coupon Total Pair Corner",
};

const CATEGORY_ORDER: CouponType[] = ["cote_10", "cote_30", "cote_50", "pair_corner"];

export function CouponsGrid() {
  const { session } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("coupons")
      .select("id, title, slug, description, sport, category_id, price_xaf, odds, image_url, preview_content, status, is_featured, created_by, created_at, updated_at, coupon_type, video_url, start_date, end_date, sales_count, event_date, disable_purchase_action")
      .eq("status", "published")
      .order("coupon_type");
    setCoupons((data as Coupon[]) ?? []);
    setLoading(false);
  };

  const loadPaid = async () => {
    if (!session?.user) { setPaidIds(new Set()); return; }
    const { data } = await supabase
      .from("transactions")
      .select("coupon_id")
      .eq("user_id", session.user.id)
      .eq("status", "completed")
      .eq("kind", "coupon");
    setPaidIds(new Set((data ?? []).map((t: any) => t.coupon_id).filter(Boolean)));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`coupons-grid-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, load)
      .subscribe();

    let timeoutId: number | undefined;
    let cancelled = false;
    const scheduleNext = async () => {
      try {
        const { nextTransitionAt } = await refreshAndGetNextTransition();
        if (cancelled || !nextTransitionAt) return;
        const delay = Math.max(0, new Date(nextTransitionAt).getTime() - Date.now()) + 250;
        const safeDelay = Math.min(delay, 6 * 60 * 60 * 1000);
        timeoutId = window.setTimeout(scheduleNext, safeDelay);
      } catch {
        timeoutId = window.setTimeout(scheduleNext, 60_000);
      }
    };
    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadPaid();
    if (!session?.user) return;
    const ch = supabase
      .channel(`coupons-grid-tx-${session.user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${session.user.id}` },
        loadPaid,
      )
      .subscribe();
    const onFocus = () => loadPaid();
    const onVisibility = () => { if (document.visibilityState === "visible") loadPaid(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const poll = setInterval(() => {
      try {
        if (sessionStorage.getItem("yp:pending-payment")) loadPaid();
      } catch {}
    }, 3000);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const byType = new Map<CouponType, Coupon>();
  for (const c of coupons) {
    if (!c.coupon_type) continue;
    if (!byType.has(c.coupon_type)) byType.set(c.coupon_type, c);
  }
  const slots = CATEGORY_ORDER.map((type) => ({ type, coupon: byType.get(type) ?? null }));

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl glass-card aspect-[3/4] skeleton-shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
      {slots.map((slot) =>
        slot.coupon ? (
          <CouponCard key={slot.coupon.id} coupon={slot.coupon} paid={paidIds.has(slot.coupon.id)} />
        ) : (
          <ComingSoonCard key={`slot-${slot.type}`} type={slot.type} />
        ),
      )}
    </div>
  );
}

export function activeSlotCount(coupons: Coupon[]): number {
  const seen = new Set<CouponType>();
  for (const c of coupons) {
    if (c.coupon_type && !seen.has(c.coupon_type)) seen.add(c.coupon_type);
  }
  return seen.size;
}

function ComingSoonCard({ type }: { type: CouponType }) {
  const { t } = useTranslation();
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const title = COUPON_TYPE_LABEL[type];
  return (
    <div className="group relative rounded-2xl overflow-hidden glass-card opacity-80">
      <div className="flex items-start justify-between px-3 pt-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold glass-pill text-amber-300">
          <Icon className="w-3 h-3" />
          {title}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-zinc-500/15 border border-zinc-400/40 text-zinc-300 tracking-wider">
          {t("coupon.coming_soon", { defaultValue: "Bientôt disponible" }).toUpperCase()}
        </span>
      </div>
      <div className="mt-3 mx-3 rounded-xl aspect-square flex items-center justify-center brushed-gold relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/55 to-zinc-700/45 backdrop-blur-[2px]" />
        <span className="relative font-serif font-extrabold tracking-[0.2em] text-xl sm:text-2xl text-white/85 select-none rotate-[-8deg]"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
          {t("coupon.coming_soon", { defaultValue: "Bientôt disponible" })}
        </span>
      </div>
      <div className="px-4 pt-3 pb-4 space-y-2.5">
        <h3 className="font-serif not-italic font-bold text-2xl sm:text-[1.7rem] leading-tight text-foreground truncate"
            style={{ fontStyle: "normal" }}>
          {title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
          {t("coupon.coming_soon", { defaultValue: "Bientôt disponible" })}…
        </p>
        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="font-sans text-2xl font-bold text-muted-foreground/60 leading-none">—</div>
          <Button size="sm" disabled className="rounded-full px-5 h-9 font-semibold bg-zinc-600/30 text-zinc-200 border border-zinc-400/30 cursor-not-allowed">
            {t("coupon.coming_soon", { defaultValue: "Bientôt" })}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CouponCard({ coupon, paid }: { coupon: Coupon; paid: boolean }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const getAccess = useServerFn(getCouponVideoAccess);
  const initiate = useServerFn(initiatePayment);
  const simulate = useServerFn(simulatePaymentCompletion);
  const offsetMs = useServerTimeOffset();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [now, setNow] = useState(() => new Date(Date.now() + offsetMs));
  const meta = coupon.coupon_type ? TYPE_META[coupon.coupon_type] : TYPE_META.cote_10;
  const Icon = meta.icon;

  useEffect(() => {
    const tick = () => setNow(new Date(Date.now() + offsetMs));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [offsetMs]);

  const ended = !!coupon.end_date && new Date(coupon.end_date).getTime() <= now.getTime();
  const inProgress = !ended && !!coupon.event_date && new Date(coupon.event_date).getTime() <= now.getTime();

  const dateLabel = coupon.start_date
    ? new Date(coupon.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Lagos" })
    : new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Africa/Lagos" });

  useEffect(() => {
    if (!paid || url) return;
    (async () => {
      try {
        const res = await getAccess({ data: { couponId: coupon.id } });
        if (res.url) setUrl(res.url);
      } catch {}
    })();
  }, [paid, url, getAccess, coupon.id]);

  const handleBuy = async () => {
    if (paying) return;
    if (coupon.disable_purchase_action === true) return;
    if (ended) {
      toast.info(t("coupon.expired_blocked", { defaultValue: "Ce coupon est terminé et n'est plus disponible à l'achat." }));
      return;
    }
    if (inProgress && !paid) {
      toast.info(t("coupon.in_progress_blocked", { defaultValue: "Les matchs ont commencé, achat verrouillé." }));
      return;
    }
    if (!session) {
      toast.info("Connectez-vous pour acheter un coupon.");
      navigate({ to: "/auth", search: { redirect: "/" } as any });
      return;
    }
    if (!coupon.id || coupon.id.length < 30) {
      toast.error("Ce coupon n'est pas encore enregistré côté admin.");
      return;
    }

    setPaying(true);
    try {
      const res = await initiate({
        data: {
          kind: "coupon",
          couponId: coupon.id,
          returnOrigin: window.location.origin,
          customer: {
            name: session.user.user_metadata?.full_name ?? undefined,
            email: session.user.email ?? undefined,
          },
        },
      });

      if (res.mode === "test") {
        await simulate({ data: { transactionId: res.transactionId, outcome: "completed" } });
        toast.success("Paiement confirmé ! Coupon débloqué.");
        try {
          const v = await getAccess({ data: { couponId: coupon.id } });
          if (v.url) setUrl(v.url);
        } catch {}
        setPaying(false);
        return;
      }

      try {
        sessionStorage.setItem(
          "yp:pending-payment",
          JSON.stringify({ txId: res.transactionId, couponId: coupon.id, ts: Date.now() }),
        );
      } catch {}
      window.location.href = res.paymentUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du paiement.");
      setPaying(false);
    }
  };

  const handlePlay = async () => {
    if (url) return;
    setBusy(true);
    try {
      const res = await getAccess({ data: { couponId: coupon.id } });
      if (res.url) setUrl(res.url);
      else if (res.reason === "no_video") toast.info("Vidéo bientôt disponible.");
      else toast.error("Accès refusé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'accès.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let downloadUrl = url;
      if (!downloadUrl) {
        const res = await getAccess({ data: { couponId: coupon.id } });
        if (!res.url) { toast.error("Vidéo non disponible."); return; }
        downloadUrl = res.url;
        setUrl(downloadUrl);
      }
      const resp = await fetch(downloadUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${coupon.title.replace(/[^a-z0-9-_]+/gi, "_")}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success("Téléchargement démarré.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden glass-card transition-all duration-300 hover:-translate-y-0.5 ${paid ? "unlocked-border" : "locked-glow"} ${ended && !paid ? "opacity-95" : ""}`}
    >
      <div className="flex items-start justify-between px-3 pt-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold glass-pill text-amber-300">
          <Icon className="w-3 h-3" />
          {coupon.title}
        </span>
        {ended && !paid ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold bg-zinc-500/15 border border-zinc-400/50 text-zinc-200 tracking-wider">
            {t("coupon.expired", { defaultValue: "TERMINÉ" })}
          </span>
        ) : inProgress ? (
          <span
            role="status"
            aria-live="polite"
            className="live-pulse inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold border border-amber-500/70 bg-amber-500/15 text-amber-700 dark:text-amber-200 tracking-wider"
          >
            <span aria-hidden="true" className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-300" />
            {t("coupon.in_progress", { defaultValue: "EN COURS" })}
          </span>
        ) : paid ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold badge-unlocked">
            DÉBLOQUÉ
          </span>
        ) : meta.hot ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-destructive/15 border border-destructive/40 text-destructive">
            <Flame className="w-3 h-3" /> HOT
          </span>
        ) : null}
      </div>

      <div
        className={`mt-3 mx-3 rounded-xl aspect-square flex items-center justify-center overflow-hidden relative isolate ${paid ? "bg-chart-dark" : "brushed-gold"}`}
      >
        {paid && url ? (
          <video src={url} controls className="absolute inset-0 w-full h-full bg-black object-cover" />
        ) : paid ? (
          <button
            type="button"
            onClick={handlePlay}
            disabled={busy}
            className="relative flex items-center justify-center w-full h-full focus:outline-none"
            aria-label="Lire la vidéo"
          >
            <span className="glass-play">
              {busy ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-0.5" style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.9))" }} />
              )}
            </span>
          </button>
        ) : (
          <div className="relative flex flex-col items-center gap-3 px-4">
            <div className="relative flex items-center justify-center">
              <span aria-hidden className="absolute w-24 h-24 rounded-full lock-ring-pulse"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.25) inset" }} />
              <span className="relative w-16 h-16 rounded-2xl flex items-center justify-center lock-float"
                style={{
                  background: "radial-gradient(circle at 30% 25%, #fff1b8, #d4af37 60%, #6b4f12)",
                  boxShadow: "inset 0 2px 2px rgba(255,255,255,0.6), inset 0 -6px 12px rgba(0,0,0,0.35), 0 6px 14px rgba(0,0,0,0.45)",
                }}>
                <Lock className="w-7 h-7 text-amber-950" strokeWidth={2.5} />
              </span>
            </div>
            <span className="font-serif text-[13px] sm:text-sm font-bold text-bronze text-center">
              ACCÈS RESTREINT
            </span>
          </div>
        )}

        {ended && !paid && (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(15,15,20,0.72) 0%, rgba(40,40,50,0.62) 100%)",
              backdropFilter: "blur(2px)",
            }}
          >
            <span
              className="font-serif font-extrabold tracking-[0.25em] text-3xl sm:text-4xl text-white/85 select-none rotate-[-12deg]"
              style={{
                textShadow: "0 2px 12px rgba(0,0,0,0.65), 0 0 1px rgba(255,255,255,0.5)",
                WebkitTextStroke: "1px rgba(255,255,255,0.25)",
              }}
            >
              {t("coupon.expired", { defaultValue: "TERMINÉ" })}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 pt-3 pb-4 space-y-2.5">
        <div>
          <h3
            className="font-serif not-italic font-bold text-2xl sm:text-[1.7rem] leading-tight tracking-normal text-foreground truncate"
            style={{ fontStyle: "normal" }}
          >
            {coupon.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
            {coupon.description
              || (coupon.coupon_type
                ? t(`coupon.fallback_desc_${coupon.coupon_type}`, { defaultValue: t("coupon.fallback_desc") })
                : t("coupon.fallback_desc"))}
          </p>
          {!inProgress && !ended && coupon.event_date && (
            <EventCountdown eventDate={coupon.event_date} compact />
          )}
          {inProgress && (
            <div
              className="live-banner mt-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold tracking-wide flex items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true" className="live-dot inline-block w-1.5 h-1.5 rounded-full" />
              <span>{t("coupon.in_progress_banner", { defaultValue: "Coupon en cours, vous ne pouvez plus acheter" })}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {dateLabel}
          </span>
        </div>

        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="font-sans text-2xl font-bold text-gold leading-none">
            {coupon.price_xaf.toLocaleString("fr-FR")}
            <span className="block text-[10px] font-semibold text-muted-foreground mt-1 tracking-wider">
              FCFA
            </span>
          </div>

          {paid ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownload}
                disabled={downloading}
                className="glass-pill rounded-full px-3 h-9 text-foreground"
                aria-label="Télécharger la vidéo"
              >
                {downloading ? <Loader2 className="w-4 h-4" /> : <><Download className="w-4 h-4 mr-1" /> DL</>}
              </Button>
              <Button
                size="sm"
                onClick={handlePlay}
                disabled={busy || !!url}
                className="glass-pill rounded-full px-3 h-9 text-emerald-300 hover:text-emerald-200"
                style={{ boxShadow: "0 0 18px rgba(52,211,153,0.35)" }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 mr-1 fill-current" /> Voir</>}
              </Button>
            </div>
          ) : ended ? (
            <Button
              size="sm"
              disabled
              aria-disabled="true"
              className="rounded-full px-5 h-9 font-semibold bg-zinc-600/30 text-zinc-200 border border-zinc-400/30 cursor-not-allowed"
            >
              {t("coupon.expired", { defaultValue: "TERMINÉ" })}
            </Button>
          ) : inProgress ? (
            <Button
              size="sm"
              disabled
              aria-disabled="true"
              className="live-pulse rounded-full px-5 h-9 font-extrabold bg-amber-500/25 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200 border border-amber-600/60 dark:border-amber-400/50 cursor-not-allowed tracking-wider"
            >
              {t("coupon.in_progress", { defaultValue: "EN COURS" })}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleBuy}
              disabled={paying}
              className="btn-gold rounded-full px-5 h-9 font-semibold"
            >
              {paying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("coupon.buy", { defaultValue: "Acheter" })
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
