import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/yann-logo.png";
import { LogOut, Shield, Trophy, Wallet, History, Crown, Lock, Play, Loader2, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
import { toast } from "sonner";

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
  const { user, isAdmin, signOut } = useAuth();
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Membre";

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [hasVip, setHasVip] = useState(false);
  const [vipExpires, setVipExpires] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = new Date().toISOString();
      const [{ data: cps }, { data: subs }] = await Promise.all([
        supabase.from("coupons").select("*").eq("status", "published")
          .or(`end_date.is.null,end_date.gte.${now}`).order("coupon_type"),
        supabase.from("subscriptions").select("status, expires_at")
          .eq("user_id", user.id).eq("status", "active"),
      ]);
      setCoupons((cps as Coupon[]) ?? []);
      const active = (subs ?? []).find((s: any) => !s.expires_at || new Date(s.expires_at) > new Date());
      setHasVip(!!active);
      setVipExpires(active?.expires_at ?? null);
    })();
  }, [user]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <span className="font-display tracking-wider text-gold hidden sm:block">YANN PRONOSTICS</span>
          </Link>
          <div className="flex items-center gap-2">
            {hasVip && (
              <Badge className="bg-gold-gradient text-primary-foreground border-0 shadow-gold">
                <Crown className="w-3 h-3 mr-1" /> VIP
              </Badge>
            )}
            {isAdmin && (
              <Badge className="bg-primary/15 text-primary border border-primary/30">
                <Shield className="w-3 h-3 mr-1" /> Admin
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Bienvenue</p>
            <h1 className="font-display text-4xl sm:text-5xl mt-1">Bonjour, <span className="text-gold">{name}</span></h1>
            <p className="mt-2 text-muted-foreground">{user?.email}</p>
            {hasVip && vipExpires && (
              <p className="mt-1 text-sm text-green-500 inline-flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Accès VIP actif jusqu'au {new Date(vipExpires).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline">
              <Link to="/subscriptions"><Crown className="w-4 h-4 mr-2" /> Mes abonnements</Link>
            </Button>
            {isAdmin && (
              <Button asChild className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
                <Link to="/admin"><Shield className="w-4 h-4 mr-2" /> Panneau administrateur</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Coupons du jour avec déblocage selon VIP/achat */}
        <section className="mt-10">
          <h2 className="font-display text-2xl mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-gold" /> Coupons du jour</h2>
          {coupons.length === 0 ? (
            <p className="text-muted-foreground">Aucun coupon publié pour le moment.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {coupons.map((c) => <UserCouponCard key={c.id} coupon={c} />)}
            </div>
          )}
        </section>

        <section className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Link to="/subscriptions" className="rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/40 transition">
            <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold">
              <Crown className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="mt-4 font-display text-xl">Mes abonnements</h3>
            <p className="mt-1 text-sm text-muted-foreground">État VIP, date d'expiration et transactions.</p>
          </Link>
          <Link to="/subscriptions" className="rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/40 transition">
            <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold">
              <History className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="mt-4 font-display text-xl">Historique d'achats</h3>
            <p className="mt-1 text-sm text-muted-foreground">Toutes vos transactions.</p>
          </Link>
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold">
              <Wallet className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="mt-4 font-display text-xl">Portefeuille</h3>
            <p className="mt-1 text-sm text-muted-foreground">Bientôt disponible.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function UserCouponCard({ coupon }: { coupon: Coupon }) {
  const getAccess = useServerFn(getCouponVideoAccess);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const onUnlock = async () => {
    setBusy(true);
    try {
      const res = await getAccess({ data: { couponId: coupon.id } });
      if (res.reason === "forbidden") {
        toast.error("Vidéo verrouillée — souscrivez un abonnement VIP ou achetez ce coupon.");
      } else if (res.reason === "no_video") {
        toast.info("Aucune vidéo n'est encore associée à ce coupon.");
      } else if (res.url) {
        setUrl(res.url);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'accès.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="p-5">
        <div className="font-display text-lg">{coupon.title}</div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-8">{coupon.description ?? "Pronostic premium analysé par nos experts."}</p>
        <div className="mt-4 rounded-xl border border-dashed border-primary/30 bg-background/40 aspect-video flex items-center justify-center">
          {url ? (
            <video src={url} controls className="w-full h-full rounded-xl bg-black" />
          ) : (
            <div className="text-center">
              <Lock className="w-7 h-7 text-primary/70 mx-auto" />
              <p className="mt-1 text-xs text-muted-foreground">Vidéo verrouillée</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="font-display text-lg text-gold">{coupon.price_xaf.toLocaleString()} XAF</span>
          <Button size="sm" onClick={onUnlock} disabled={busy || !!url} className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : url ? <><Play className="w-4 h-4 mr-1" />Lecture</> : <><Lock className="w-4 h-4 mr-1" />Débloquer</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
