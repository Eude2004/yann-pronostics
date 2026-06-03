import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import logo from "@/assets/yann-logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, Trophy, Zap, ShieldCheck, Star, Flame, ArrowRight, MessageCircle, LayoutDashboard, Calendar, ShoppingCart, Loader2, Play, CheckCircle2, Download } from "lucide-react";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
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
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("status", "published")
      .or(`end_date.is.null,end_date.gte.${now}`)
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
    return () => { supabase.removeChannel(channel); };
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
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const purchasedCount = paidIds.size;

  return (
    <section id="coupons" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="bg-primary/10 text-primary border border-primary/30">
            <Calendar className="w-3.5 h-3.5 mr-1" /> Coupons du jour
          </Badge>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl">Choisissez votre <span className="text-gold">coupon premium</span></h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">4 coupons exclusifs chaque jour. Vidéo verrouillée jusqu'au paiement, déblocage instantané.</p>
          {session && (
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span>{coupons.length} coupons disponibles</span>
              {purchasedCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-emerald-500 font-medium inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {purchasedCount} acheté{purchasedCount > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Chargement…</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {coupons.map((c) => <CouponCard key={c.id} coupon={c} paid={paidIds.has(c.id)} />)}
          </div>
        )}
      </div>

    </section>
  );
}

function CouponCard({ coupon, paid }: { coupon: Coupon; paid: boolean }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const getAccess = useServerFn(getCouponVideoAccess);
  const [payOpen, setPayOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const meta = coupon.coupon_type ? TYPE_META[coupon.coupon_type] : TYPE_META.cote_10;
  const Icon = meta.icon;

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
    <div className={`group relative rounded-2xl border bg-card overflow-hidden transition-all hover:shadow-gold ${paid ? "border-emerald-500/50" : "border-border/60 hover:border-primary/50"}`}>
      <Badge className="absolute top-4 right-4 z-10 bg-gold-gradient text-primary-foreground border-0 shadow-gold">
        <Star className="w-3 h-3 mr-1 fill-current" /> Premium
      </Badge>
      {paid ? (
        <Badge className="absolute top-4 left-4 z-10 bg-emerald-500 text-white border-0">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Débloqué
        </Badge>
      ) : meta.hot && (
        <Badge className="absolute top-4 left-4 z-10 bg-destructive text-destructive-foreground">
          <Flame className="w-3 h-3 mr-1" /> HOT
        </Badge>
      )}
      <div className={`h-2 bg-gradient-to-r ${meta.gradient}`} />
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold shrink-0">
            <Icon className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-xl truncate">{coupon.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="w-3 h-3" /> {coupon.sales_count} ventes
              <span>•</span>
              <Calendar className="w-3 h-3" /> {dateLabel}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground line-clamp-2 min-h-10">
          {coupon.description || "Pronostic premium analysé par nos experts."}
        </p>

        <div className="mt-4 relative rounded-xl border border-dashed border-primary/30 bg-background/40 overflow-hidden aspect-video flex items-center justify-center">
          {paid && url ? (
            <video src={url} controls className="w-full h-full bg-black" />
          ) : paid ? (
            <button
              type="button"
              onClick={handlePlay}
              disabled={busy}
              className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            >
              {busy ? <Loader2 className="w-8 h-8 animate-spin text-emerald-500" /> : <Play className="w-10 h-10 text-emerald-500 fill-emerald-500" />}
              <p className="mt-2 text-xs text-emerald-500 font-medium">Lire la vidéo</p>
            </button>
          ) : coupon.image_url ? (
            <div className="relative w-full h-full">
              <img src={coupon.image_url} alt="" className="w-full h-full object-cover blur-md" />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60">
                <Lock className="w-7 h-7 text-primary" />
                <p className="mt-1 text-xs text-muted-foreground">Vidéo verrouillée</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Lock className="w-7 h-7 text-primary/70" />
              <p className="mt-2 text-xs text-muted-foreground">Vidéo verrouillée</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">{t("coupon.price")}</div>
            <div className="font-display text-2xl text-gold">{coupon.price_xaf.toLocaleString("fr-FR")} FCFA</div>
          </div>
          {paid ? (
            <Button
              onClick={handlePlay}
              disabled={busy || !!url}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 mr-1 fill-current" /> Voir</>}
            </Button>
          ) : (
            <Button
              onClick={handleBuy}
              className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold"
            >
              {t("coupon.buy")}
            </Button>
          )}
        </div>
      </div>

      <VisitorSignupPrompt open={promptOpen} onOpenChange={setPromptOpen} couponId={coupon.id} />
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
