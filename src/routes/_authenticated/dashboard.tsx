import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/yann-logo.png";
import { LogOut, Shield, User as UserIcon, Trophy, Wallet, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Mon espace — YANN PRONOSTICS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, isAdmin, signOut } = useAuth();
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Membre";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <span className="font-display tracking-wider text-gold hidden sm:block">YANN PRONOSTICS</span>
          </Link>
          <div className="flex items-center gap-2">
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
          </div>
          {isAdmin && (
            <Button asChild className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
              <Link to="/admin">
                <Shield className="w-4 h-4 mr-2" /> Panneau administrateur
              </Link>
            </Button>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          <Card icon={Trophy} title="Mes coupons" desc="Vos coupons débloqués apparaîtront ici." />
          <Card icon={History} title="Historique d'achats" desc="Suivi complet de vos transactions." />
          <Card icon={Wallet} title="Mon portefeuille" desc="Cashback et bonus de parrainage." />
          <Card icon={UserIcon} title="Profil" desc="Nom, pseudo, WhatsApp et photo." />
        </div>
      </main>
    </div>
  );
}

function Card({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/40 transition">
      <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold">
        <Icon className="w-6 h-6 text-primary-foreground" />
      </div>
      <h3 className="mt-4 font-display text-xl">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
