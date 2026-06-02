import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSettings, whatsappLink } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import logo from "@/assets/yann-logo.png";
import { ArrowLeft, Crown, MessageCircle, ShieldCheck, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  head: () => ({ meta: [{ title: "Mes abonnements — YANN PRONOSTICS" }] }),
  component: SubscriptionsPage,
});

type SubStatus = "active" | "inactive" | "expired" | "cancelled";
type TxStatus = "pending" | "completed" | "failed" | "refunded";
type TxKind = "coupon" | "subscription";

type Sub = {
  id: string; plan_id: string | null; status: SubStatus;
  started_at: string | null; expires_at: string | null; notes: string | null;
};
type Plan = { id: string; name: string; price_xaf: number; duration_days: number };
type Tx = {
  id: string; kind: TxKind; amount_xaf: number; status: TxStatus;
  reference: string | null; payment_method: string | null;
  subscription_id: string | null; coupon_id: string | null; created_at: string;
};

function SubscriptionsPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [s, p, t] = await Promise.all([
        supabase.from("subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("subscription_plans").select("id, name, price_xaf, duration_days"),
        supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setSubs((s.data as Sub[]) ?? []);
      setPlans((p.data as Plan[]) ?? []);
      setTxs((t.data as Tx[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? "—";
  const activeSub = useMemo(
    () => subs.find((s) => s.status === "active" && (!s.expires_at || new Date(s.expires_at) > new Date())),
    [subs],
  );

  const statusBadge = (s: SubStatus) => ({
    active: <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Actif</Badge>,
    inactive: <Badge variant="secondary">Inactif</Badge>,
    expired: <Badge variant="outline">Expiré</Badge>,
    cancelled: <Badge variant="destructive">Annulé</Badge>,
  }[s]);

  const txBadge = (s: TxStatus) => ({
    pending: <Badge variant="secondary">En attente</Badge>,
    completed: <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Validée</Badge>,
    failed: <Badge variant="destructive">Échouée</Badge>,
    refunded: <Badge variant="outline">Remboursée</Badge>,
  }[s]);

  const daysLeft = activeSub?.expires_at
    ? Math.max(0, Math.ceil((new Date(activeSub.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <div>
              <p className="font-display tracking-wider text-gold leading-none">YANN PRONOSTICS</p>
              <p className="text-xs text-muted-foreground">Mes abonnements VIP</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Statut actuel */}
        <section>
          <h1 className="font-display text-3xl sm:text-4xl">Statut <span className="text-gold">VIP</span></h1>
          {loading ? (
            <p className="mt-4 text-muted-foreground">Chargement…</p>
          ) : activeSub ? (
            <div className="mt-5 rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-background p-6 shadow-glow">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-gold" />
                    <span className="font-display text-2xl">{planName(activeSub.plan_id)}</span>
                    {statusBadge(activeSub.status)}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground inline-flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    Accès illimité aux 4 coupons quotidiens.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Expire le {activeSub.expires_at ? new Date(activeSub.expires_at).toLocaleDateString("fr-FR") : "—"}
                    {daysLeft !== null && <span className="text-gold">· {daysLeft} jour{daysLeft > 1 ? "s" : ""} restant{daysLeft > 1 ? "s" : ""}</span>}
                  </p>
                </div>
                <Link to="/dashboard">
                  <Button className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
                    Voir mes coupons
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-border/60 bg-card p-6 text-center">
              <XCircle className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-display text-xl">Aucun abonnement VIP actif</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Activez un plan VIP pour débloquer automatiquement toutes les vidéos.
              </p>
              <a
                href={whatsappLink(
                  settings.whatsapp_number,
                  `Bonjour YANN PRONOSTICS, je souhaite souscrire à un abonnement VIP.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-4"
              >
                <Button className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
                  <MessageCircle className="w-4 h-4 mr-2" /> Souscrire via WhatsApp
                </Button>
              </a>
            </div>
          )}
        </section>

        {/* Historique abonnements */}
        <section>
          <h2 className="font-display text-2xl mb-4">Historique des abonnements</h2>
          <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{planName(s.plan_id)}</TableCell>
                    <TableCell className="text-xs">{s.started_at ? new Date(s.started_at).toLocaleDateString("fr-FR") : "—"}</TableCell>
                    <TableCell className="text-xs">{s.expires_at ? new Date(s.expires_at).toLocaleDateString("fr-FR") : "—"}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                  </TableRow>
                ))}
                {subs.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun abonnement</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Historique transactions */}
        <section>
          <h2 className="font-display text-2xl mb-4">Historique des transactions</h2>
          <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell>{t.kind === "coupon" ? "Coupon" : "Abonnement VIP"}</TableCell>
                    <TableCell className="font-semibold text-gold">{t.amount_xaf.toLocaleString()} XAF</TableCell>
                    <TableCell className="text-xs">{t.payment_method ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{t.reference ?? t.id.slice(0, 8)}</TableCell>
                    <TableCell>{txBadge(t.status)}</TableCell>
                  </TableRow>
                ))}
                {txs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune transaction</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </div>
  );
}
