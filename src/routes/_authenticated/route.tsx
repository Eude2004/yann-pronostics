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
  pendingComponent: ProtectedRouteScreen,
  errorComponent: ProtectedRouteScreen,
});

function ProtectedRouteScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center shadow-glow">
        <h1 className="text-2xl font-display">Vérification de session</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nous validons votre session avant d’ouvrir cette page protégée.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <a href="/auth">Retour à la connexion</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
