import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/yann-logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, Trophy, Zap, ShieldCheck, Star, Flame, ArrowRight, MessageCircle, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "YANN PRONOSTICS — L'Expertise Sportive Premium" },
      { name: "description", content: "Coupons de pronostics sportifs premium. Cotes 2+, 5+, 10+, 20+, VIP & Jackpot. Achetez et débloquez instantanément." },
      { property: "og:title", content: "YANN PRONOSTICS — L'Expertise Sportive" },
      { property: "og:description", content: "Plateforme premium de pronostics sportifs. Expertise, fiabilité et résultats." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

const coupons = [
  { type: "Cote 2+", price: 1500, sales: 124, hot: false, desc: "Sélection sécurisée — idéale pour débuter la journée.", icon: TrendingUp },
  { type: "Cote 5+", price: 3000, sales: 87, hot: true, desc: "Équilibre parfait entre risque et rendement.", icon: Zap },
  { type: "Cote 10+", price: 5000, sales: 56, hot: true, desc: "Pour les parieurs avertis. Analyse approfondie.", icon: Flame },
  { type: "Cote 20+", price: 8000, sales: 31, hot: false, desc: "Gros gains potentiels — sélection exclusive.", icon: Trophy },
  { type: "VIP", price: 15000, sales: 42, hot: true, desc: "Accès privilégié, suivi personnalisé.", icon: Star },
  { type: "Jackpot", price: 25000, sales: 18, hot: false, desc: "Le ticket d'or pour un coup d'éclat.", icon: Trophy },
];

function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Stats />
      <Coupons />
      <Why />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  const { session, loading } = useAuth();
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
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
          {loading ? null : session ? (
            <Link to="/dashboard">
              <Button size="sm" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Mon espace
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm">Connexion</Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold">
                  S'inscrire
                </Button>
              </Link>
            </>
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
          Des pronostics analysés par des experts. Cotes 2+ à Jackpot.
          Débloquez vos coupons instantanément après paiement sécurisé.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-bold shadow-gold text-base h-12 px-8">
            Voir les coupons du jour <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" className="border-primary/40 hover:bg-primary/10 h-12 px-8">
            Comment ça marche
          </Button>
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

function Coupons() {
  return (
    <section id="coupons" className="py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="bg-primary/10 text-primary border border-primary/30">Coupons du jour</Badge>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl">Choisissez votre <span className="text-gold">coupon premium</span></h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Contenu verrouillé jusqu'au paiement. Déblocage instantané et accès à vie.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {coupons.map((c) => <CouponCard key={c.type} {...c} />)}
        </div>
      </div>
    </section>
  );
}

function CouponCard({ type, price, sales, hot, desc, icon: Icon }: typeof coupons[number]) {
  return (
    <div className="group relative rounded-2xl border border-border/60 bg-card overflow-hidden transition-all hover:border-primary/50 hover:shadow-gold">
      {hot && (
        <Badge className="absolute top-4 right-4 z-10 bg-destructive text-destructive-foreground">
          <Flame className="w-3 h-3 mr-1" /> HOT
        </Badge>
      )}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold">
            <Icon className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-2xl">{type}</div>
            <div className="text-xs text-muted-foreground">{sales} ventes</div>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{desc}</p>

        <div className="mt-6 relative rounded-xl border border-dashed border-primary/30 bg-background/40 p-6 flex flex-col items-center justify-center min-h-32">
          <Lock className="w-7 h-7 text-primary/70" />
          <p className="mt-2 text-xs text-muted-foreground">Contenu verrouillé</p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Prix</div>
            <div className="font-display text-2xl text-gold">{price.toLocaleString("fr-FR")} XAF</div>
          </div>
          <Button className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-semibold shadow-gold">
            Acheter
          </Button>
        </div>
      </div>
    </div>
  );
}

function Why() {
  const items = [
    { icon: ShieldCheck, t: "Paiement sécurisé", d: "MTN, Orange Money, Campay, PayPal, cartes bancaires." },
    { icon: Zap, t: "Déblocage instantané", d: "Accès immédiat après confirmation du paiement." },
    { icon: Trophy, t: "Expertise reconnue", d: "Analyses approfondies par des spécialistes du sport." },
    { icon: Star, t: "Programme VIP", d: "Abonnements et coupons exclusifs pour nos membres premium." },
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
            <a href="https://wa.me/237658670732" target="_blank" rel="noreferrer">
              <Button size="lg" className="bg-gold-gradient text-primary-foreground hover:opacity-90 font-bold shadow-gold h-12 px-8">
                <MessageCircle className="mr-2 w-4 h-4" /> +237 6 58 67 07 32
              </Button>
            </a>
            <a href="https://whatsapp.com/channel/0029Vb5XTFq3rZZYZcDC9W3b" target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="border-primary/40 hover:bg-primary/10 h-12 px-8">
                Rejoindre le canal
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <span className="font-display tracking-wider text-gold">YANN PRONOSTICS</span>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} YANN PRONOSTICS. L'expertise sportive premium.</p>
      </div>
    </footer>
  );
}
