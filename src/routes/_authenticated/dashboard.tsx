import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/yann-logo.png";
import { LogOut, Trophy, Lock, Play, Loader2, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
import { initiatePayment } from "@/lib/payments.functions";
import { toast } from "sonner";
import { consumePendingPurchase } from "@/components/VisitorSignupPrompt";
import { LanguageToggle } from "@/components/LanguageToggle";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Mon espace — YANN PRONOSTICS" }] }),
  component: Dashboard,
});

type Coupon = {
  id: string; title: string; description: string | null;
  price_xaf: number; video_url: string | null; coupon_type: string | null;
  start_date: string | null; end_date: string | null;
};

function Dashboard() {
  const { t } = useTranslation();
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const initiate = useServerFn(initiatePayment);
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Membre";

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && isAdmin) {
      navigate({ to: "/admin", replace: true });
    }
  }, [loading, isAdmin, navigate]);

  // Load coupons + paid transactions
  const loadAll = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const [{ data: cps }, { data: txs }] = await Promise.all([
      supabase
        .from("coupons")
        .select("*")
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
    setPaidIds(new Set((txs ?? []).map((t: any) => t.coupon_id).filter(Boolean)));
  };

  useEffect(() => {
    if (!user || isAdmin) return;
    loadAll();
    // Realtime: when a transaction for this user flips to completed, refresh
    const channel = supabase
      .channel(`user-tx-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
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

  // Resume pending purchase if visitor signed in after click
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

  if (loading || isAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <span className="font-display tracking-wider text-gold hidden sm:block">YANN PRONOSTICS</span>
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
            <p className="text-sm text-muted-foreground">{t("dashboard.welcome")}</p>
            <h1 className="font-display text-4xl sm:text-5xl mt-1">{t("dashboard.hello")} <span className="text-gold">{name}</span></h1>
            <p className="mt-2 text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-2xl mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-gold" /> {t("dashboard.today_coupons")}</h2>
          {coupons.length === 0 ? (
            <p className="text-muted-foreground">{t("coupon.none")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {coupons.map((c) => <UserCouponCard key={c.id} coupon={c} paid={paidIds.has(c.id)} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function UserCouponCard({ coupon, paid }: { coupon: Coupon; paid: boolean }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const getAccess = useServerFn(getCouponVideoAccess);
  const initiate = useServerFn(initiatePayment);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  // Auto-fetch the video URL when paid (so it unlocks instantly via realtime)
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
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("dashboard.access_error"));
    } finally {
      setBusy(false);
    }
  };

  const onBuy = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await initiate({
        data: {
          kind: "coupon",
          couponId: coupon.id,
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
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg">{coupon.title}</div>
          {paid && (
            <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" /> OK
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-8">{coupon.description ?? t("coupon.fallback_desc")}</p>
        <div className="mt-4 rounded-xl border border-dashed border-primary/30 bg-background/40 aspect-video flex items-center justify-center overflow-hidden">
          {url ? (
            <video src={url} controls className="w-full h-full rounded-xl bg-black" />
          ) : (
            <div className="text-center">
              <Lock className="w-7 h-7 text-primary/70 mx-auto" />
              <p className="mt-1 text-xs text-muted-foreground">{t("coupon.locked")}</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="font-display text-lg text-gold">{coupon.price_xaf.toLocaleString()} XAF</span>
          {paid ? (
            <Button size="sm" onClick={onUnlock} disabled={busy || !!url} className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : url ? <><Play className="w-4 h-4 mr-1" />{t("coupon.play")}</> : <><Play className="w-4 h-4 mr-1" />{t("coupon.play")}</>}
            </Button>
          ) : (
            <Button size="sm" onClick={onBuy} disabled={busy} className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4 mr-1" />{t("coupon.buy")}</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
