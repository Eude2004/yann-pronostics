import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Save, Download, FileText, TrendingUp, FlaskConical, Users, History,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { setTestPayMode } from "@/lib/payments.functions";
import { listAdminUsers, setUserAdmin, deleteAppUser } from "@/lib/admin-users.functions";
import { logAdminAction } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — YANN PRONOSTICS" }] }),
  component: AdminPage,
});

type PublishStatus = "draft" | "published" | "archived";
type ReviewStatus = "pending" | "approved" | "rejected";
type CouponType = "cote_10" | "cote_30" | "cote_50" | "pair_corner";
type TxStatus = "pending" | "completed" | "failed" | "refunded";

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
type Transaction = {
  id: string; user_id: string; amount_xaf: number;
  status: TxStatus; reference: string | null; payment_method: string | null;
  coupon_id: string | null; created_at: string; notes: string | null;
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
        <Button asChild><Link to="/">Retour à l'accueil</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
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
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="stats">Tableau de bord</TabsTrigger>
            <TabsTrigger value="coupons">Coupons du jour</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="reviews">Avis</TabsTrigger>
            <TabsTrigger value="users"><Users className="w-3.5 h-3.5 mr-1" />Utilisateurs</TabsTrigger>
            <TabsTrigger value="audit"><History className="w-3.5 h-3.5 mr-1" />Journal</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>
          <TabsContent value="stats" className="mt-6"><StatsAdmin /></TabsContent>
          <TabsContent value="coupons" className="mt-6"><CouponsAdmin /></TabsContent>
          <TabsContent value="transactions" className="mt-6"><TransactionsAdmin /></TabsContent>
          <TabsContent value="reviews" className="mt-6"><ReviewsAdmin /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersAdmin /></TabsContent>
          <TabsContent value="audit" className="mt-6"><AuditAdmin /></TabsContent>
          <TabsContent value="settings" className="mt-6"><SettingsAdmin /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- COUPONS ---------------- */

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
  const [uploading, setUploading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const uploadVideo = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `coupons/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("coupon-videos")
        .upload(path, file, { contentType: file.type || "video/*", upsert: false });
      if (error) throw error;
      setForm((f) => ({ ...f, video_url: path }));
      toast.success("Vidéo téléversée");
    } catch (e: any) {
      toast.error(e.message ?? "Échec du téléversement");
    } finally {
      setUploading(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `coupons/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("coupon-images")
        .upload(path, file, { contentType: file.type || "image/*", upsert: false });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("coupon-images")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr) throw signErr;
      setForm((f) => ({ ...f, image_url: signed.signedUrl }));
      toast.success("Image téléversée");
    } catch (e: any) {
      toast.error(e.message ?? "Échec du téléversement");
    } finally {
      setUploadingImage(false);
    }
  };


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
    const basePayload = {
      coupon_type: form.coupon_type,
      title: meta.label,
      price_xaf: meta.price,
      description: form.description || null,
      image_url: form.image_url || null,
      video_url: form.video_url || null,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      status: form.status,
      is_featured: form.is_featured,
    };
    const slug = form.coupon_type + "-" + Date.now();
    const insertPayload = { ...basePayload, slug };
    const { data: saved, error } = editing
      ? await supabase.from("coupons").update(basePayload).eq("id", editing.id).select("id").maybeSingle()
      : await supabase.from("coupons").insert(insertPayload).select("id").maybeSingle();
    if (error) return toast.error(error.message);
    await logAdminAction(
      editing ? "update_coupon" : "create_coupon",
      "coupon",
      saved?.id ?? editing?.id,
      { title: basePayload.title, status: basePayload.status },
    );
    toast.success(editing ? "Coupon mis à jour" : "Coupon créé");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce coupon ?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction("delete_coupon", "coupon", id);
    toast.success("Coupon supprimé"); load();
  };

  const setStatus = async (id: string, status: PublishStatus) => {
    const { error } = await supabase.from("coupons").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction("update_coupon_status", "coupon", id, { status });
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
            <div className="space-y-2">
              <Label>Image du coupon <span className="text-xs text-muted-foreground font-normal">(optionnel)</span></Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploadingImage}
                  onClick={() => document.getElementById("img-pick")?.click()}>
                  📁 Galerie / Fichier
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={uploadingImage}
                  onClick={() => document.getElementById("img-cam")?.click()}>
                  📷 Prendre une photo
                </Button>
                {form.image_url && (
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setForm({ ...form, image_url: "" })}>
                    <X className="w-4 h-4 mr-1" />Retirer
                  </Button>
                )}
              </div>
              <input id="img-pick" type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif,.tiff,.svg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              <input id="img-cam" type="file" accept="image/*" capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              <Input value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="ou collez une URL d'image" />
              {uploadingImage && <p className="text-xs text-muted-foreground">Téléversement en cours…</p>}
              {form.image_url && !uploadingImage && (
                <img src={form.image_url} alt="" className="h-24 rounded border border-border/60 object-cover" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Vidéo du coupon (débloquée après achat)</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading}
                  onClick={() => document.getElementById("video-pick")?.click()}>
                  📁 Galerie / Fichier
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={uploading}
                  onClick={() => document.getElementById("video-cam")?.click()}>
                  🎥 Filmer
                </Button>
                {form.video_url && (
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setForm({ ...form, video_url: "" })}>
                    <X className="w-4 h-4 mr-1" />Retirer
                  </Button>
                )}
              </div>
              <input id="video-pick" type="file" accept="video/*,.mkv,.mov,.avi,.webm,.mp4,.m4v,.3gp,.flv,.wmv,.ts"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])} />
              <input id="video-cam" type="file" accept="video/*" capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])} />
              <Input value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="ou collez une URL / chemin de stockage" />
              {uploading && <p className="text-xs text-muted-foreground">Téléversement en cours…</p>}
              {form.video_url && !uploading && (
                <p className="text-xs text-green-500 truncate">✓ {form.video_url}</p>
              )}
            </div>
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

/* ---------------- TRANSACTIONS ---------------- */

function TransactionsAdmin() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<TxStatus | "all">("all");

  const load = async () => {
    let q = supabase.from("transactions").select("*").eq("kind", "coupon")
      .order("created_at", { ascending: false }).limit(200);
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
        <div className="flex gap-2 flex-wrap">
          <Select value={filter} onValueChange={(v) => setFilter(v as TxStatus | "all")}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="completed">Validées</SelectItem>
              <SelectItem value="failed">Échouées</SelectItem>
              <SelectItem value="refunded">Remboursées</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportTransactionsCSV(items)} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button onClick={() => exportTransactionsPDF(items)} variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Utilisateur</TableHead>
            <TableHead>Montant</TableHead><TableHead>Méthode</TableHead>
            <TableHead>Réf.</TableHead><TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.map(t => (
              <TableRow key={t.id}>
                <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("fr-FR")}</TableCell>
                <TableCell className="font-mono text-xs">{t.user_id.slice(0, 8)}…</TableCell>
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
            {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune transaction</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
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
    await logAdminAction("moderate_review", "review", id, { status });
    toast.success("Avis modéré"); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer cet avis ?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction("delete_review", "review", id);
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
        <Select value={filter} onValueChange={(v) => setFilter(v as ReviewStatus | "all")}>
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
  const [testPay, setTestPay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toggleTestPay = useServerFn(setTestPayMode);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*");
      const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      setWhatsapp(map.whatsapp_number ?? "654010951");
      setSiteName(map.site_name ?? "YANN PRONOSTICS");
      setTestPay(map.test_pay_mode === "true");
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
    await logAdminAction("update_settings", "settings", null, { whatsapp: whatsapp.trim(), site_name: siteName.trim() });
    toast.success("Paramètres enregistrés");
  };

  const onToggleTestPay = async (enabled: boolean) => {
    const prev = testPay;
    setTestPay(enabled);
    try {
      await toggleTestPay({ data: { enabled } });
      await logAdminAction("toggle_test_pay", "settings", null, { enabled });
      toast.success(enabled ? "Mode Test Pay activé" : "Mode Test Pay désactivé");
    } catch (e) {
      setTestPay(prev);
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  if (loading) return <div className="text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-display mb-4">Paramètres de la plateforme</h2>
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
          <div>
            <Label>Numéro WhatsApp principal</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="654010951" />
            <p className="text-xs text-muted-foreground mt-1">
              Utilisé partout : bouton flottant, contact, footer.
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

      <div>
        <h2 className="text-xl font-display mb-4 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-primary" /> Mode Test Pay
        </h2>
        <div className="rounded-xl border border-primary/40 bg-card p-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">Simulation d'achat pour l'administrateur</p>
              <p className="text-xs text-muted-foreground mt-1">
                Activé, l'admin peut acheter et débloquer un coupon en simulation,
                sans appel à CinetPay. Désactivez avant la production.
              </p>
            </div>
            <Switch checked={testPay} onCheckedChange={onToggleTestPay} />
          </div>
          {testPay && (
            <Badge className="bg-primary/15 text-primary border border-primary/30">
              <FlaskConical className="w-3 h-3 mr-1" /> Mode Test Pay actif
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- TABLEAU DE BORD ---------------- */

function StatsAdmin() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [couponsCount, setCouponsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [t, u, c] = await Promise.all([
      supabase.from("transactions").select("*").eq("kind", "coupon").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("coupons").select("id", { count: "exact", head: true }).eq("status", "published"),
    ]);
    setTxs((t.data as Transaction[]) ?? []);
    setUsersCount(u.count ?? 0);
    setCouponsCount(c.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // Realtime: refresh on any transaction/profile/coupon change
    const channel = supabase
      .channel("admin-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <div className="text-muted-foreground">Chargement…</div>;

  const completed = txs.filter(t => t.status === "completed");
  const revenueTotal = completed.reduce((s, t) => s + t.amount_xaf, 0);
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const revenueMonth = completed.filter(t => new Date(t.created_at) >= startMonth).reduce((s, t) => s + t.amount_xaf, 0);
  const revenueDay = completed.filter(t => new Date(t.created_at) >= startDay).reduce((s, t) => s + t.amount_xaf, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display flex items-center gap-2"><TrendingUp className="w-5 h-5 text-gold" /> Tableau de bord</h2>
        <p className="text-xs text-muted-foreground">Vue d'ensemble revenus et activité.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenus du jour" value={`${revenueDay.toLocaleString()} XAF`} accent />
        <StatCard label="Revenus du mois" value={`${revenueMonth.toLocaleString()} XAF`} accent />
        <StatCard label="Revenus totaux" value={`${revenueTotal.toLocaleString()} XAF`} />
        <StatCard label="Ventes validées" value={completed.length.toString()} />
        <StatCard label="Utilisateurs inscrits" value={usersCount.toString()} />
        <StatCard label="Coupons publiés" value={couponsCount.toString()} />
        <StatCard label="Transactions totales" value={txs.length.toString()} />
        <StatCard label="Panier moyen" value={`${completed.length > 0 ? Math.round(revenueTotal / completed.length).toLocaleString() : 0} XAF`} />
      </div>

      <StatsCharts txs={txs} />



      <div>
        <h3 className="font-display text-lg mb-3">Export historique transactions</h3>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => exportTransactionsCSV(txs)} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Exporter CSV
          </Button>
          <Button onClick={() => exportTransactionsPDF(txs)} className="bg-gold-gradient text-primary-foreground">
            <FileText className="w-4 h-4 mr-2" /> Exporter PDF
          </Button>
        </div>
      </div>
    </div>
  );
}


const CHART_COLORS = ["hsl(var(--primary))", "#22c55e", "#ef4444", "#a855f7", "#3b82f6", "#f97316"];
const STATUS_LABEL: Record<string, string> = {
  completed: "Validé", pending: "En attente", failed: "Échoué", refunded: "Remboursé",
};
const COUPON_TYPE_LABEL: Record<string, string> = {
  cote_10: "Cote 10+", cote_30: "Cote 30+", cote_50: "Cote 50+", pair_corner: "Pair Corner",
};

function StatsCharts({ txs }: { txs: Transaction[] }) {
  // Revenue per day (last 14 days)
  const days: { day: string; revenue: number; ventes: number }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const dayTx = txs.filter(t => t.status === "completed" &&
      new Date(t.created_at) >= d && new Date(t.created_at) < next);
    days.push({
      day: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      revenue: dayTx.reduce((s, t) => s + t.amount_xaf, 0),
      ventes: dayTx.length,
    });
  }

  // Status distribution
  const byStatus = ["completed", "pending", "failed", "refunded"].map(s => ({
    name: STATUS_LABEL[s] ?? s,
    value: txs.filter(t => t.status === s).length,
  })).filter(s => s.value > 0);

  // Revenue by coupon (need coupon types) — we only have coupon_id in tx, so aggregate by coupon_id
  const byCoupon = new Map<string, number>();
  txs.filter(t => t.status === "completed" && t.coupon_id).forEach(t => {
    byCoupon.set(t.coupon_id!, (byCoupon.get(t.coupon_id!) ?? 0) + t.amount_xaf);
  });
  const couponBars = Array.from(byCoupon.entries()).map(([id, v], i) => ({
    name: `Coupon ${i + 1}`, _id: id, revenue: v,
  }));

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="font-display text-base mb-3">Revenus — 14 derniers jours</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gold-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v.toLocaleString()} XAF`} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#gold-area)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="font-display text-base mb-3">Ventes par jour</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="ventes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="font-display text-base mb-3">Répartition des transactions</h3>
        <div className="h-64">
          {byStatus.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {byStatus.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="font-display text-base mb-3">Revenus par coupon</h3>
        <div className="h-64">
          {couponBars.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={couponBars} layout="vertical" margin={{ top: 5, right: 10, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v.toLocaleString()} XAF`} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {

  return (
    <div className={`rounded-xl border bg-card p-4 ${accent ? "border-primary/40 shadow-glow" : "border-border/60"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl ${accent ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}

function exportTransactionsCSV(txs: Transaction[]) {
  const headers = ["Date", "ID", "Utilisateur", "Montant XAF", "Méthode", "Référence", "Statut"];
  const rows = txs.map(t => [
    new Date(t.created_at).toLocaleString("fr-FR"),
    t.id, t.user_id, t.amount_xaf.toString(),
    t.payment_method ?? "", t.reference ?? "", t.status,
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `transactions-${new Date().toISOString().slice(0, 10)}.csv`);
  toast.success("Export CSV téléchargé");
}

function exportTransactionsPDF(txs: Transaction[]) {
  const total = txs.filter(t => t.status === "completed").reduce((s, t) => s + t.amount_xaf, 0);
  const rows = txs.map(t => `
    <tr>
      <td>${new Date(t.created_at).toLocaleString("fr-FR")}</td>
      <td>${t.user_id.slice(0, 8)}…</td>
      <td style="text-align:right">${t.amount_xaf.toLocaleString()} XAF</td>
      <td>${t.payment_method ?? "—"}</td>
      <td>${t.reference ?? "—"}</td>
      <td>${t.status}</td>
    </tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Transactions YANN PRONOSTICS</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;padding:24px}
      h1{color:#b8893a;margin:0 0 4px}
      .meta{color:#666;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f4f4f4}
      .total{margin-top:16px;font-weight:bold;color:#b8893a}
    </style></head><body>
    <h1>YANN PRONOSTICS — Historique des transactions</h1>
    <div class="meta">Exporté le ${new Date().toLocaleString("fr-FR")} · ${txs.length} transactions</div>
    <table>
      <thead><tr><th>Date</th><th>Utilisateur</th><th>Montant</th><th>Méthode</th><th>Référence</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Total validé : ${total.toLocaleString()} XAF</div>
    <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return toast.error("Veuillez autoriser les pop-ups pour l'export PDF.");
  w.document.write(html);
  w.document.close();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- UTILISATEURS ---------------- */

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  profile: { id: string; full_name: string | null; username: string | null; whatsapp: string | null } | null;
};

function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const fetchUsers = useServerFn(listAdminUsers);
  const toggleAdmin = useServerFn(setUserAdmin);
  const removeUser = useServerFn(deleteAppUser);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchUsers();
      setUsers(res.users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du chargement");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const onToggleAdmin = async (u: AdminUser) => {
    const make = !u.roles.includes("admin");
    if (!make && !confirm(`Retirer le rôle admin à ${u.email} ?`)) return;
    try {
      await toggleAdmin({ data: { user_id: u.id, make_admin: make } });
      toast.success(make ? "Promu administrateur" : "Rôle admin retiré");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  const onDelete = async (u: AdminUser) => {
    if (!confirm(`Supprimer définitivement ${u.email} ? Cette action est irréversible.`)) return;
    try {
      await removeUser({ data: { user_id: u.id } });
      toast.success("Utilisateur supprimé");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    }
  };

  const filtered = users.filter(u =>
    !q || u.email.toLowerCase().includes(q.toLowerCase()) ||
    (u.profile?.username ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (u.profile?.full_name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-display">Utilisateurs ({users.length})</h2>
        <Input
          placeholder="Rechercher email, nom…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      {loading ? (
        <div className="text-muted-foreground">Chargement…</div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-xs">{u.email}</TableCell>
                  <TableCell className="text-xs">{u.profile?.full_name ?? u.profile?.username ?? "—"}</TableCell>
                  <TableCell className="text-xs">{u.profile?.whatsapp ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR") : "Jamais"}</TableCell>
                  <TableCell>
                    {u.roles.includes("admin") ? (
                      <Badge className="bg-primary/15 text-primary border border-primary/30">
                        <Shield className="w-3 h-3 mr-1" />Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Utilisateur</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => onToggleAdmin(u)} className="mr-1">
                      {u.roles.includes("admin") ? "Retirer admin" : "Promouvoir"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(u)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun utilisateur</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ---------------- JOURNAL D'AUDIT ---------------- */

type AuditEntry = {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  create_coupon: "Création de coupon",
  update_coupon: "Modification de coupon",
  delete_coupon: "Suppression de coupon",
  update_coupon_status: "Changement de statut coupon",
  moderate_review: "Modération d'avis",
  delete_review: "Suppression d'avis",
  update_settings: "Modification des paramètres",
  toggle_test_pay: "Bascule Mode Test Pay",
  promote_admin: "Promotion admin",
  demote_admin: "Rétrogradation admin",
  delete_user: "Suppression d'utilisateur",
};

function AuditAdmin() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error(error.message);
    else setItems((data as AuditEntry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-audit")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_audit_log" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="text-muted-foreground">Chargement…</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-display flex items-center gap-2"><History className="w-5 h-5 text-gold" /> Journal des actions ({items.length})</h2>
          <p className="text-xs text-muted-foreground">Toutes les actions administrateur en temps réel.</p>
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Détails</TableHead>
              <TableHead>Auteur</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(e.created_at).toLocaleString("fr-FR")}</TableCell>
                <TableCell className="text-xs font-medium">{ACTION_LABELS[e.action] ?? e.action}</TableCell>
                <TableCell className="text-xs">
                  <span className="text-muted-foreground">{e.entity_type}</span>
                  {e.entity_id && <span className="font-mono ml-1">{e.entity_id.slice(0, 8)}…</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                  {e.details && Object.keys(e.details).length > 0 ? JSON.stringify(e.details) : "—"}
                </TableCell>
                <TableCell className="text-xs font-mono">{e.actor_id.slice(0, 8)}…</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune action enregistrée</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
