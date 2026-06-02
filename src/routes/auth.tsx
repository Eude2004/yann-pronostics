import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import logo from "@/assets/yann-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Mail, Lock, User as UserIcon, Phone } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: s.tab === "signup" ? "signup" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Connexion — YANN PRONOSTICS" },
      { name: "description", content: "Accédez à votre compte YANN PRONOSTICS." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Adresse email invalide").max(255);
const passwordSchema = z.string().min(8, "Au moins 8 caractères").max(72);
const nameSchema = z.string().trim().min(2, "Nom trop court").max(80);
const whatsappSchema = z.string().trim().regex(/^[0-9+\s]{8,20}$/, "Numéro WhatsApp invalide");

function AuthPage() {
  const { session, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
    }
  }, [session, loading, isAdmin, navigate]);


  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>
      <div className="w-full max-w-md">
        <Link to="/" className="flex flex-col items-center mb-8 gap-3">
          <img src={logo} alt="YANN PRONOSTICS" className="h-20 w-20 object-contain" />
          <span className="font-display tracking-wider text-gold text-xl">YANN PRONOSTICS</span>
        </Link>

        <div className="rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-glow">
          <Tabs defaultValue={search.tab}>
            <TabsList className="w-full grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm /></TabsContent>
            <TabsContent value="signup"><SignupForm /></TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <GoogleButton />

          <p className="mt-6 text-xs text-center text-muted-foreground">
            En continuant, vous acceptez nos conditions d'utilisation.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        toast.error("Veuillez vérifier votre email avant de vous connecter.");
      } else if (error.message.toLowerCase().includes("invalid")) {
        toast.error("Email ou mot de passe incorrect.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Bienvenue !");
  };

  const onForgot = async () => {
    try { emailSchema.parse(email); } catch { return toast.error("Saisissez d'abord votre email."); }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Email de réinitialisation envoyé.");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="vous@email.com" autoComplete="email" />
      <Field icon={Lock} label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
          <span className="text-muted-foreground">Se souvenir de moi</span>
        </label>
        <button type="button" onClick={onForgot} className="text-primary hover:underline">Oublié ?</button>
      </div>
      <Button type="submit" disabled={busy} className="w-full bg-gold-gradient text-primary-foreground hover:opacity-90 font-bold shadow-gold h-11">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Se connecter
      </Button>
    </form>
  );
}

function SignupForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      nameSchema.parse(fullName);
      emailSchema.parse(email);
      whatsappSchema.parse(whatsapp);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas.");

    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, whatsapp: whatsapp.trim() },
      },
    });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("already")) toast.error("Un compte existe déjà avec cet email.");
      else toast.error(error.message);
      return;
    }
    toast.success("Compte créé ! Connexion automatique en cours…");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field icon={UserIcon} label="Nom complet" value={fullName} onChange={setFullName} placeholder="Jean Dupont" autoComplete="name" />
      <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="vous@email.com" autoComplete="email" />
      <Field icon={Phone} label="Numéro WhatsApp" type="tel" value={whatsapp} onChange={setWhatsapp} placeholder="237 6XX XX XX XX" autoComplete="tel" />
      <Field icon={Lock} label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="Min. 8 caractères" autoComplete="new-password" />
      <Field icon={Lock} label="Confirmer le mot de passe" type="password" value={confirm} onChange={setConfirm} placeholder="Retapez votre mot de passe" autoComplete="new-password" />
      <Button type="submit" disabled={busy} className="w-full bg-gold-gradient text-primary-foreground hover:opacity-90 font-bold shadow-gold h-11">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Créer mon compte
      </Button>
      <p className="text-xs text-muted-foreground text-center">Inscription instantanée — aucune confirmation email requise.</p>
    </form>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const onGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Échec de la connexion Google.");
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" onClick={onGoogle} disabled={busy} className="w-full h-11 border-border hover:bg-secondary">
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GoogleIcon />}
      Continuer avec Google
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function Field({ icon: Icon, label, type = "text", value, onChange, placeholder, autoComplete }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pl-10 h-11"
          required
        />
      </div>
    </div>
  );
}
