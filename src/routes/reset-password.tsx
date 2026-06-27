import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/yann-logo.png";
import { Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Réinitialiser le mot de passe" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Supabase met les erreurs/tokens dans le hash après clic sur l'email.
  // - access_token + type=recovery → session de récupération établie.
  // - error / error_description → lien expiré, déjà utilisé, ou invalide.
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const err = params.get("error_description") || params.get("error");
    if (err) {
      const msg = /expired|invalid|otp/i.test(err)
        ? "Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demandez-en un nouveau."
        : decodeURIComponent(err);
      setLinkError(msg);
      return;
    }
    // Vérifie qu'une session de récupération est bien active.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setLinkError("Lien invalide. Demandez un nouvel email de réinitialisation.");
    });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      z.string().min(8, "Au moins 8 caractères").max(72).parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      if (/expired|invalid|session|jwt/i.test(error.message)) {
        setLinkError("Votre session de réinitialisation a expiré. Demandez un nouvel email.");
        return;
      }
      return toast.error(error.message);
    }
    try { await supabase.auth.signOut(); } catch {}
    setBusy(false);
    toast.success("Mot de passe mis à jour. Reconnectez-vous avec le nouveau mot de passe.");
    navigate({ to: "/auth", search: { tab: "login" } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 space-y-5">
        <div className="text-center">
          <img src={logo} alt="" className="h-16 w-16 mx-auto object-contain" />
          <h1 className="font-display text-2xl mt-4">Nouveau mot de passe</h1>
        </div>

        {linkError ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{linkError}</span>
            </div>
            <Button
              type="button"
              onClick={() => navigate({ to: "/auth", search: { tab: "login" } })}
              className="w-full bg-gold-gradient text-primary-foreground font-bold h-11 shadow-gold"
            >
              Retour à la connexion
            </Button>
          </div>
        ) : !ready ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Validation du lien…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label>Confirmer</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="h-11" autoComplete="new-password" />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-gold-gradient text-primary-foreground font-bold h-11 shadow-gold">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Mettre à jour
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
