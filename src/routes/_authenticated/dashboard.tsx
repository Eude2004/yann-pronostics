import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/yann-logo.png";
import { LogOut, Shield, Trophy, Lock, Play, Loader2 } from "lucide-react";
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
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Membre";

  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // Redirection automatique des admins vers le panneau
  useEffect(() => {
    if (!loading && isAdmin) {
      navigate({ to: "/admin", replace: true });
    }
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (!user || isAdmin) return;
    (async () => {
      const now = new Date().toISOString();
      const { data: cps } = await supabase.from("coupons").select("*").eq("status", "published")
        .or(`end_date.is.null,end_date.gte.${now}`).order("coupon_type");
      setCoupons((cps as Coupon[]) ?? []);
    })();
  }, [user, isAdmin]);

  if (loading || isAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;
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
          </div>
        </div>

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
        toast.error("Coupon verrouillé — achetez-le pour le débloquer.");
      } else if (res.reason === "no_video") {
        toast.info("Aucune vidéo n'est encore associée à ce coupon.");
      } else if (res.url) {
        setUrl(res.url);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'accès.");
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
