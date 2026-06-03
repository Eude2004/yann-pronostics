import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { computeCouponLifecycle, formatDuration, type CouponLifecycleStatus } from "@/lib/coupon-status";

const STATUS_LABEL: Record<CouponLifecycleStatus, string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

const STATUS_CLASS: Record<CouponLifecycleStatus, string> = {
  draft: "bg-muted text-muted-foreground border border-border",
  published: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
  archived: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30",
};

const NEXT_LABEL: Record<CouponLifecycleStatus, string> = {
  draft: "→ Brouillon",
  published: "→ Publication",
  archived: "→ Archivage",
};

type Props = {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  className?: string;
  compact?: boolean;
};

export function CouponStatusBadge({ startDate, endDate, className, compact }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { status, nextAt, nextStatus } = computeCouponLifecycle(startDate, endDate, now);
  const remaining = nextAt ? nextAt.getTime() - now.getTime() : null;

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Badge className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</Badge>
      {!compact && nextStatus && remaining !== null && remaining > 0 && (
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {NEXT_LABEL[nextStatus]} dans {formatDuration(remaining)}
        </span>
      )}
    </span>
  );
}
