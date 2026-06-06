import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import logo from "@/assets/yann-logo.png";
import { LogOut, Trophy, Calendar, Crown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { initiatePayment } from "@/lib/payments.functions";
import { toast } from "sonner";
import { consumePendingPurchase } from "@/components/VisitorSignupPrompt";
import { LanguageToggle } from "@/components/LanguageToggle";
import { CouponsGrid } from "@/components/CouponsGrid";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Mon espace — YANN PRONOSTICS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const initiate = useServerFn(initiatePayment);
  const name =
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split("@")[0] ||
    "Membre";

  useEffect(() => {
    if (!loading && isAdmin) {
      navigate({ to: "/admin", replace: true });
    }
  }, [loading, isAdmin, navigate]);

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

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

          <CouponsGrid />
        </section>
      </main>
    </div>
  );
}
