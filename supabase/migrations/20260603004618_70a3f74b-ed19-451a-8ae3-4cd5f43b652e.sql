-- Dédupliquer : garder la "meilleure" transaction par (user_id, coupon_id)
-- Priorité : completed > pending > failed > refunded ; puis la plus ancienne.
WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY user_id, coupon_id
      ORDER BY
        CASE status
          WHEN 'completed' THEN 1
          WHEN 'pending'   THEN 2
          WHEN 'failed'    THEN 3
          WHEN 'refunded'  THEN 4
          ELSE 5
        END,
        created_at ASC
    ) AS rn
  FROM public.transactions
  WHERE kind = 'coupon' AND coupon_id IS NOT NULL
)
DELETE FROM public.transactions t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_coupon_unique
  ON public.transactions (user_id, coupon_id)
  WHERE kind = 'coupon' AND coupon_id IS NOT NULL;