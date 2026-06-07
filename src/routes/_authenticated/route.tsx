import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
  // Pas de pendingComponent : la vérification se fait en arrière-plan,
  // sans écran intermédiaire lors des rafraîchissements ou navigations.
  errorComponent: SessionErrorScreen,
});

function SessionErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center shadow-glow">
        <h1 className="text-2xl font-display">Session expirée</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre session n’a pas pu être vérifiée. Veuillez vous reconnecter
          à votre compte pour continuer.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <a href="/auth">Se reconnecter</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
