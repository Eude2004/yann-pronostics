-- Garantir une unique transaction par (user_id, coupon_id) pour les achats coupon.
-- Nettoyer d'abord les doublons éventuels en conservant la "meilleure" ligne
-- (completed > pending > failed > refunded, puis la plus récente).
WITH ranked AS (
  SELECT id, user_id, coupon_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, coupon_id
      ORDER BY
        CASE status
          WHEN 'completed' THEN 0
          WHEN 'pending'   THEN 1
          WHEN 'failed'    THEN 2
          WHEN 'refunded'  THEN 3
          ELSE 4
        END,
        created_at DESC
    ) AS rn
  FROM public.transactions
  WHERE kind = 'coupon' AND coupon_id IS NOT NULL
)
DELETE FROM public.transactions t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

-- Index unique partiel : un seul ticket par (user, coupon) côté coupons.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_coupon_unique
  ON public.transactions (user_id, coupon_id)
  WHERE kind = 'coupon' AND coupon_id IS NOT NULL;
