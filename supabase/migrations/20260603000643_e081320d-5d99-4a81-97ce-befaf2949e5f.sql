
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_vip(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_paid_coupon(uuid, uuid) TO anon, authenticated;
