import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ArrowLeft, Trophy, CheckCircle2, Calendar, X } from "lucide-react";
import logo from "@/assets/yann-logo.png";

export const Route = createFileRoute("/coupons-valides")({
  head: () => ({
    meta: [
      { title: "Coupons Validés — YANN PRONOSTICS" },
      { name: "description", content: "Historique de nos coupons gagnants. Preuve transparente de l'expertise YANN PRONOSTICS." },
      { property: "og:title", content: "Coupons Validés — YANN PRONOSTICS" },
      { property: "og:description", content: "Tous nos coupons gagnants validés, en libre accès." },
    ],
  }),
  component: ValidatedCouponsPage,
});

type ValidatedCoupon = {
  id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  media_type: "image" | "video";
  published_at: string;
  display_start: string | null;
  display_end: string | null;
};

function ValidatedCouponsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ValidatedCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<ValidatedCoupon | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("validated_coupons")
      .select("id, title, description, media_url, media_type, published_at, display_start, display_end")
      .order("published_at", { ascending: false });
    setItems((data as ValidatedCoupon[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`validated-coupons-public-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "validated_coupons" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="YANN PRONOSTICS" className="h-10 w-10 object-contain" />
            <span className="font-display text-lg tracking-wider text-gold hidden sm:block">YANN PRONOSTICS</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Link to="/">
              <Button size="sm" variant="outline" className="border-primary/40">
                <ArrowLeft className="w-4 h-4 mr-2" /> Accueil
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative py-16 sm:py-24 bg-luxury theme-fade overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-filigree pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <Badge className="bg-primary/10 text-primary border border-primary/30">
              <Trophy className="w-3.5 h-3.5 mr-1" /> {t("validated.badge", { defaultValue: "GAGNANT" })}
            </Badge>
            <h1 className="mt-4 font-serif text-4xl sm:text-5xl tracking-wide">
              <span className="text-gold">{t("validated.title", { defaultValue: "Coupons Validés" })}</span>
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              {t("validated.subtitle", { defaultValue: "L'historique de nos coupons gagnants." })}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl glass-card aspect-[4/5] skeleton-shimmer" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto opacity-30 mb-3" />
              <p>{t("validated.empty", { defaultValue: "Aucun coupon validé pour le moment." })}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((c, i) => (
                <ValidatedCard key={c.id} item={c} index={i} onOpen={() => setLightbox(c)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label="Fermer"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-6xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {lightbox.media_url && lightbox.media_type === "video" ? (
              <video src={lightbox.media_url} controls autoPlay className="max-h-[90vh] max-w-full rounded-lg" />
            ) : lightbox.media_url ? (
              <img src={lightbox.media_url} alt={lightbox.title} className="max-h-[90vh] max-w-full object-contain rounded-lg" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ValidatedCard({ item, index, onOpen }: { item: ValidatedCoupon; index: number; onOpen: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "fr-FR";
  return (
    <article
      className="group relative rounded-2xl overflow-hidden glass-card fade-in-up unlocked-border transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="absolute top-3 right-3 z-10">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 tracking-wider backdrop-blur">
          <CheckCircle2 className="w-3 h-3" /> {t("validated.badge", { defaultValue: "GAGNANT" })}
        </span>
      </div>
      <div className="bg-black/5 dark:bg-black/40 relative overflow-hidden gold-shimmer-overlay">
        {item.media_url ? (
          item.media_type === "video" ? (
            <video
              src={item.media_url}
              controls
              preload="metadata"
              className="w-full max-h-[600px] object-contain bg-black cursor-zoom-in"
              onClick={onOpen}
            />
          ) : (
            <button
              type="button"
              onClick={onOpen}
              aria-label={t("validated.expand", { defaultValue: "Agrandir l'image" })}
              className="block w-full cursor-zoom-in"
            >
              <img
                src={item.media_url}
                alt={item.title}
                loading="lazy"
                className="w-full h-auto max-h-[600px] object-contain"
              />
            </button>
          )
        ) : (
          <div className="aspect-video flex items-center justify-center text-muted-foreground">
            <Trophy className="w-12 h-12 opacity-30" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-serif not-italic font-bold text-xl leading-tight text-foreground">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{item.description}</p>
        )}
        <div className="pt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {t("validated.published_on", { defaultValue: "Publié le" })}{" "}
            {new Date(item.published_at).toLocaleDateString(locale, {
              day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Lagos",
            })}
          </span>
        </div>
      </div>
    </article>
  );
}
