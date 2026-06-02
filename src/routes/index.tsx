import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import logo from "@/assets/yann-logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, Trophy, Zap, ShieldCheck, Star, Flame, ArrowRight, MessageCircle, LayoutDashboard, Calendar, ShoppingCart, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useSettings, whatsappLink } from "@/hooks/use-settings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { initiatePayment } from "@/lib/payments.functions";
import { VisitorSignupPrompt } from "@/components/VisitorSignupPrompt";
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
  const { session, loading, isAdmin } = useAuth();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="YANN PRONOSTICS" className="h-10 w-10 object-contain" />
          <span className="font-display text-lg tracking-wider text-gold hidden sm:block">YANN PRONOSTICS</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm">
          <a href="#coupons" className="hover:text-primary transition-colors">Coupons</a>
          <a href="#why" className="hover:text-primary transition-colors">Pourquoi nous</a>
          <a href="#contact" className="hover:text-primary transition-colors">Contact</a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {loading ? null : session ? (
            <Link to={isAdmin ? "/admin" : "/dashboard"}>
              <Button size="sm" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold">
                <LayoutDashboard className="w-4 h-4 mr-2" /> {isAdmin ? "Admin" : "Mon espace"}
              </Button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold">
                Se connecter
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

const FALLBACK_COUPONS: Coupon[] = [
  { id: "1", coupon_type: "cote_10", title: "Cote de 10+", description: "Sélection sécurisée — idéale pour démarrer la journée.", price_xaf: 4000, image_url: null, video_url: null, start_date: null, end_date: null, sales_count: 0, status: "published" },
  { id: "2", coupon_type: "cote_30", title: "Cote de 30+", description: "Équilibre parfait entre risque et rendement.", price_xaf: 5000, image_url: null, video_url: null, start_date: null, end_date: null, sales_count: 0, status: "published" },
  { id: "3", coupon_type: "cote_50", title: "Cote de 50+", description: "Pour les parieurs avertis. Analyse approfondie.", price_xaf: 7000, image_url: null, video_url: null, start_date: null, end_date: null, sales_count: 0, status: "published" },
  { id: "4", coupon_type: "pair_corner", title: "Coupon Total Pair Corner", description: "La sélection corner exclusive du jour.", price_xaf: 6000, image_url: null, video_url: null, start_date: null, end_date: null, sales_count: 0, status: "published" },
];

function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("status", "published")
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order("coupon_type");
      const dbCoupons = (data as Coupon[]) ?? [];
      // Merge with fallback so the 4 types always show
      const byType = new Map(dbCoupons.filter(c => c.coupon_type).map(c => [c.coupon_type, c]));
      const merged = FALLBACK_COUPONS.map(f => byType.get(f.coupon_type!) ?? f);
      setCoupons(merged);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <section id="coupons" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="bg-primary/10 text-primary border border-primary/30">
            <Calendar className="w-3.5 h-3.5 mr-1" /> Coupons du jour
          </Badge>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl">Choisissez votre <span className="text-gold">coupon premium</span></h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">4 coupons exclusifs chaque jour. Vidéo verrouillée jusqu'au paiement, déblocage instantané.</p>
        </div>
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Chargement…</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {coupons.map((c) => <CouponCard key={c.id} coupon={c} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function CouponCard({ coupon }: { coupon: Coupon }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const initiate = useServerFn(initiatePayment);
  const [loadingBuy, setLoadingBuy] = useState(false);
  const meta = coupon.coupon_type ? TYPE_META[coupon.coupon_type] : TYPE_META.cote_10;
  const Icon = meta.icon;

  const dateLabel = coupon.start_date
    ? new Date(coupon.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    : new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  const handleBuy = async () => {
    if (!session) {
      toast.info("Connectez-vous pour acheter ce coupon");
      navigate({ to: "/auth", search: { redirect: "/" } as never });
      return;
    }
    if (!coupon.id || coupon.id.length < 30) {
      toast.error("Ce coupon n'est pas encore enregistré côté admin.");
      return;
    }
    setLoadingBuy(true);
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
      window.location.href = res.paymentUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'initier le paiement");
      setLoadingBuy(false);
    }
  };

  return (
    <div className="group relative rounded-2xl border border-border/60 bg-card overflow-hidden transition-all hover:border-primary/50 hover:shadow-gold">
      <Badge className="absolute top-4 right-4 z-10 bg-gold-gradient text-primary-foreground border-0 shadow-gold">
        <Star className="w-3 h-3 mr-1 fill-current" /> Premium
      </Badge>
      {meta.hot && (
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

        <div className="mt-4 relative rounded-xl border border-dashed border-primary/30 bg-background/40 p-6 flex flex-col items-center justify-center min-h-32">
          {coupon.image_url ? (
            <div className="relative w-full h-32 rounded-lg overflow-hidden">
              <img src={coupon.image_url} alt="" className="w-full h-full object-cover blur-md" />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60">
                <Lock className="w-7 h-7 text-primary" />
                <p className="mt-1 text-xs text-muted-foreground">Vidéo verrouillée</p>
              </div>
            </div>
          ) : (
            <>
              <Lock className="w-7 h-7 text-primary/70" />
              <p className="mt-2 text-xs text-muted-foreground">Vidéo verrouillée</p>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">Prix</div>
            <div className="font-display text-2xl text-gold">{coupon.price_xaf.toLocaleString("fr-FR")} XAF</div>
          </div>
          <Button
            onClick={handleBuy}
            disabled={loadingBuy}
            className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold"
          >
            {loadingBuy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Acheter"}
          </Button>
        </div>
      </div>
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
