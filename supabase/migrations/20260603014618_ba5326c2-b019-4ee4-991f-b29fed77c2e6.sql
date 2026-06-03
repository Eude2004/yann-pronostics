-- RLS policies on coupons, reviews, profiles, app_settings, etc. call public.has_role(...)
-- which requires EXECUTE permission for the calling role. A previous lockdown
-- migration revoked EXECUTE from anon/authenticated, which broke policy
-- evaluation and surfaced as "permission denied for function has_role" / 401.
-- The function is SECURITY DEFINER and only returns a boolean, so it is safe
-- to grant back.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- Same reasoning: has_paid_coupon / has_active_vip are used by coupon-access
-- server fns through the admin client, but they are SECURITY DEFINER booleans
-- that can be safely exposed to authenticated users for self-checks.
GRANT EXECUTE ON FUNCTION public.has_active_vip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_paid_coupon(uuid, uuid) TO authenticated;