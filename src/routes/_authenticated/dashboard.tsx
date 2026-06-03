import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
    const now = new Date().toISOString();
    const [{ data: cps }, { data: txs }] = await Promise.all([
      supabase
        .from("coupons")
        .select(
          "id, title, slug, description, sport, category_id, price_xaf, odds, image_url, preview_content, status, is_featured, created_by, created_at, updated_at, coupon_type, video_url, start_date, end_date, sales_count, event_date",
        )
        .eq("status", "published")
        .or(`end_date.is.null,end_date.gte.${now}`)
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <span className="font-display tracking-wider text-gold hidden sm:block">
              YANN PRONOSTICS
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> {t("common.logout")}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.welcome")}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl mt-1">
              {t("dashboard.hello")}{" "}
              <span className="text-gold">{name}</span>
            </h1>
            <p className="mt-2 text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Coupons VIP du Jour — section */}
        <section className="mt-12 relative">
          {/* subtle gold glow band behind the header */}
          <div
            aria-hidden
            className="absolute inset-x-0 -top-4 h-32 rounded-3xl pointer-events-none"
            style={{
              background:
                "radial-gradient(60% 100% at 20% 50%, oklch(0.83 0.16 88 / 0.10), transparent 70%)",
            }}
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-gold" />
              <h2 className="font-display text-3xl sm:text-4xl tracking-wide text-gold">
                {t("dashboard.today_coupons")}
              </h2>
            </div>

            <div className="mt-3 flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4" />
              <span>{todayLabel}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-amber-500/40 bg-amber-500/10 text-amber-400">
                {t("dashboard.coupons_available", {
                  count: coupons.length,
                  defaultValue: `${coupons.length} coupons disponibles`,
                })}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                {t("dashboard.coupons_purchased", {
                  count: purchasedCount,
                  defaultValue: `${purchasedCount} achetés`,
                })}
              </span>
            </div>

            <div className="my-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {coupons.length === 0 ? (
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
  const th = THEMES[themeKey];

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

  const onBuy = () => setPayOpen(true);

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
      className={`group relative rounded-2xl border ${th.ring} bg-card overflow-hidden transition-all duration-300 hover:-translate-y-0.5 ${th.glow} hover:shadow-[0_0_60px_-8px_currentColor]`}
    >
      {/* Top header strip with badges */}
      <div className="flex items-start justify-between px-4 pt-4">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${th.badgeBorder} ${th.badgeBg} ${th.text}`}
        >
          {typeLabel(coupon)}
        </span>
        {paid && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border border-emerald-500/50 bg-emerald-500/10 text-emerald-400">
            {t("dashboard.unlocked")}
          </span>
        )}
      </div>

      {/* Media / preview area — square, matches mockup */}
      <div
        className={`mt-3 mx-3 sm:mx-4 rounded-xl border ${th.badgeBorder} aspect-square flex items-center justify-center overflow-hidden relative isolate`}
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.04), transparent 60%), linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.15))",
        }}
      >
        {/* Subtle grid backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            color: "white",
          }}
        />

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
            className="relative flex flex-col items-center justify-center gap-2 w-full h-full focus:outline-none group/play"
            aria-label={t("dashboard.watch")}
          >
            <span
              aria-hidden
              className={`absolute w-20 h-20 rounded-full border ${th.badgeBorder} lock-ring-pulse`}
            />
            <span
              className={`relative w-16 h-16 rounded-full flex items-center justify-center ${th.badgeBg} border ${th.badgeBorder} backdrop-blur-sm transition-transform group-hover/play:scale-110`}
            >
              {busy ? (
                <Loader2 className={`w-7 h-7 animate-spin ${th.text}`} />
              ) : (
                <Play className={`w-7 h-7 ${th.text} fill-current ml-0.5`} />
              )}
            </span>
          </button>
        ) : (
          <>
            {/* Shimmer overlay */}
            <div
              aria-hidden
              className="absolute inset-0 lock-shimmer pointer-events-none"
            />
            {/* Scanline */}
            <div
              aria-hidden
              className={`absolute inset-x-0 h-px scanline ${th.text}`}
              style={{ boxShadow: "0 0 12px currentColor" }}
            />

            <div className="relative flex flex-col items-center gap-3 px-4">
              {/* Pulsing rings */}
              <div className="relative flex items-center justify-center">
                <span
                  aria-hidden
                  className={`absolute w-24 h-24 rounded-full border ${th.badgeBorder} lock-ring-pulse`}
                  style={{ animationDelay: "0s" }}
                />
                <span
                  aria-hidden
                  className={`absolute w-24 h-24 rounded-full border ${th.badgeBorder} lock-ring-pulse`}
                  style={{ animationDelay: "1.2s" }}
                />
                <span
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center ${th.badgeBg} border ${th.badgeBorder} backdrop-blur-sm lock-float`}
                >
                  <Lock className={`w-7 h-7 ${th.text}`} />
                </span>
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] ${th.text} text-center`}
              >
                {t("dashboard.access_restricted")}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-4 space-y-3">
        <div>
          <h3 className="font-display text-xl tracking-wide text-foreground">
            {coupon.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
            {coupon.description ?? t("coupon.fallback_desc")}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          <span>{t("dashboard.available_today")}</span>
        </div>

        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="font-display text-2xl text-gold leading-none">
            {coupon.price_xaf.toLocaleString("fr-FR")}
            <span className="block text-xs font-sans text-muted-foreground mt-1">
              FCFA
            </span>
          </div>

          {paid ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onDownload}
                className={`border ${th.badgeBorder} bg-transparent ${th.text} hover:bg-emerald-500/10`}
              >
                <Download className="w-4 h-4 mr-1" />
                {t("dashboard.download")}
              </Button>
              <Button
                size="sm"
                onClick={onUnlock}
                disabled={busy}
                className={`${th.btnBg} ${th.btnHover} text-white font-semibold`}
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
              className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-1" />
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
