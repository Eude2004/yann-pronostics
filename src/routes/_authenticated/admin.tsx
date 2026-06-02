import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import logo from "@/assets/yann-logo.png";
import {
  ArrowLeft, Plus, Pencil, Trash2, Check, X, Star, Shield, LogOut,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — YANN PRONOSTICS" }] }),
  component: AdminPage,
});

type PublishStatus = "draft" | "published" | "archived";
type ReviewStatus = "pending" | "approved" | "rejected";

type Category = {
  id: string; name: string; slug: string; description: string | null;
  icon: string | null; sort_order: number;
};
type Coupon = {
  id: string; title: string; slug: string; description: string | null;
  sport: string | null; category_id: string | null; price_xaf: number;
  odds: number | null; event_date: string | null; image_url: string | null;
  preview_content: string | null; private_content: string;
  status: PublishStatus; is_featured: boolean;
};
type Review = {
  id: string; user_id: string; coupon_id: string | null;
  rating: number; comment: string; status: ReviewStatus; created_at: string;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
          <TabsList>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="categories">Catégories</TabsTrigger>
            <TabsTrigger value="reviews">Avis clients</TabsTrigger>
          </TabsList>
          <TabsContent value="coupons" className="mt-6"><CouponsAdmin /></TabsContent>
          <TabsContent value="categories" className="mt-6"><CategoriesAdmin /></TabsContent>
          <TabsContent value="reviews" className="mt-6"><ReviewsAdmin /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- CATEGORIES ---------------- */

function CategoriesAdmin() {
  const [items, setItems] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", icon: "", sort_order: 0 });

  const load = async () => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order");
    if (error) toast.error(error.message); else setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", slug: "", description: "", icon: "", sort_order: 0 });
    setOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({
      name: c.name, slug: c.slug, description: c.description ?? "",
      icon: c.icon ?? "", sort_order: c.sort_order,
    });
    setOpen(true);
  };
  const save = async () => {
    const payload = {
      name: form.name.trim(),
      slug: (form.slug || slugify(form.name)).trim(),
      description: form.description || null,
      icon: form.icon || null,
      sort_order: Number(form.sort_order) || 0,
    };
    if (!payload.name) return toast.error("Nom requis");
    const { error } = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Catégorie mise à jour" : "Catégorie créée");
    setOpen(false); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Catégorie supprimée"); load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-display">Catégories ({items.length})</h2>
        <Button onClick={openNew} className="bg-gold-gradient text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Nouvelle</Button>
      </div>
      <div className="rounded-xl border border-border/60 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead><TableHead>Slug</TableHead>
              <TableHead>Ordre</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.icon} {c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                <TableCell>{c.sort_order}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune catégorie</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvelle"} catégorie</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug (optionnel)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-généré" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Icône (emoji)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="⚽" /></div>
              <div><Label>Ordre</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
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

/* ---------------- COUPONS ---------------- */

const emptyCoupon = {
  title: "", slug: "", description: "", sport: "", category_id: "",
  price_xaf: 0, odds: "", event_date: "", image_url: "",
  preview_content: "", private_content: "",
  status: "draft" as PublishStatus, is_featured: false,
};

function CouponsAdmin() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState({ ...emptyCoupon });

  const load = async () => {
    const [{ data: c }, { data: cats }] = await Promise.all([
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setItems((c as Coupon[]) ?? []);
    setCategories((cats as Category[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyCoupon }); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      title: c.title, slug: c.slug, description: c.description ?? "",
      sport: c.sport ?? "", category_id: c.category_id ?? "",
      price_xaf: c.price_xaf, odds: c.odds?.toString() ?? "",
      event_date: c.event_date ? c.event_date.slice(0, 16) : "",
      image_url: c.image_url ?? "", preview_content: c.preview_content ?? "",
      private_content: c.private_content, status: c.status, is_featured: c.is_featured,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Titre requis");
    const payload = {
      title: form.title.trim(),
      slug: (form.slug || slugify(form.title)).trim(),
      description: form.description || null,
      sport: form.sport || null,
      category_id: form.category_id || null,
      price_xaf: Number(form.price_xaf) || 0,
      odds: form.odds ? Number(form.odds) : null,
      event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
      image_url: form.image_url || null,
      preview_content: form.preview_content || null,
      private_content: form.private_content,
      status: form.status,
      is_featured: form.is_featured,
    };
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

  const statusBadge = (s: PublishStatus) => ({
    draft: <Badge variant="secondary">Brouillon</Badge>,
    published: <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Publié</Badge>,
    archived: <Badge variant="outline">Archivé</Badge>,
  }[s]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-display">Coupons ({items.length})</h2>
        <Button onClick={openNew} className="bg-gold-gradient text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Nouveau coupon</Button>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead><TableHead>Sport</TableHead>
              <TableHead>Prix</TableHead><TableHead>Cote</TableHead>
              <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.is_featured && "⭐ "}{c.title}</TableCell>
                <TableCell>{c.sport}</TableCell>
                <TableCell>{c.price_xaf.toLocaleString()} XAF</TableCell>
                <TableCell>{c.odds ?? "—"}</TableCell>
                <TableCell>{statusBadge(c.status)}</TableCell>
                <TableCell className="text-right">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} coupon</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Slug (optionnel)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-généré" /></div>
            <div><Label>Description publique</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Catégorie</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sport</Label><Input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} placeholder="Football" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Prix (XAF)</Label><Input type="number" value={form.price_xaf} onChange={(e) => setForm({ ...form, price_xaf: Number(e.target.value) })} /></div>
              <div><Label>Cote</Label><Input type="number" step="0.01" value={form.odds} onChange={(e) => setForm({ ...form, odds: e.target.value })} /></div>
              <div><Label>Date événement</Label><Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
            </div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            <div><Label>Aperçu public</Label><Textarea value={form.preview_content} onChange={(e) => setForm({ ...form, preview_content: e.target.value })} placeholder="Texte visible avant achat" /></div>
            <div><Label>Contenu privé (après achat)</Label><Textarea rows={4} value={form.private_content} onChange={(e) => setForm({ ...form, private_content: e.target.value })} /></div>
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
                <div className="flex items-center gap-2 mb-2">
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
              <div className="flex gap-1">
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
