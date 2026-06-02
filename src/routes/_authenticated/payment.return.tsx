import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { CheckCircle2, Clock, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getTransactionStatus, simulatePaymentCompletion } from "@/lib/payments.functions";

const searchSchema = z.object({
  tx: z.string().uuid(),
});

export const Route = createFileRoute("/_authenticated/payment/return")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Paiement — YANN PRONOSTICS" }] }),
  component: PaymentReturn,
});

function PaymentReturn() {
  const { tx } = useSearch({ from: "/_authenticated/payment/return" });
  const fetchStatus = useServerFn(getTransactionStatus);
  const simulate = useServerFn(simulatePaymentCompletion);
  const [simulating, setSimulating] = useState(false);

  const query = useQuery({
    queryKey: ["transaction-status", tx],
    queryFn: () => fetchStatus({ data: { transactionId: tx } }),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "pending" ? 3000 : false;
    },
  });

  const status = query.data?.status;
  const isMock = !!query.data?.reference?.startsWith("MOCK-");

  const runSimulation = async (outcome: "completed" | "failed") => {
    setSimulating(true);
    try {
      await simulate({ data: { transactionId: tx, outcome } });
      await query.refetch();
      toast.success(outcome === "completed" ? "Paiement simulé : succès" : "Paiement simulé : échec");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-8 shadow-glow">
        <div className="text-center">
          {query.isLoading && <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />}
          {status === "completed" && <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />}
          {status === "pending" && <Clock className="w-14 h-14 mx-auto text-primary animate-pulse" />}
          {(status === "failed" || status === "refunded") && <XCircle className="w-14 h-14 mx-auto text-destructive" />}

          <h1 className="mt-6 font-display text-3xl">
            {status === "completed" && "Paiement validé"}
            {status === "pending" && "Paiement en attente"}
            {status === "failed" && "Paiement refusé"}
            {!status && "Vérification…"}
          </h1>

          {query.data && (
            <div className="mt-4 space-y-1 text-sm text-muted-foreground">
              <div>
                Référence :{" "}
                <span className="font-mono text-foreground">{query.data.reference ?? "—"}</span>
              </div>
              <div>
                Montant :{" "}
                <span className="text-foreground">
                  {query.data.amount_xaf.toLocaleString("fr-FR")} XAF
                </span>
              </div>
              <div>
                Type :{" "}
                <span className="text-foreground">
                  {query.data.kind === "coupon" ? "Coupon" : "Abonnement VIP"}
                </span>
              </div>
              {isMock && (
                <Badge variant="outline" className="mt-2 border-primary/40 text-primary">
                  Mode test (CinetPay non configuré)
                </Badge>
              )}
            </div>
          )}

          {isMock && status === "pending" && (
            <div className="mt-6 rounded-xl border border-dashed border-primary/40 p-4 text-left text-sm">
              <p className="text-muted-foreground mb-3">
                Aucune passerelle de paiement n'est encore branchée. Vous pouvez
                simuler le résultat pour tester le déblocage du contenu.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-gold-gradient text-primary-foreground"
                  disabled={simulating}
                  onClick={() => runSimulation("completed")}
                >
                  Simuler paiement réussi
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={simulating}
                  onClick={() => runSimulation("failed")}
                >
                  Simuler échec
                </Button>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
            {status === "completed" ? (
              <Link to="/dashboard">
                <Button className="bg-gold-gradient text-primary-foreground font-semibold shadow-gold">
                  Voir mon contenu <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/">
                <Button variant="outline">Retour à l'accueil</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
