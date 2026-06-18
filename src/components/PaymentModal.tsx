import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, CheckCircle2, Play, AlertTriangle, RotateCw, CreditCard } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { initiatePayment, simulatePaymentCompletion } from "@/lib/payments.functions";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
import { EventCountdown } from "@/components/EventCountdown";
import { toast } from "sonner";

export function PaymentModal({
  open,
  onOpenChange,
  coupon,
  customer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coupon: { id: string; title: string; price_xaf: number; event_date?: string | null };
  customer?: { name?: string; email?: string };
}) {
  const initiate = useServerFn(initiatePayment);
  const simulate = useServerFn(simulatePaymentCompletion);
  const getVideo = useServerFn(getCouponVideoAccess);

  const [step, setStep] = useState<"form" | "processing" | "success" | "error">("form");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setVideoUrl(null);
      setErrorMsg(null);
    }
  }, [open]);

  const formattedPrice = `${coupon.price_xaf.toLocaleString("fr-FR")} FCFA`;

  const onPay = async () => {
    setStep("processing");
    setErrorMsg(null);
    try {
      const res = await initiate({
        data: {
          kind: "coupon",
          couponId: coupon.id,
          returnOrigin: window.location.origin,
          customer,
        },
      });

      if (res.mode === "test") {
        await simulate({ data: { transactionId: res.transactionId, outcome: "completed" } });
        try {
          const v = await getVideo({ data: { couponId: coupon.id } });
          setVideoUrl(v.url);
        } catch {}
        setStep("success");
        toast.success("Paiement confirmé ! Coupon débloqué.", { duration: Infinity });
      } else {
        // Live mode → redirection vers la page de checkout hébergée GeniusPay
        try {
          sessionStorage.setItem(
            "yp:pending-payment",
            JSON.stringify({ txId: res.transactionId, couponId: coupon.id, ts: Date.now() }),
          );
        } catch {}
        window.location.href = res.paymentUrl;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec du paiement.";
      setErrorMsg(msg);
      setStep("error");
      toast.error(msg);
    }
  };

  const onRetry = () => {
    setErrorMsg(null);
    setStep("form");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden border-primary/30 bg-card">
        {step === "success" ? (
          <div className="p-6">
            <DialogHeader>
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <DialogTitle className="text-center font-display text-2xl">Paiement réussi</DialogTitle>
              <DialogDescription className="text-center">
                Votre coupon « {coupon.title} » est débloqué.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-xl overflow-hidden border border-border bg-black aspect-video flex items-center justify-center">
              {videoUrl ? (
                <video src={videoUrl} controls autoPlay className="w-full h-full" />
              ) : (
                <div className="text-center text-muted-foreground text-sm p-4">
                  <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Aucune vidéo n'est encore associée à ce coupon. Vous y aurez accès dès qu'elle sera ajoutée.
                </div>
              )}
            </div>
            <Button className="w-full mt-4 bg-gold-gradient text-primary-foreground" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        ) : step === "error" ? (
          <div className="p-6">
            <DialogHeader>
              <div className="mx-auto w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center mb-2">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <DialogTitle className="text-center font-display text-2xl">Paiement échoué</DialogTitle>
              <DialogDescription className="text-center">
                {errorMsg ?? "Une erreur est survenue pendant l'initialisation du paiement."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground space-y-1">
              <p>• Vérifiez votre connexion internet.</p>
              <p>• Réessayez dans quelques instants.</p>
              <p>• Si le problème persiste, contactez le support.</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={onRetry}
                className="flex-1 bg-gold-gradient text-primary-foreground font-semibold shadow-gold"
              >
                <RotateCw className="w-4 h-4 mr-2" /> Réessayer
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="font-display text-xl">
                Acheter « {coupon.title} »
              </DialogTitle>
              <DialogDescription>
                Paiement sécurisé via GeniusPay. Choisissez votre moyen de paiement (Wave, Orange Money, MTN, Moov ou carte bancaire) sur la page suivante.
              </DialogDescription>
            </DialogHeader>

            {coupon.event_date && (
              <div className="px-6 pt-3">
                <EventCountdown eventDate={coupon.event_date} />
              </div>
            )}

            <div className="px-6 pt-4">
              <div className="rounded-xl border border-border bg-background/40 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-semibold">Wave · Orange · MTN · Moov · Carte</div>
                  <div className="text-xs text-muted-foreground">
                    Choix du moyen de paiement sur la page sécurisée GeniusPay.
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border mt-4 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Total à payer</div>
                <div className="font-display text-2xl text-gold">{formattedPrice}</div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <Button
                onClick={onPay}
                disabled={step === "processing"}
                className="w-full h-12 bg-gold-gradient text-primary-foreground font-bold shadow-gold text-base"
              >
                {step === "processing" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirection vers le paiement…
                  </>
                ) : (
                  <>Payer {formattedPrice}</>
                )}
              </Button>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-3 h-3" /> Paiement sécurisé GeniusPay · Accès immédiat après confirmation
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
