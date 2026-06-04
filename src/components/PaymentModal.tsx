import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Smartphone, CheckCircle2, Play, AlertTriangle, RotateCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { initiatePayment, simulatePaymentCompletion } from "@/lib/payments.functions";
import { getCouponVideoAccess } from "@/lib/coupon-access.functions";
import { EventCountdown } from "@/components/EventCountdown";
import { toast } from "sonner";


type Method = "mtn" | "orange" | "moov";

const METHODS: { id: Method; name: string; sub: string; color: string; letter: string }[] = [
  { id: "mtn", name: "MTN Money", sub: "Numéros 67 / 65", color: "bg-yellow-400 text-black", letter: "M" },
  { id: "orange", name: "Orange Money", sub: "Numéros 69 / 65", color: "bg-orange-500 text-white", letter: "O" },
  { id: "moov", name: "Moov Money", sub: "Numéros 65", color: "bg-blue-500 text-white", letter: "M" },
];

export function PaymentModal({
  open,
  onOpenChange,
  coupon,
  customer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coupon: { id: string; title: string; price_xaf: number };
  customer?: { name?: string; email?: string };
}) {
  const initiate = useServerFn(initiatePayment);
  const simulate = useServerFn(simulatePaymentCompletion);
  const getVideo = useServerFn(getCouponVideoAccess);

  const [method, setMethod] = useState<Method>("mtn");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"form" | "processing" | "success" | "error">("form");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setVideoUrl(null);
      setErrorMsg(null);
      // Conserver phone/method si l'utilisateur réessaye après échec
    }
  }, [open]);

  const formattedPrice = `${coupon.price_xaf.toLocaleString("fr-FR")} FCFA`;

  const onPay = async () => {
    if (!/^\+?\d{7,15}$/.test(phone.replace(/\s/g, ""))) {
      toast.error("Numéro mobile money invalide.");
      return;
    }
    setStep("processing");
    setErrorMsg(null);
    try {
      const res = await initiate({
        data: {
          kind: "coupon",
          couponId: coupon.id,
          returnOrigin: window.location.origin,
          customer: { ...customer, phone },
        },
      });

      if (res.mode === "test") {
        // Simulate immediate confirmation
        await simulate({ data: { transactionId: res.transactionId, outcome: "completed" } });
        try {
          const v = await getVideo({ data: { couponId: coupon.id } });
          setVideoUrl(v.url);
        } catch {}
        setStep("success");
        toast.success("Paiement confirmé ! Coupon débloqué.", { duration: Infinity });
        // Le modal reste ouvert : l'utilisateur le ferme manuellement.
      } else {
        // Live mode → mémoriser la transaction pour réouvrir l'état au retour
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
              <p>• Confirmez que votre numéro mobile money est correct et a un solde suffisant.</p>
              <p>• Vos informations sont conservées : un seul clic suffit pour réessayer.</p>
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
              <DialogTitle className="font-display tracking-wide uppercase text-sm text-muted-foreground">
                Méthode de paiement
              </DialogTitle>
              <DialogDescription className="sr-only">
                Choisissez un mode de paiement mobile money pour acheter le coupon {coupon.title}.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-4 space-y-2">
              {METHODS.map((m) => {
                const selected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    disabled={step === "processing"}
                    className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/5 shadow-gold"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${m.color}`}>
                      {m.letter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.sub}</div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 ${
                        selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="px-6 pb-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Numéro mobile money
              </Label>
              <div className="mt-1 relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  inputMode="tel"
                  placeholder="+225 07 00 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={step === "processing"}
                  className="pl-9"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Un code de confirmation sera envoyé sur ce numéro.
              </p>
            </div>

            <div className="border-t border-border px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Total à payer</div>
                <div className="font-display text-2xl text-gold">{formattedPrice}</div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <Button
                onClick={onPay}
                disabled={step === "processing" || !phone}
                className="w-full h-12 bg-gold-gradient text-primary-foreground font-bold shadow-gold text-base"
              >
                {step === "processing" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirmation en cours…
                  </>
                ) : (
                  <>Payer {formattedPrice}</>
                )}
              </Button>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-3 h-3" /> Paiement sécurisé · Accès immédiat après confirmation
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
