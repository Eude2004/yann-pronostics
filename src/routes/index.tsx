import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import logo from "@/assets/yann-logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, Trophy, Zap, ShieldCheck, Star, Flame, ArrowRight, MessageCircle, LayoutDashboard, Calendar, ShoppingCart, Loader2, Play, CheckCircle2, Download } from "lucide-react";
import { CouponStatusBadge } from "@/components/CouponStatusBadge";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
import { refreshAndGetNextTransition } from "@/lib/coupon-schedule.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useSettings, whatsappLink } from "@/hooks/use-settings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PaymentModal } from "@/components/PaymentModal";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "YANN PRONOSTICS — L'Expertise Sportive Premium" },
      { name: "description", content: "Coupons de pronostics sportifs premium. Cotes 10+, 30+, 50+ et Coupon Total Pair Corner. Déblocage instantané après paiement." },
      { property: "og:title", content: "YANN PRONOSTICS — L'Expertise Sportive" },
      { property: "og:description", content: "Plateforme premium de pronostics sportifs. 4 coupons exclusifs chaque jour." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

type CouponType = "cote_10" | "cote_30" | "cote_50" | "pair_corner";

type Coupon = {
  id: string; coupon_type: CouponType | null; title: string;
  description: string | null; price_xaf: number; image_url: string | null;
  video_url: string | null; start_date: string | null; end_date: string | null;
  event_date: string | null;
  sales_count: number; status: "draft" | "published" | "archived";
};

const TYPE_META: Record<CouponType, { icon: any; gradient: string; hot: boolean }> = {
  cote_10: { icon: TrendingUp, gradient: "from-blue-500/20 to-primary/20", hot: false },
  cote_30: { icon: Zap, gradient: "from-orange-500/20 to-primary/20", hot: true },
  cote_50: { icon: Flame, gradient: "from-red-500/20 to-primary/20", hot: true },
  pair_corner: { icon: Trophy, gradient: "from-purple-500/20 to-primary/20", hot: false },
};

function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Stats />
      <CouponsSection />
      <Why />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  const { session, loading, isAdmin } = useAuth();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="YANN PRONOSTICS" className="h-10 w-10 object-contain" />
          <span className="font-display text-lg tracking-wider text-gold hidden sm:block">YANN PRONOSTICS</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm">
          <a href="#coupons" className="hover:text-primary transition-colors">{t("nav.coupons")}</a>
          <Link to="/coupons-valides" className="hover:text-primary transition-colors text-gold font-semibold">
            {t("validated.nav", { defaultValue: "Coupons validés" })}
          </Link>
          <a href="#why" className="hover:text-primary transition-colors">{t("nav.why")}</a>
          <a href="#contact" className="hover:text-primary transition-colors">{t("nav.contact")}</a>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {loading ? null : session ? (
            <Link to={isAdmin ? "/admin" : "/dashboard"}>
              <Button size="sm" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold">
                <LayoutDashboard className="w-4 h-4 mr-2" /> {isAdmin ? t("common.admin") : t("common.myspace")}
              </Button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold">
                {t("common.login")}
              </Button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}



function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <img src={logo} alt="Logo YANN PRONOSTICS" className="mx-auto h-32 sm:h-44 w-auto object-contain glow-pulse rounded-2xl" />
        <Badge className="mt-8 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15">
          <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Plateforme premium certifiée
        </Badge>
        <h1 className="mt-6 font-display text-5xl sm:text-7xl lg:text-8xl leading-[0.95]">
          L'<span className="text-gold">EXPERTISE</span><br/>SPORTIVE PREMIUM
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground">
          4 coupons exclusifs chaque jour : Cote 10+, 30+, 50+ et Total Pair Corner.
          Déblocage instantané après paiement sécurisé.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <a href="#coupons">
            <Button size="lg" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-bold shadow-gold text-base h-12 px-8">
              Voir les coupons du jour <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </a>
          <a href="#why">
            <Button size="lg" variant="outline" className="border-primary/40 hover:bg-primary/10 h-12 px-8">
              Comment ça marche
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { v: "12 580+", l: "Coupons vendus" },
    { v: "87%", l: "Taux de réussite" },
    { v: "5 200+", l: "Clients satisfaits" },
    { v: "24/7", l: "Support WhatsApp" },
  ];
  return (
    <section className="border-y border-border/50 bg-card/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s) => (
          <div key={s.l} className="text-center">
            <div className="font-display text-3xl sm:text-4xl text-gold">{s.v}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}


function CouponsSection() {
  const { session } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    // Règle des 4 coupons : on garde tous les coupons "published" (un seul actif par
    // catégorie, garanti par le trigger DB). Un coupon dont la date de fin est passée
    // reste affiché tant qu'aucun nouveau coupon de sa catégorie ne le remplace.
    const { data } = await supabase
      .from("coupons")
      .select("id, title, slug, description, sport, category_id, price_xaf, odds, image_url, preview_content, status, is_featured, created_by, created_at, updated_at, coupon_type, video_url, start_date, end_date, sales_count, event_date")
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
      .channel("home-coupons")
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, load)
      .subscribe();

    // Latence zéro à l'heure de début : on demande au serveur la prochaine
    // transition planifiée et on programme un setTimeout précis pour relancer
    // refresh_coupon_statuses() exactement à ce moment-là. Realtime se charge
    // ensuite de pousser le nouveau coupon publié à l'écran.
    let timeoutId: number | undefined;
    let cancelled = false;
    const scheduleNext = async () => {
      try {
        const { nextTransitionAt } = await refreshAndGetNextTransition();
        if (cancelled || !nextTransitionAt) return;
        const delay = Math.max(0, new Date(nextTransitionAt).getTime() - Date.now()) + 250;
        // setTimeout est plafonné à ~24 jours ; au-delà on re-planifie plus tard.
        const safeDelay = Math.min(delay, 6 * 60 * 60 * 1000); // re-check au plus tard dans 6h
        timeoutId = window.setTimeout(scheduleNext, safeDelay);
      } catch {
        // En cas d'échec réseau, on retentera dans 60s — le cron sert de filet.
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
      .channel(`home-tx-${session.user.id}`)
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
    // Filet de sécurité : tant qu'un paiement est en cours, on rafraîchit toutes les 3s
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

  const purchasedCount = paidIds.size;

  // Règle stricte des 4 coupons : 1 carte par catégorie, dans un ordre fixe.
  // Si aucune carte publiée pour la catégorie, on rend un emplacement « bientôt disponible »
  // afin que la grille affiche TOUJOURS 4 cartes, ni plus ni moins, même
  // pendant les bascules publication/expiration.
  const CATEGORY_ORDER: CouponType[] = ["cote_10", "cote_30", "cote_50", "pair_corner"];
  const byType = new Map<CouponType, Coupon>();
  for (const c of coupons) {
    if (!c.coupon_type) continue;
    if (!byType.has(c.coupon_type)) byType.set(c.coupon_type, c);
  }
  const slots: Array<{ type: CouponType; coupon: Coupon | null }> = CATEGORY_ORDER.map((type) => ({
    type,
    coupon: byType.get(type) ?? null,
  }));
  const activeCount = slots.filter((s) => s.coupon).length;

  return (
    <section id="coupons" className="relative py-20 sm:py-28 bg-luxury theme-fade overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-filigree pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="bg-primary/10 text-primary border border-primary/30">
            <Calendar className="w-3.5 h-3.5 mr-1" /> Coupons du jour
          </Badge>
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl tracking-wide">
            Coupons <span className="text-gold">VIP du Jour</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            4 coupons exclusifs chaque jour. Vidéo verrouillée jusqu'au paiement, déblocage instantané.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-amber-400/60 bg-amber-500/5 text-amber-300 shadow-[inset_0_0_10px_rgba(212,175,55,0.15)]">
              {activeCount} / 4 coupons disponibles
            </span>
            {session && purchasedCount > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-sky-400/60 bg-sky-500/5 text-sky-300 shadow-[inset_0_0_10px_rgba(56,189,248,0.18)]">
                <CheckCircle2 className="w-3 h-3 mr-1" /> {purchasedCount} acheté{purchasedCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl glass-card aspect-[3/4] skeleton-shimmer" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
            {slots.map((slot) =>
              slot.coupon ? (
                <CouponCard key={slot.coupon.id} coupon={slot.coupon} paid={paidIds.has(slot.coupon.id)} />
              ) : (
                <ComingSoonCard key={`slot-${slot.type}`} type={slot.type} />
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
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

const COUPON_TYPE_LABEL: Record<CouponType, string> = {
  cote_10: "Cote de 10+",
  cote_30: "Cote de 30+",
  cote_50: "Cote de 50+",
  pair_corner: "Coupon Total Pair Corner",
};

function CouponCard({ coupon, paid }: { coupon: Coupon; paid: boolean }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const getAccess = useServerFn(getCouponVideoAccess);
  const [payOpen, setPayOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const meta = coupon.coupon_type ? TYPE_META[coupon.coupon_type] : TYPE_META.cote_10;
  const Icon = meta.icon;

  // Bascule automatique vers « TERMINÉ » / « EN COURS » sans reload.
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = window.setInterval(tick, 30_000);
    const timeouts: number[] = [];
    const schedule = (iso: string | null) => {
      if (!iso) return;
      const ms = new Date(iso).getTime() - Date.now();
      if (ms > 0 && ms < 2_147_483_647) timeouts.push(window.setTimeout(tick, ms + 250));
    };
    schedule(coupon.event_date);
    schedule(coupon.end_date);
    return () => {
      window.clearInterval(interval);
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, [coupon.end_date, coupon.event_date]);

  const ended = !!coupon.end_date && new Date(coupon.end_date).getTime() <= now.getTime();
  const inProgress = !ended && !!coupon.event_date && new Date(coupon.event_date).getTime() <= now.getTime();
  // Acheteurs existants conservent l'accès intégral même quand l'événement a démarré.
  const lockedForPurchase = ended || (inProgress && !paid);

  const dateLabel = coupon.start_date
    ? new Date(coupon.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    : new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  useEffect(() => {
    if (!paid || url) return;
    (async () => {
      try {
        const res = await getAccess({ data: { couponId: coupon.id } });
        if (res.url) setUrl(res.url);
      } catch {}
    })();
  }, [paid, url, getAccess, coupon.id]);

  const handleBuy = () => {
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
    setPayOpen(true);
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
        if (!res.url) {
          toast.error("Vidéo non disponible.");
          return;
        }
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
      {/* Top header strip */}
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
          <span className="live-pulse inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold border border-amber-400/70 bg-amber-500/10 text-amber-300 tracking-wider">
            <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-amber-300" />
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

      {/* Media — square */}
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

        {/* Overlay TERMINÉ — filigrane opaque qui masque la carte expirée */}
        {ended && !paid && (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(15,15,20,0.72) 0%, rgba(40,40,50,0.62) 100%)",
              backdropFilter: "blur(2px)",
            }}
          >
            <span
              className="font-serif font-extrabold tracking-[0.25em] text-3xl sm:text-4xl text-white/85 select-none rotate-[-12deg]"
              style={{
                textShadow:
                  "0 2px 12px rgba(0,0,0,0.65), 0 0 1px rgba(255,255,255,0.5)",
                WebkitTextStroke: "1px rgba(255,255,255,0.25)",
              }}
            >
              {t("coupon.expired", { defaultValue: "TERMINÉ" })}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
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
          {inProgress && (
            <div
              className="live-pulse mt-2 rounded-md px-2.5 py-1.5 text-[11px] font-bold tracking-wide flex items-center gap-2 border border-amber-400/60 bg-amber-500/10 text-amber-300"
              role="status"
              aria-live="polite"
            >
              <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-amber-300" />
              {t("coupon.in_progress_banner", { defaultValue: "En cours sur ce coupon" })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShoppingCart className="w-3 h-3" /> {coupon.sales_count}
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
              className="live-pulse rounded-full px-5 h-9 font-semibold bg-amber-500/15 text-amber-200 border border-amber-400/50 cursor-not-allowed"
            >
              {t("coupon.in_progress", { defaultValue: "EN COURS" })}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleBuy}
              className="btn-gold rounded-full px-5 h-9 font-semibold"
            >
              {t("coupon.buy", { defaultValue: "Acheter" })}
            </Button>
          )}
        </div>
      </div>


      {session && (
        <PaymentModal
          open={payOpen}
          onOpenChange={setPayOpen}
          coupon={{ id: coupon.id, title: coupon.title, price_xaf: coupon.price_xaf }}
          customer={{
            name: session.user.user_metadata?.full_name ?? undefined,
            email: session.user.email ?? undefined,
          }}
        />
      )}
    </div>
  );
}

function Why() {
  const items = [
    { icon: ShieldCheck, t: "Paiement sécurisé", d: "MTN, Orange Money, Campay, cartes bancaires via CinetPay." },
    { icon: Zap, t: "Déblocage instantané", d: "Accès immédiat après confirmation du paiement." },
    { icon: Trophy, t: "Expertise reconnue", d: "Analyses approfondies par des spécialistes du sport." },
    { icon: Star, t: "Vente à l'unité", d: "Aucun abonnement, payez uniquement les coupons qui vous intéressent." },
  ];
  return (
    <section id="why" className="py-20 sm:py-28 bg-card/40 border-y border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl sm:text-5xl">Pourquoi <span className="text-gold">YANN PRONOSTICS</span></h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-border/60 bg-background p-6 hover:border-primary/40 transition">
              <Icon className="w-8 h-8 text-primary" />
              <h3 className="mt-4 font-display text-xl">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const { settings } = useSettings();
  const phone = settings.whatsapp_number;
  const href = whatsappLink(phone, "Bonjour YANN PRONOSTICS, j'ai une question.");
  const displayPhone = `+237 ${phone.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}`;
  return (
    <section id="contact" className="py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl border border-primary/30 bg-gradient-to-br from-card to-background p-10 sm:p-14 text-center overflow-hidden shadow-glow">
          <div className="absolute inset-0 -z-10 opacity-30">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/30 blur-3xl" />
          </div>
          <Badge className="bg-primary/10 text-primary border border-primary/30">Contact direct</Badge>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl">Une question ? <span className="text-gold">Écrivez-nous</span></h2>
          <p className="mt-4 text-muted-foreground">Échanges exclusifs via WhatsApp — support réactif 7j/7.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href={href} target="_blank" rel="noreferrer">
              <Button size="lg" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-bold shadow-gold h-12 px-8">
                <MessageCircle className="mr-2 w-4 h-4" /> {displayPhone}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { settings } = useSettings();
  const phone = settings.whatsapp_number;
  const href = whatsappLink(phone);
  return (
    <footer className="border-t border-border/50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <span className="font-display tracking-wider text-gold">YANN PRONOSTICS</span>
        </div>
        <a href={href} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <MessageCircle className="w-4 h-4" /> Support WhatsApp : +237 {phone}
        </a>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} YANN PRONOSTICS</p>
      </div>
    </footer>
  );
}
