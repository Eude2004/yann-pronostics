import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/yann-logo.png";
import {
  LogOut,
  Trophy,
  Lock,
  Play,
  Loader2,
  Calendar,
  Info,
  Download,
  ShoppingCart,
  Crown,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
import { initiatePayment } from "@/lib/payments.functions";
import { toast } from "sonner";
import { consumePendingPurchase } from "@/components/VisitorSignupPrompt";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PaymentModal } from "@/components/PaymentModal";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Mon espace — YANN PRONOSTICS" }] }),
  component: Dashboard,
});

type Coupon = {
  id: string;
  title: string;
  description: string | null;
  price_xaf: number;
  video_url: string | null;
  coupon_type: string | null;
  start_date: string | null;
  end_date: string | null;
  event_date?: string | null;
  disable_purchase_action?: boolean | null;
};

// Color theme per card position (matches the reference: green, blue, amber, orange)
type ThemeKey = "emerald" | "sky" | "amber" | "orange";

const THEMES: Record<
  ThemeKey,
  {
    ring: string;
    glow: string;
    text: string;
    badgeBg: string;
    badgeBorder: string;
    iconColor: string;
    btnBg: string;
    btnHover: string;
  }
> = {
  emerald: {
    ring: "border-emerald-500/40",
    glow: "shadow-[0_0_40px_-8px_rgba(16,185,129,0.45)]",
    text: "text-emerald-400",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/40",
    iconColor: "text-emerald-400/80",
    btnBg: "bg-emerald-500",
    btnHover: "hover:bg-emerald-600",
  },
  sky: {
    ring: "border-sky-500/40",
    glow: "shadow-[0_0_40px_-8px_rgba(14,165,233,0.5)]",
    text: "text-sky-400",
    badgeBg: "bg-sky-500/10",
    badgeBorder: "border-sky-500/40",
    iconColor: "text-sky-400/80",
    btnBg: "bg-emerald-500",
    btnHover: "hover:bg-emerald-600",
  },
  amber: {
    ring: "border-amber-500/40",
    glow: "shadow-[0_0_40px_-8px_rgba(245,158,11,0.45)]",
    text: "text-amber-400",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/40",
    iconColor: "text-amber-400/80",
    btnBg: "bg-emerald-500",
    btnHover: "hover:bg-emerald-600",
  },
  orange: {
    ring: "border-orange-500/40",
    glow: "shadow-[0_0_40px_-8px_rgba(249,115,22,0.5)]",
    text: "text-orange-400",
    badgeBg: "bg-orange-500/10",
    badgeBorder: "border-orange-500/40",
    iconColor: "text-orange-400/80",
    btnBg: "bg-emerald-500",
    btnHover: "hover:bg-emerald-600",
  },
};

const THEME_ORDER: ThemeKey[] = ["emerald", "sky", "amber", "orange"];
const THEME_RANK: Record<ThemeKey, number> = {
  emerald: 0,
  sky: 1,
  amber: 2,
  orange: 3,
};

function themeForCoupon(c: Coupon, index: number): ThemeKey {
  const t = (c.coupon_type ?? "").toLowerCase();
  if (t.includes("10")) return "emerald";
  if (t.includes("30")) return "sky";
  if (t.includes("50")) return "amber";
  if (t.includes("corner") || t.includes("total") || t.includes("pair"))
    return "orange";
  return THEME_ORDER[index % THEME_ORDER.length];
}

function typeLabel(c: Coupon): string {
  if (c.coupon_type && c.coupon_type.trim()) return c.coupon_type;
  return c.title;
}

function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const initiate = useServerFn(initiatePayment);
  const name =
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split("@")[0] ||
    "Membre";

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) {
      navigate({ to: "/admin", replace: true });
    }
  }, [loading, isAdmin, navigate]);

  const loadAll = async () => {
    if (!user) return;
    const [{ data: cps }, { data: txs }] = await Promise.all([
      supabase
        .from("coupons")
        .select(
          "id, title, slug, description, sport, category_id, price_xaf, odds, image_url, preview_content, status, is_featured, created_by, created_at, updated_at, coupon_type, video_url, start_date, end_date, sales_count, event_date, disable_purchase_action",
        )
        .eq("status", "published")
        .order("coupon_type"),
      supabase
        .from("transactions")
        .select("coupon_id")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .eq("kind", "coupon"),
    ]);
    setCoupons((cps as Coupon[]) ?? []);
    setPaidIds(
      new Set((txs ?? []).map((t: any) => t.coupon_id).filter(Boolean)),
    );
    setLoaded(true);
  };

  useEffect(() => {
    if (!user || isAdmin) return;
    loadAll();
    const channel = supabase
      .channel(`user-tx-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coupons" },
        () => loadAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) return;
    const pending = consumePendingPurchase();
    if (!pending) return;
    (async () => {
      toast.info(t("coupon.initiating"));
      try {
        const res = await initiate({
          data: {
            kind: "coupon",
            couponId: pending.couponId,
            returnOrigin: window.location.origin,
            customer: {
              name: user.user_metadata?.full_name ?? undefined,
              email: user.email ?? undefined,
            },
          },
        });
        window.location.href = res.paymentUrl;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("coupon.init_failed"));
      }
    })();
  }, [user, isAdmin, initiate, t]);

  const todayLabel = useMemo(() => {
    const d = new Date();
    try {
      const s = d.toLocaleDateString(i18n.language === "en" ? "en-US" : "fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch {
      return d.toDateString();
    }
  }, [i18n.language]);

  const purchasedCount = useMemo(
    () => coupons.filter((c) => paidIds.has(c.id)).length,
    [coupons, paidIds],
  );

  // Sort: by theme rank (emerald → sky → amber → orange) then by price asc
  const sortedCoupons = useMemo(() => {
    const arr = coupons.map((c, i) => ({ c, theme: themeForCoupon(c, i) }));
    arr.sort((a, b) => {
      const r = THEME_RANK[a.theme] - THEME_RANK[b.theme];
      return r !== 0 ? r : a.c.price_xaf - b.c.price_xaf;
    });
    return arr;
  }, [coupons]);

  if (loading || isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const initial = (name?.[0] ?? "U").toUpperCase();

  return (
    <div className="min-h-screen bg-luxury theme-fade relative">
      {/* Filigree chart pattern */}
      <div aria-hidden className="absolute inset-0 bg-filigree pointer-events-none" />

      <header className="relative border-b border-border/40 backdrop-blur-md sticky top-0 z-40 bg-background/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="relative inline-flex items-center justify-center h-10 w-10 rounded-full overflow-hidden border border-amber-400/60 shadow-[0_0_20px_-4px_rgba(212,175,55,0.6)]">
              <img src={logo} alt="" className="h-9 w-9 object-contain" />
            </span>
            <span className="font-serif text-lg sm:text-xl tracking-wide text-gold hidden sm:block">
              Yann Prono
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* VIP Gold Member badge */}
            <div className="hidden sm:flex items-center gap-2 glass-pill rounded-full pl-1.5 pr-3 py-1">
              <span className="relative inline-flex items-center justify-center h-8 w-8 rounded-full text-[13px] font-semibold text-black"
                style={{ background: "radial-gradient(circle at 30% 25%, #fff6c2, #d4af37 70%, #8a6b1f)" }}>
                {initial}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-300/90">
                  <Crown className="w-3 h-3 text-amber-300" /> VIP Gold Member
                </span>
              </div>
            </div>
            <LanguageToggle />
            <Button variant="outline" size="sm" onClick={signOut} className="glass-pill border-border/50">
              <LogOut className="w-4 h-4 mr-2" /> {t("common.logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Coupons VIP du Jour — section */}
        <section className="relative">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-400" style={{ filter: "drop-shadow(0 0 10px rgba(212,175,55,0.5))" }} />
            <h1 className="font-serif text-3xl sm:text-5xl tracking-wide text-gold leading-none">
              {t("dashboard.today_coupons")}
            </h1>
          </div>

          <div className="mt-3 flex items-center gap-2 text-muted-foreground text-sm">
            <Calendar className="w-4 h-4" />
            <span>{todayLabel}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-amber-400/60 bg-amber-500/5 text-amber-300 shadow-[inset_0_0_10px_rgba(212,175,55,0.15)]">
              {t("dashboard.coupons_available", {
                count: coupons.length,
                defaultValue: `${coupons.length} coupons disponibles`,
              })}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-sky-400/60 bg-sky-500/5 text-sky-300 shadow-[inset_0_0_10px_rgba(56,189,248,0.18)]">
              {t("dashboard.coupons_purchased", {
                count: purchasedCount,
                defaultValue: `${purchasedCount} achetés`,
              })}
            </span>
          </div>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

          {!loaded ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <CouponSkeleton key={i} themeKey={THEME_ORDER[i % 4]} />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <p className="text-muted-foreground">{t("coupon.none")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
              {sortedCoupons.map(({ c, theme }) => (
                <UserCouponCard
                  key={c.id}
                  coupon={c}
                  paid={paidIds.has(c.id)}
                  themeKey={theme}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function UserCouponCard({
  coupon,
  paid,
  themeKey,
}: {
  coupon: Coupon;
  paid: boolean;
  themeKey: ThemeKey;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const getAccess = useServerFn(getCouponVideoAccess);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const prevPaidRef = useRef(paid);
  const th = THEMES[themeKey];

  // Detect a transition from locked → unlocked to play a one-shot animation
  useEffect(() => {
    if (!prevPaidRef.current && paid) {
      setJustUnlocked(true);
      const id = setTimeout(() => setJustUnlocked(false), 1100);
      return () => clearTimeout(id);
    }
    prevPaidRef.current = paid;
  }, [paid]);

  useEffect(() => {
    if (!paid || url) return;
    (async () => {
      try {
        const res = await getAccess({ data: { couponId: coupon.id } });
        if (res.url) setUrl(res.url);
      } catch {}
    })();
  }, [paid, url, getAccess, coupon.id]);

  const onUnlock = async () => {
    setBusy(true);
    try {
      const res = await getAccess({ data: { couponId: coupon.id } });
      if (res.reason === "forbidden") {
        toast.error(t("dashboard.locked"));
      } else if (res.reason === "no_video") {
        toast.info(t("dashboard.no_video"));
      } else if (res.url) {
        setUrl(res.url);
        setPlaying(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.access_error"));
    } finally {
      setBusy(false);
    }
  };

  const onBuy = () => {
    // Kill-switch admin : clic 100% silencieux quand l'achat est désactivé.
    if (coupon.disable_purchase_action === true) return;
    setPayOpen(true);
  };

  const onDownload = async () => {
    try {
      let videoUrl = url;
      if (!videoUrl) {
        const res = await getAccess({ data: { couponId: coupon.id } });
        if (res.url) {
          setUrl(res.url);
          videoUrl = res.url;
        }
      }
      if (!videoUrl) {
        toast.info(t("dashboard.no_video"));
        return;
      }
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `${coupon.title}.mp4`;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.access_error"));
    }
  };

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 glass-card ${paid ? "unlocked-border" : "locked-glow"}`}
    >
      {/* Unlock flash overlay */}
      {justUnlocked && (
        <div
          aria-hidden
          className="absolute inset-0 z-20 unlock-flash pointer-events-none"
        />
      )}

      {/* Top header strip with badges */}
      <div className="flex items-start justify-between px-3 pt-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold glass-pill text-amber-300">
          <Trophy className="w-3 h-3" />
          {typeLabel(coupon)}
        </span>
        {paid && (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold badge-unlocked ${justUnlocked ? "unlock-burst" : ""}`}
          >
            {t("dashboard.unlocked")}
          </span>
        )}
      </div>

      {/* Media / preview area — square */}
      <div
        className={`mt-3 mx-3 rounded-xl aspect-square flex items-center justify-center overflow-hidden relative isolate ${paid ? "bg-chart-dark" : "brushed-gold"}`}
      >
        {url && playing ? (
          <video
            src={url}
            controls
            autoPlay
            className="absolute inset-0 w-full h-full bg-black object-cover"
          />
        ) : paid ? (
          <button
            type="button"
            onClick={onUnlock}
            disabled={busy}
            className="relative flex items-center justify-center w-full h-full focus:outline-none"
            aria-label={t("dashboard.watch")}
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
            {/* 3D-ish gold padlock */}
            <div className="relative flex items-center justify-center">
              <span
                aria-hidden
                className="absolute w-24 h-24 rounded-full lock-ring-pulse"
                style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.25) inset" }}
              />
              <span
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center lock-float"
                style={{
                  background: "radial-gradient(circle at 30% 25%, #fff1b8, #d4af37 60%, #6b4f12)",
                  boxShadow: "inset 0 2px 2px rgba(255,255,255,0.6), inset 0 -6px 12px rgba(0,0,0,0.35), 0 6px 14px rgba(0,0,0,0.45)",
                }}
              >
                <Lock className="w-7 h-7 text-amber-950" strokeWidth={2.5} />
              </span>
            </div>
            <span className="font-serif text-[13px] sm:text-sm font-bold text-bronze text-center">
              ACCÈS RESTREINT
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-4 space-y-2.5">
        <div>
          <h3 className="font-serif text-xl tracking-wide text-foreground">
            {coupon.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
            {coupon.description ?? t("coupon.fallback_desc")}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            {t("dashboard.available_today")}
          </span>
          {!paid && (
            <button type="button" className="text-amber-300 hover:text-amber-200 underline-offset-2 hover:underline">
              {t("dashboard.learn_more", { defaultValue: "Savoir Plus" })}
            </button>
          )}
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
                onClick={onDownload}
                className="glass-pill rounded-full px-3 h-9 text-foreground"
              >
                <Download className="w-4 h-4 mr-1" />
                {t("dashboard.download")}
              </Button>
              <Button
                size="sm"
                onClick={onUnlock}
                disabled={busy}
                className="glass-pill rounded-full px-3 h-9 text-emerald-300 hover:text-emerald-200"
                style={{ boxShadow: "0 0 18px rgba(52,211,153,0.35)" }}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-1 fill-current" />
                    {t("dashboard.watch")}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={onBuy}
              disabled={busy}
              className="btn-gold rounded-full px-5 h-9 font-semibold"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-1.5" />
                  {t("coupon.buy")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {user && (
        <PaymentModal
          open={payOpen}
          onOpenChange={setPayOpen}
          coupon={{
            id: coupon.id,
            title: coupon.title,
            price_xaf: coupon.price_xaf,
          }}
          customer={{
            name: user.user_metadata?.full_name ?? undefined,
            email: user.email ?? undefined,
          }}
        />
      )}
    </div>
  );
}

function CouponSkeleton({ themeKey }: { themeKey: ThemeKey }) {
  const th = THEMES[themeKey];
  return (
    <div
      className={`relative rounded-2xl border ${th.ring} bg-card overflow-hidden`}
    >
      <div className="flex items-start justify-between px-4 pt-4">
        <div className={`h-6 w-20 rounded-md ${th.badgeBg} skeleton-shimmer`} />
        <div className="h-6 w-12 rounded-md bg-muted/40 skeleton-shimmer" />
      </div>
      <div
        className={`mt-3 mx-3 sm:mx-4 rounded-xl border ${th.badgeBorder} aspect-square skeleton-shimmer`}
      />
      <div className="px-4 pt-4 pb-4 space-y-3">
        <div className="h-5 w-3/4 rounded skeleton-shimmer" />
        <div className="h-3 w-full rounded skeleton-shimmer" />
        <div className="h-3 w-2/3 rounded skeleton-shimmer" />
        <div className="flex items-end justify-between gap-3 pt-2">
          <div className="h-8 w-20 rounded skeleton-shimmer" />
          <div className="h-9 w-24 rounded-md skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
