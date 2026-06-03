
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule existing job if it exists (safe to ignore error)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-coupon-statuses');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-coupon-statuses',
  '* * * * *',
  $$SELECT public.refresh_coupon_statuses();$$
);
