import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import logo from "@/assets/yann-logo.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Zap, ShieldCheck, Star, ArrowRight, MessageCircle, LayoutDashboard, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings, whatsappLink } from "@/hooks/use-settings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { CouponsGrid } from "@/components/CouponsGrid";


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
          <Link to="/coupons-valides">
            <Button size="lg" variant="outline" className="border-primary/40 hover:bg-primary/10 h-12 px-8 font-semibold">
              <Trophy className="mr-2 w-4 h-4" /> Coupons validés
            </Button>
          </Link>
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
    { v: "92%", l: "Taux de réussite" },
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
  const { t } = useTranslation();
  return (
    <section id="coupons" className="relative py-20 sm:py-28 bg-luxury theme-fade overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-filigree pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="bg-primary/10 text-primary border border-primary/30">
            <Calendar className="w-3.5 h-3.5 mr-1" /> {t("home.coupons_badge", { defaultValue: "Coupons du jour" })}
          </Badge>
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl tracking-wide">
            Coupons <span className="text-gold">VIP du Jour</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            4 coupons exclusifs chaque jour. Vidéo verrouillée jusqu'au paiement, déblocage instantané.
          </p>
        </div>
        <CouponsGrid />
      </div>
    </section>
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
