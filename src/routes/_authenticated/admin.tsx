import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import logo from "@/assets/yann-logo.png";
import {
  ArrowLeft, Plus, Pencil, Trash2, Check, X, Star, Shield, LogOut,
  Crown, Power, Save,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — YANN PRONOSTICS" }] }),
  component: AdminPage,
});

type PublishStatus = "draft" | "published" | "archived";
type ReviewStatus = "pending" | "approved" | "rejected";
type CouponType = "cote_10" | "cote_30" | "cote_50" | "pair_corner";
type SubStatus = "active" | "inactive" | "expired" | "cancelled";
type TxStatus = "pending" | "completed" | "failed" | "refunded";
type TxKind = "coupon" | "subscription";

const COUPON_TYPES: { value: CouponType; label: string; price: number }[] = [
  { value: "cote_10", label: "Cote de 10+", price: 4000 },
  { value: "cote_30", label: "Cote de 30+", price: 5000 },
  { value: "cote_50", label: "Cote de 50+", price: 7000 },
  { value: "pair_corner", label: "Coupon Total Pair Corner", price: 6000 },
];

type Coupon = {
  id: string; coupon_type: CouponType | null; title: string;
  description: string | null; price_xaf: number; image_url: string | null;
  video_url: string | null; start_date: string | null; end_date: string | null;
  status: PublishStatus; sales_count: number; is_featured: boolean;
};
type Plan = {
  id: string; name: string; description: string | null; price_xaf: number;
  duration_days: number; is_active: boolean; sort_order: number;
};
type Subscription = {
  id: string; user_id: string; plan_id: string | null; status: SubStatus;
  started_at: string | null; expires_at: string | null; notes: string | null;
  created_at: string;
};
type Transaction = {
  id: string; user_id: string; kind: TxKind; amount_xaf: number;
  status: TxStatus; reference: string | null; payment_method: string | null;
  coupon_id: string | null; subscription_id: string | null; created_at: string;
};
type Review = {
  id: string; user_id: string; coupon_id: string | null;
  rating: number; comment: string; status: ReviewStatus; created_at: string;
};

function AdminPage() {
  const { isAdmin, loading, signOut } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <Shield className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-2xl font-display">Accès refusé</h1>
        <p className="text-muted-foreground text-center">Cette zone est réservée aux administrateurs.</p>
        <Button asChild><Link to="/dashboard">Retour au tableau de bord</Link></Button>
      </div>
    );
  }

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
              <p className="text-xs text-muted-foreground">Panneau administrateur</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary border border-primary/30">
              <Shield className="w-3 h-3 mr-1" /> Admin
            </Badge>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Tabs defaultValue="coupons" className="w-full">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="coupons">Coupons du jour</TabsTrigger>
            <TabsTrigger value="plans">Plans VIP</TabsTrigger>
            <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="reviews">Avis</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>
          <TabsContent value="coupons" className="mt-6"><CouponsAdmin /></TabsContent>
          <TabsContent value="plans" className="mt-6"><PlansAdmin /></TabsContent>
          <TabsContent value="subscriptions" className="mt-6"><SubscriptionsAdmin /></TabsContent>
          <TabsContent value="transactions" className="mt-6"><TransactionsAdmin /></TabsContent>
          <TabsContent value="reviews" className="mt-6"><ReviewsAdmin /></TabsContent>
          <TabsContent value="settings" className="mt-6"><SettingsAdmin /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- COUPONS (4 types fixes) ---------------- */

const emptyCouponForm = {
  coupon_type: "cote_10" as CouponType,
  description: "", image_url: "", video_url: "",
  start_date: "", end_date: "",
  status: "draft" as PublishStatus, is_featured: false,
};

function CouponsAdmin() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState({ ...emptyCouponForm });

  const load = async () => {
    const { data, error } = await supabase.from("coupons").select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setItems((data as Coupon[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyCouponForm }); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      coupon_type: (c.coupon_type ?? "cote_10") as CouponType,
      description: c.description ?? "",
      image_url: c.image_url ?? "",
      video_url: c.video_url ?? "",
      start_date: c.start_date ? c.start_date.slice(0, 16) : "",
      end_date: c.end_date ? c.end_date.slice(0, 16) : "",
      status: c.status, is_featured: c.is_featured,
    });
    setOpen(true);
  };

  const save = async () => {
    const meta = COUPON_TYPES.find(t => t.value === form.coupon_type)!;
    const payload: any = {
      coupon_type: form.coupon_type,
      // title & price_xaf seront imposés par le trigger DB selon coupon_type
      title: meta.label,
      price_xaf: meta.price,
      slug: `${form.coupon_type}-${Date.now()}`,
      description: form.description || null,
      image_url: form.image_url || null,
      video_url: form.video_url || null,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      status: form.status,
      is_featured: form.is_featured,
    };
    if (editing) delete payload.slug;
    const { error } = editing
      ? await supabase.from("coupons").update(payload).eq("id", editing.id)
      : await supabase.from("coupons").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Coupon mis à jour" : "Coupon créé");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce coupon ?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Coupon supprimé"); load();
  };

  const setStatus = async (id: string, status: PublishStatus) => {
    const { error } = await supabase.from("coupons").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour"); load();
  };

  const badge = (s: PublishStatus) => ({
    draft: <Badge variant="secondary">Brouillon</Badge>,
    published: <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Publié</Badge>,
    archived: <Badge variant="outline">Archivé</Badge>,
  }[s]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-display">Coupons ({items.length})</h2>
          <p className="text-xs text-muted-foreground">4 types fixes — titre et prix imposés automatiquement.</p>
        </div>
        <Button onClick={openNew} className="bg-gold-gradient text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />Nouveau coupon
        </Button>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead><TableHead>Prix</TableHead>
              <TableHead>Période</TableHead><TableHead>Statut</TableHead>
              <TableHead>Ventes</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.is_featured && "⭐ "}{c.title}</TableCell>
                <TableCell>{c.price_xaf.toLocaleString()} XAF</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.start_date ? new Date(c.start_date).toLocaleDateString("fr-FR") : "—"}
                  {" → "}
                  {c.end_date ? new Date(c.end_date).toLocaleDateString("fr-FR") : "—"}
                </TableCell>
                <TableCell>{badge(c.status)}</TableCell>
                <TableCell>{c.sales_count}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Select value={c.status} onValueChange={(v) => setStatus(c.id, v as PublishStatus)}>
                    <SelectTrigger className="w-32 inline-flex h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="published">Publié</SelectItem>
                      <SelectItem value="archived">Archivé</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun coupon</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} coupon du jour</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type de coupon (titre et prix imposés)</Label>
              <Select value={form.coupon_type} onValueChange={(v) => setForm({ ...form, coupon_type: v as CouponType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUPON_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — {t.price.toLocaleString()} XAF
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Texte affiché sur la carte du coupon" /></div>
            <div><Label>Image (URL)</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" /></div>
            <div><Label>Vidéo (URL, débloquée après achat)</Label><Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date de début</Label><Input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Date de fin</Label><Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as PublishStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="published">Publié</SelectItem>
                    <SelectItem value="archived">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-end gap-2 pb-2">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
                <span className="text-sm">Mettre en avant ⭐</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} className="bg-gold-gradient text-primary-foreground">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- PLANS VIP ---------------- */

function PlansAdmin() {
  const [items, setItems] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price_xaf: 0, duration_days: 30, is_active: true, sort_order: 0 });

  const load = async () => {
    const { data, error } = await supabase.from("subscription_plans").select("*").order("sort_order");
    if (error) toast.error(error.message); else setItems((data as Plan[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", description: "", price_xaf: 0, duration_days: 30, is_active: true, sort_order: 0 }); setOpen(true); };
  const openEdit = (p: Plan) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", price_xaf: p.price_xaf, duration_days: p.duration_days, is_active: p.is_active, sort_order: p.sort_order });
    setOpen(true);
  };
  const save = async () => {
    if (!form.name.trim()) return toast.error("Nom requis");
    const payload = { ...form, description: form.description || null };
    const { error } = editing
      ? await supabase.from("subscription_plans").update(payload).eq("id", editing.id)
      : await supabase.from("subscription_plans").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Plan enregistré"); setOpen(false); load();
  };
  const toggle = async (p: Plan) => {
    const { error } = await supabase.from("subscription_plans").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer ce plan ?")) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé"); load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-display flex items-center gap-2"><Crown className="w-5 h-5 text-gold" /> Plans VIP ({items.length})</h2>
        <Button onClick={openNew} className="bg-gold-gradient text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Nouveau plan</Button>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nom</TableHead><TableHead>Prix</TableHead>
            <TableHead>Durée</TableHead><TableHead>Actif</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.price_xaf.toLocaleString()} XAF</TableCell>
                <TableCell>{p.duration_days} jours</TableCell>
                <TableCell>
                  {p.is_active
                    ? <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Actif</Badge>
                    : <Badge variant="secondary">Inactif</Badge>}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => toggle(p)}><Power className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun plan</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} plan VIP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Prix (XAF)</Label><Input type="number" value={form.price_xaf} onChange={(e) => setForm({ ...form, price_xaf: Number(e.target.value) })} /></div>
              <div><Label>Durée (jours)</Label><Input type="number" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })} /></div>
              <div><Label>Ordre</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span className="text-sm">Plan actif (visible aux clients)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} className="bg-gold-gradient text-primary-foreground">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- ABONNEMENTS VIP ---------------- */

function SubscriptionsAdmin() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filter, setFilter] = useState<SubStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", plan_id: "", notes: "" });

  const load = async () => {
    let q = supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const [{ data: subs }, { data: pls }] = await Promise.all([
      q, supabase.from("subscription_plans").select("*").order("sort_order"),
    ]);
    setItems((subs as Subscription[]) ?? []);
    setPlans((pls as Plan[]) ?? []);
  };
  useEffect(() => { load(); }, [filter]);

  const toggle = async (s: Subscription) => {
    const newStatus: SubStatus = s.status === "active" ? "inactive" : "active";
    const update: any = { status: newStatus };
    if (newStatus === "active") {
      const plan = plans.find(p => p.id === s.plan_id);
      const days = plan?.duration_days ?? 30;
      update.started_at = new Date().toISOString();
      update.expires_at = new Date(Date.now() + days * 86400000).toISOString();
    }
    const { error } = await supabase.from("subscriptions").update(update).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(newStatus === "active" ? "Abonnement activé" : "Abonnement désactivé"); load();
  };

  const create = async () => {
    if (!form.user_id.trim()) return toast.error("ID utilisateur requis");
    if (!form.plan_id) return toast.error("Plan requis");
    const plan = plans.find(p => p.id === form.plan_id)!;
    const { error } = await supabase.from("subscriptions").insert({
      user_id: form.user_id.trim(), plan_id: form.plan_id, status: "active",
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + plan.duration_days * 86400000).toISOString(),
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Abonnement créé"); setOpen(false); setForm({ user_id: "", plan_id: "", notes: "" }); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cet abonnement ?")) return;
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé"); load();
  };

  const planName = (id: string | null) => plans.find(p => p.id === id)?.name ?? "—";

  const badge = (s: SubStatus) => ({
    active: <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Actif</Badge>,
    inactive: <Badge variant="secondary">Inactif</Badge>,
    expired: <Badge variant="outline">Expiré</Badge>,
    cancelled: <Badge variant="destructive">Annulé</Badge>,
  }[s]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-display">Abonnements VIP ({items.length})</h2>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="inactive">Inactifs</SelectItem>
              <SelectItem value="expired">Expirés</SelectItem>
              <SelectItem value="cancelled">Annulés</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)} className="bg-gold-gradient text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Nouveau</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Utilisateur</TableHead><TableHead>Plan</TableHead>
            <TableHead>Période</TableHead><TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.user_id.slice(0, 12)}…</TableCell>
                <TableCell>{planName(s.plan_id)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.started_at ? new Date(s.started_at).toLocaleDateString("fr-FR") : "—"}
                  {" → "}
                  {s.expires_at ? new Date(s.expires_at).toLocaleDateString("fr-FR") : "—"}
                </TableCell>
                <TableCell>{badge(s.status)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant={s.status === "active" ? "outline" : "default"} onClick={() => toggle(s)} className={s.status === "active" ? "" : "bg-gold-gradient text-primary-foreground"}>
                    <Power className="w-4 h-4 mr-1" /> {s.status === "active" ? "Désactiver" : "Activer"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun abonnement</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activer un abonnement VIP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ID utilisateur (UUID)</Label><Input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder="00000000-0000-…" /></div>
            <div>
              <Label>Plan</Label>
              <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir un plan" /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.price_xaf.toLocaleString()} XAF / {p.duration_days}j</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Référence paiement, remarques…" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={create} className="bg-gold-gradient text-primary-foreground">Activer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- TRANSACTIONS ---------------- */

function TransactionsAdmin() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<TxStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", kind: "coupon" as TxKind, amount_xaf: 0, status: "completed" as TxStatus, reference: "", payment_method: "MTN Money" });

  const load = async () => {
    let q = supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setItems((data as Transaction[]) ?? []);
  };
  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id: string, status: TxStatus) => {
    const { error } = await supabase.from("transactions").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour"); load();
  };

  const create = async () => {
    if (!form.user_id.trim()) return toast.error("ID utilisateur requis");
    const { error } = await supabase.from("transactions").insert({
      user_id: form.user_id.trim(), kind: form.kind,
      amount_xaf: Number(form.amount_xaf), status: form.status,
      reference: form.reference || null, payment_method: form.payment_method || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Transaction créée"); setOpen(false);
    setForm({ user_id: "", kind: "coupon", amount_xaf: 0, status: "completed", reference: "", payment_method: "MTN Money" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette transaction ?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimée"); load();
  };

  const badge = (s: TxStatus) => ({
    pending: <Badge variant="secondary">En attente</Badge>,
    completed: <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Validée</Badge>,
    failed: <Badge variant="destructive">Échouée</Badge>,
    refunded: <Badge variant="outline">Remboursée</Badge>,
  }[s]);

  const total = items.filter(i => i.status === "completed").reduce((s, i) => s + i.amount_xaf, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-display">Transactions ({items.length})</h2>
          <p className="text-xs text-muted-foreground">Total validé : <span className="text-gold font-semibold">{total.toLocaleString()} XAF</span></p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="completed">Validées</SelectItem>
              <SelectItem value="failed">Échouées</SelectItem>
              <SelectItem value="refunded">Remboursées</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)} className="bg-gold-gradient text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Manuelle</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Utilisateur</TableHead>
            <TableHead>Type</TableHead><TableHead>Montant</TableHead>
            <TableHead>Méthode</TableHead><TableHead>Réf.</TableHead>
            <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map(t => (
              <TableRow key={t.id}>
                <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("fr-FR")}</TableCell>
                <TableCell className="font-mono text-xs">{t.user_id.slice(0, 8)}…</TableCell>
                <TableCell>{t.kind === "coupon" ? "Coupon" : "Abonnement"}</TableCell>
                <TableCell className="font-semibold text-gold">{t.amount_xaf.toLocaleString()} XAF</TableCell>
                <TableCell className="text-xs">{t.payment_method ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono">{t.reference ?? "—"}</TableCell>
                <TableCell>{badge(t.status)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Select value={t.status} onValueChange={(v) => setStatus(t.id, v as TxStatus)}>
                    <SelectTrigger className="w-32 inline-flex h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="completed">Validée</SelectItem>
                      <SelectItem value="failed">Échouée</SelectItem>
                      <SelectItem value="refunded">Remboursée</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucune transaction</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Saisie manuelle d'une transaction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ID utilisateur</Label><Input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as TxKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coupon">Coupon</SelectItem>
                    <SelectItem value="subscription">Abonnement VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Montant (XAF)</Label><Input type="number" value={form.amount_xaf} onChange={(e) => setForm({ ...form, amount_xaf: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Méthode</Label><Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="MTN, Orange, Campay…" /></div>
              <div><Label>Référence</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TxStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="completed">Validée</SelectItem>
                  <SelectItem value="failed">Échouée</SelectItem>
                  <SelectItem value="refunded">Remboursée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={create} className="bg-gold-gradient text-primary-foreground">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- REVIEWS ---------------- */

function ReviewsAdmin() {
  const [items, setItems] = useState<Review[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");

  const load = async () => {
    let q = supabase.from("reviews").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setItems((data as Review[]) ?? []);
  };
  useEffect(() => { load(); }, [filter]);

  const moderate = async (id: string, status: ReviewStatus) => {
    const { error } = await supabase.from("reviews").update({
      status, moderated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Avis modéré"); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer cet avis ?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé"); load();
  };

  const badge = (s: ReviewStatus) => ({
    pending: <Badge variant="secondary">En attente</Badge>,
    approved: <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Approuvé</Badge>,
    rejected: <Badge variant="destructive">Rejeté</Badge>,
  }[s]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-display">Avis ({items.length})</h2>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Approuvés</SelectItem>
            <SelectItem value="rejected">Rejetés</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        {items.map((r) => (
          <div key={r.id} className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.rating ? "fill-gold text-gold" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  {badge(r.status)}
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</span>
                </div>
                <p className="text-sm">{r.comment}</p>
                <p className="text-xs text-muted-foreground mt-2">Auteur : {r.user_id.slice(0, 8)}…</p>
              </div>
              <div className="flex gap-1 flex-wrap">
                {r.status !== "approved" && (
                  <Button size="sm" variant="outline" onClick={() => moderate(r.id, "approved")}>
                    <Check className="w-4 h-4 mr-1 text-green-500" />Approuver
                  </Button>
                )}
                {r.status !== "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => moderate(r.id, "rejected")}>
                    <X className="w-4 h-4 mr-1 text-destructive" />Rejeter
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-12 border border-dashed border-border/60 rounded-xl">
            Aucun avis
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- PARAMÈTRES ---------------- */

function SettingsAdmin() {
  const [whatsapp, setWhatsapp] = useState("");
  const [siteName, setSiteName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*");
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
      setWhatsapp(map.whatsapp_number ?? "654010951");
      setSiteName(map.site_name ?? "YANN PRONOSTICS");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = [
      { key: "whatsapp_number", value: whatsapp.trim(), updated_at: new Date().toISOString() },
      { key: "site_name", value: siteName.trim(), updated_at: new Date().toISOString() },
    ];
    const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Paramètres enregistrés");
  };

  if (loading) return <div className="text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-display mb-4">Paramètres de la plateforme</h2>
      <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
        <div>
          <Label>Numéro WhatsApp principal</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="654010951" />
          <p className="text-xs text-muted-foreground mt-1">
            Utilisé partout : bouton flottant, contact, footer, redirections d'achat.
          </p>
        </div>
        <div>
          <Label>Nom du site</Label>
          <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving} className="bg-gold-gradient text-primary-foreground">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
