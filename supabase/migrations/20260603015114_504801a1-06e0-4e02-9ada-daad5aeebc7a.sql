-- Restrict refresh_coupon_statuses to service_role only (cron/admin use)
REVOKE EXECUTE ON FUNCTION public.refresh_coupon_statuses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_coupon_statuses() TO service_role;