import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Stores the user's intent to buy a coupon while signed-out, then prompts
 * them to sign up / sign in. After auth, the pending purchase is resumed
 * automatically from /dashboard or /index via `consumePendingPurchase()`.
 */
const KEY = "yp_pending_purchase";
const SEEN_KEY = "yp_visitor_prompt_seen";

export type PendingPurchase = { couponId: string; ts: number };

export function setPendingPurchase(couponId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ couponId, ts: Date.now() }));
  } catch {}
}

export function consumePendingPurchase(): PendingPurchase | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as PendingPurchase;
    // Expire after 1h
    if (Date.now() - parsed.ts > 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function VisitorSignupPrompt({
  open,
  onOpenChange,
  couponId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  couponId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const goAuth = (tab: "login" | "signup") => {
    if (couponId) setPendingPurchase(couponId);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    onOpenChange(false);
    navigate({ to: "/auth", search: { tab } as never });
  };

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {t("visitor_prompt.title")}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {t("visitor_prompt.body")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            className="sm:order-1 w-full sm:w-auto"
            onClick={dismiss}
          >
            {t("visitor_prompt.later")}
          </Button>
          <Button
            variant="outline"
            className="sm:order-2 w-full sm:w-auto"
            onClick={() => goAuth("login")}
          >
            {t("visitor_prompt.signin")}
          </Button>
          <Button
            className="sm:order-3 w-full sm:w-auto bg-gold-gradient text-primary-foreground font-semibold shadow-gold"
            onClick={() => goAuth("signup")}
          >
            {t("visitor_prompt.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to show the prompt at most once per session for unconnected visitors.
 */
export function useVisitorPromptOnce(when: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!when) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {}
    setOpen(true);
  }, [when]);
  return { open, setOpen };
}
