import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  LayoutDashboard, Ticket, Receipt, MessageSquare, Settings as SettingsIcon,
  DollarSign, ShoppingCart, Package, ArrowUpRight, Menu, Wifi, WifiOff, EyeOff,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { setTestPayMode as setTestPayModeFn } from "@/lib/payments.functions";
import { listAdminUsers as listAdminUsersFn, setUserAdmin as setUserAdminFn, deleteAppUser as deleteAppUserFn } from "@/lib/admin-users.functions";
import { logAdminAction } from "@/lib/audit";

const ADMIN_VIEWS = ["stats", "coupons", "transactions", "reviews", "users", "audit", "settings"] as const;
type AdminViewKey = (typeof ADMIN_VIEWS)[number];

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (s: Record<string, unknown>): { tab: AdminViewKey } => {
    const t = typeof s.tab === "string" && (ADMIN_VIEWS as readonly string[]).includes(s.tab)
      ? (s.tab as AdminViewKey) : "stats";
    return { tab: t };
  },
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

type AdminView =
  | "stats" | "coupons" | "transactions" | "reviews"
  | "users" | "audit" | "settings";

const NAV_ITEMS: { id: AdminView; label: string; icon: any }[] = [
  { id: "stats", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "reviews", label: "Avis", icon: MessageSquare },
  { id: "users", label: "Utilisateurs", icon: Users },
  { id: "audit", label: "Journal", icon: History },
  { id: "settings", label: "Paramètres", icon: SettingsIcon },
];

function readSidebarCookie(): boolean {
  if (typeof document === "undefined") return true;
  const m = document.cookie.match(/(?:^|; )sidebar_state=([^;]+)/);
  return m ? m[1] === "true" : true;
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const view = tab as AdminView;
  const setView = (v: AdminView) => navigate({ to: "/admin", search: { tab: v as AdminViewKey }, replace: false });
  const [sidebarDefault] = useState<boolean>(() => readSidebarCookie());

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

  const current = NAV_ITEMS.find(n => n.id === view) ?? NAV_ITEMS[0];

  return (
    <SidebarProvider defaultOpen={sidebarDefault}>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar view={view} setView={setView} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 border-b border-border/50 bg-background/90 backdrop-blur flex items-center gap-3 px-3 sm:px-5">
            <SidebarTrigger className="-ml-1">
              <Menu className="w-5 h-5" />
            </SidebarTrigger>
            <h1 className="font-display tracking-wider text-base sm:text-lg uppercase truncate">
              {current.label}
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <RealtimeIndicator />
              <Badge className="bg-primary/15 text-primary border border-primary/30 hidden sm:inline-flex">
                <Shield className="w-3 h-3 mr-1" /> Admin
              </Badge>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
            {view === "stats" && <StatsAdmin />}
            {view === "coupons" && <CouponsAdmin />}
            {view === "transactions" && <TransactionsAdmin />}
            {view === "reviews" && <ReviewsAdmin />}
            {view === "users" && <UsersAdmin />}
            {view === "audit" && <AuditAdmin />}
            {view === "settings" && <SettingsAdmin />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function RealtimeIndicator() {
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime-indicator")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => setLastSync(new Date()))
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, () => setLastSync(new Date()))
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => setLastSync(new Date()))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => setLastSync(new Date()))
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") setLastSync(new Date());
      });
    const t = setInterval(() => setTick((x) => x + 1), 15000);
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, []);

  const ago = (() => {
    if (!lastSync) return "—";
    const s = Math.floor((Date.now() - lastSync.getTime()) / 1000);
    if (s < 5) return "à l'instant";
    if (s < 60) return `il y a ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `il y a ${m}min`;
    return lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <div
      title={connected ? `Temps réel actif — dernière maj ${ago}` : "Hors ligne"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${
        connected
          ? "border-green-600/40 bg-green-600/10 text-green-500"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-destructive"}`} />
      </span>
      {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span className="hidden sm:inline">{connected ? ago : "hors ligne"}</span>
    </div>
  );
}

function AdminSidebar({ view, setView }: { view: AdminView; setView: (v: AdminView) => void }) {
  const { signOut, user } = useAuth();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "Admin";
  const initials = name.slice(0, 2).toUpperCase();

  const select = (id: AdminView) => {
    setView(id);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/50">
        <div className="flex items-center gap-3 px-2 py-3">
          <img src={logo} alt="" className="h-9 w-9 object-contain shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display tracking-wider text-gold text-sm leading-none truncate">YANN PRONOSTICS</p>
              <p className="text-[11px] text-muted-foreground mt-1">Administration</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = view === item.id;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={active}
                      onClick={() => select(item.id)}
                      tooltip={item.label}
                      className={active
                        ? "bg-gold-gradient text-primary-foreground font-semibold shadow-gold hover:opacity-90 hover:text-primary-foreground data-[active=true]:bg-gold-gradient data-[active=true]:text-primary-foreground"
                        : ""}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50">
        <div className="px-2 py-2 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2">
              <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold border border-primary/30">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <p className="text-[11px] text-muted-foreground">Admin</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-1" />
                {!collapsed && "Accueil"}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Déconnexion">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
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
  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-coupons")
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; username: string | null }>>({});
  const [filter, setFilter] = useState<TxStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = async () => {
    let q = supabase.from("transactions").select("*").eq("kind", "coupon")
      .order("created_at", { ascending: false }).limit(1000);
    if (filter !== "all") q = q.eq("status", filter);
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    const txs = (data as Transaction[]) ?? [];
    setItems(txs);
    const ids = Array.from(new Set(txs.map(t => t.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
      const map: Record<string, { full_name: string | null; username: string | null }> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = { full_name: p.full_name, username: p.username }; });
      setProfiles(map);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-tx-${filter}-${dateFrom}-${dateTo}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [filter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [filter, search, dateFrom, dateTo]);

  const setStatus = async (id: string, status: TxStatus) => {
    const { error } = await supabase.from("transactions").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette transaction ?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimée");
  };

  const badge = (s: TxStatus) => ({
    pending: <Badge variant="secondary">En attente</Badge>,
    completed: <Badge className="bg-green-600/20 text-green-500 border border-green-600/30">Validée</Badge>,
    failed: <Badge variant="destructive">Échouée</Badge>,
    refunded: <Badge variant="outline">Remboursée</Badge>,
  }[s]);

  const userLabel = (t: Transaction) => {
    const p = profiles[t.user_id];
    return p?.full_name || p?.username || `${t.user_id.slice(0, 8)}…`;
  };

  const searched = items.filter(t => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (t.reference ?? "").toLowerCase().includes(s) ||
      t.user_id.toLowerCase().includes(s) ||
      userLabel(t).toLowerCase().includes(s) ||
      (t.payment_method ?? "").toLowerCase().includes(s) ||
      t.amount_xaf.toString().includes(s)
    );
  });

  const pageCount = Math.max(1, Math.ceil(searched.length / PAGE_SIZE));
  const pageItems = searched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = searched.filter(i => i.status === "completed").reduce((s, i) => s + i.amount_xaf, 0);

  const resetFilters = () => { setFilter("all"); setSearch(""); setDateFrom(""); setDateTo(""); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-display">Transactions ({searched.length})</h2>
          <p className="text-xs text-muted-foreground">Total validé : <span className="text-gold font-semibold">{total.toLocaleString("fr-FR")} XAF</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => exportTransactionsCSV(searched)} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button onClick={() => exportTransactionsPDF(searched)} variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-3 mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Rechercher (réf, utilisateur, montant…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:col-span-2"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as TxStatus | "all")}>
          <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="completed">Validées</SelectItem>
            <SelectItem value="failed">Échouées</SelectItem>
            <SelectItem value="refunded">Remboursées</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Du" />
        <div className="flex gap-2">
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Au" className="flex-1" />
          <Button variant="ghost" size="sm" onClick={resetFilters} title="Réinitialiser">
            <X className="w-4 h-4" />
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
            {pageItems.map(t => (
              <TableRow key={t.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(t.created_at).toLocaleString("fr-FR")}</TableCell>
                <TableCell className="text-xs">{userLabel(t)}</TableCell>
                <TableCell className="font-semibold text-gold whitespace-nowrap">{t.amount_xaf.toLocaleString("fr-FR")} XAF</TableCell>
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
            {pageItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune transaction</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-muted-foreground">Page {page} / {pageCount}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Précédent</Button>
            <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>Suivant</Button>
          </div>
        </div>
      )}
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
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`admin-reviews-${filter}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [filter]);

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
  const toggleTestPay = useServerFn(setTestPayModeFn);

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
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [couponsCount, setCouponsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [t, u, c, cAll] = await Promise.all([
      supabase.from("transactions").select("*").eq("kind", "coupon").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("coupons").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("coupons").select("*"),
    ]);
    setTxs((t.data as Transaction[]) ?? []);
    setCoupons((cAll.data as Coupon[]) ?? []);
    setUsersCount(u.count ?? 0);
    setCouponsCount(c.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const channel = supabase
      .channel("admin-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="text-muted-foreground">Chargement…</div>;

  const completed = txs.filter(t => t.status === "completed");
  const revenueTotal = completed.reduce((s, t) => s + t.amount_xaf, 0);
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const revenueMonth = completed.filter(t => new Date(t.created_at) >= startMonth).reduce((s, t) => s + t.amount_xaf, 0);
  const revenueDay = completed.filter(t => new Date(t.created_at) >= startDay).reduce((s, t) => s + t.amount_xaf, 0);

  const completedCount = completed.length;
  const pendingCount = txs.filter(t => t.status === "pending").length;
  const avgBasket = completedCount > 0 ? Math.round(revenueTotal / completedCount) : 0;
  const uniqueBuyers = new Set(completed.map(t => t.user_id)).size;
  const arpu = uniqueBuyers > 0 ? Math.round(revenueTotal / uniqueBuyers) : 0;
  const conversionRate = txs.length > 0 ? Math.round((completedCount / txs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-card border border-border/60 h-11 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="w-4 h-4 mr-1.5" /> Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <TrendingUp className="w-4 h-4 mr-1.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStatCard
              label="Chiffre d'affaires"
              value={`${revenueTotal.toLocaleString("fr-FR")} XAF`}
              Icon={DollarSign}
              tone="emerald"
            />
            <BigStatCard
              label="Transactions"
              value={txs.length.toString()}
              hint={pendingCount > 0 ? `${pendingCount} en attente` : undefined}
              Icon={ShoppingCart}
              tone="blue"
            />
            <BigStatCard
              label="Coupons publiés"
              value={couponsCount.toString()}
              Icon={Package}
              tone="violet"
            />
            <BigStatCard
              label="Clients"
              value={usersCount.toString()}
              Icon={Users}
              tone="amber"
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card">
            <div className="p-5 border-b border-border/40">
              <h3 className="font-display text-lg">Transactions récentes</h3>
            </div>
            <div className="divide-y divide-border/40">
              {txs.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs truncate">
                      {(t.reference ?? t.id).slice(0, 18)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-gold text-sm">{t.amount_xaf.toLocaleString("fr-FR")} XAF</p>
                    <p className="text-[11px]">
                      {t.status === "completed" && <span className="text-emerald-500">Validée</span>}
                      {t.status === "pending" && <span className="text-muted-foreground">En attente</span>}
                      {t.status === "failed" && <span className="text-destructive">Échouée</span>}
                      {t.status === "refunded" && <span className="text-muted-foreground">Remboursée</span>}
                    </p>
                  </div>
                </div>
              ))}
              {txs.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Aucune transaction</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-display text-base mb-3">Exporter l'historique</h3>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => exportTransactionsCSV(txs)} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" /> CSV
              </Button>
              <Button onClick={() => exportTransactionsPDF(txs)} size="sm" className="bg-gold-gradient text-primary-foreground">
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gold" />
              <h2 className="font-display text-lg">Analytics</h2>
            </div>
            <Badge variant="outline" className="border-border/60">Ce mois</Badge>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStatCard label="CA du mois" value={`${revenueMonth.toLocaleString("fr-FR")} XAF`} Icon={DollarSign} tone="emerald" />
            <BigStatCard label="CA du jour" value={`${revenueDay.toLocaleString("fr-FR")} XAF`} Icon={ArrowUpRight} tone="blue" />
            <BigStatCard label="Panier moyen" value={`${avgBasket.toLocaleString("fr-FR")} XAF`} Icon={TrendingUp} tone="violet" />
            <BigStatCard label="Ventes validées" value={completedCount.toString()} Icon={Check} tone="amber" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <BigStatCard label="ARPU (par acheteur)" value={`${arpu.toLocaleString("fr-FR")} XAF`} Icon={Users} tone="emerald" hint={`${uniqueBuyers} acheteur${uniqueBuyers > 1 ? "s" : ""}`} />
            <BigStatCard label="Taux de conversion" value={`${conversionRate}%`} Icon={TrendingUp} tone="blue" hint={`${completedCount}/${txs.length} tx`} />
            <BigStatCard label="En attente" value={pendingCount.toString()} Icon={ShoppingCart} tone="amber" />
            <BigStatCard label="Coupons actifs" value={couponsCount.toString()} Icon={Package} tone="violet" />
          </div>

          <StatsCharts txs={txs} coupons={coupons} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const TONE_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-500",
  blue: "bg-blue-500/15 text-blue-500",
  violet: "bg-violet-500/15 text-violet-500",
  amber: "bg-amber-500/15 text-amber-500",
};

function BigStatCard({
  label, value, hint, Icon, tone = "emerald",
}: {
  label: string; value: string; hint?: string;
  Icon: any; tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 flex items-center justify-between gap-3 hover:border-primary/40 transition">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl truncate">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${TONE_CLASSES[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}



const CHART_COLORS = ["hsl(var(--primary))", "#22c55e", "#ef4444", "#a855f7", "#3b82f6", "#f97316"];
const STATUS_LABEL: Record<string, string> = {
  completed: "Validé", pending: "En attente", failed: "Échoué", refunded: "Remboursé",
};

function StatsCharts({ txs, coupons }: { txs: Transaction[]; coupons: Coupon[] }) {
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

  // Top coupons by revenue (named via coupons list)
  const couponMap = new Map(coupons.map(c => [c.id, c]));
  const byCoupon = new Map<string, number>();
  const countCoupon = new Map<string, number>();
  txs.filter(t => t.status === "completed" && t.coupon_id).forEach(t => {
    byCoupon.set(t.coupon_id!, (byCoupon.get(t.coupon_id!) ?? 0) + t.amount_xaf);
    countCoupon.set(t.coupon_id!, (countCoupon.get(t.coupon_id!) ?? 0) + 1);
  });
  const topCoupons = Array.from(byCoupon.entries())
    .map(([id, v]) => ({
      name: (couponMap.get(id)?.title ?? `Coupon ${id.slice(0, 6)}`).slice(0, 22),
      revenue: v,
      ventes: countCoupon.get(id) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Hourly sales distribution (0-23h) — uses completed txs over all time
  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, "0")}h`,
    ventes: 0,
    revenue: 0,
  }));
  txs.filter(t => t.status === "completed").forEach(t => {
    const h = new Date(t.created_at).getHours();
    hours[h].ventes += 1;
    hours[h].revenue += t.amount_xaf;
  });

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
        <h3 className="font-display text-base mb-3">Top 5 coupons (revenus)</h3>
        <div className="h-64">
          {topCoupons.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCoupons} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number, n) => n === "revenue" ? `${v.toLocaleString()} XAF` : `${v} vente${v > 1 ? "s" : ""}`} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 lg:col-span-2">
        <h3 className="font-display text-base mb-3">Ventes par tranche horaire</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hours} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number, n) => n === "revenue" ? `${v.toLocaleString()} XAF` : v} />
              <Bar dataKey="ventes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
  const fetchUsers = useServerFn(listAdminUsersFn);
  const toggleAdmin = useServerFn(setUserAdminFn);
  const removeUser = useServerFn(deleteAppUserFn);

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
