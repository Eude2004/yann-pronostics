import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/yann-logo.png";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Réinitialiser le mot de passe" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      z.string().min(8, "Au moins 8 caractères").max(72).parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe mis à jour.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 space-y-5">
        <div className="text-center">
          <img src={logo} alt="" className="h-16 w-16 mx-auto object-contain" />
          <h1 className="font-display text-2xl mt-4">Nouveau mot de passe</h1>
        </div>
        <div className="space-y-2">
          <Label>Mot de passe</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
        </div>
        <Button type="submit" disabled={busy} className="w-full bg-gold-gradient text-primary-foreground font-bold h-11 shadow-gold">
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Mettre à jour
        </Button>
      </form>
    </div>
  );
}
