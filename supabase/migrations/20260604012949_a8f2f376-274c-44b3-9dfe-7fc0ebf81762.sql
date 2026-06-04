CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.archive_expired_validated_coupons()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.validated_coupons
       SET status = 'archived'::validated_coupon_status,
           updated_at = now()
     WHERE status = 'published'::validated_coupon_status
       AND display_end IS NOT NULL
       AND display_end <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('archive-expired-validated-coupons');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'archive-expired-validated-coupons',
  '*/5 * * * *',
  $$ SELECT public.archive_expired_validated_coupons(); $$
);