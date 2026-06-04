
-- Service role : accès complet (bypass RLS de toute façon)
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT ALL ON public.app_settings TO service_role;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.coupons TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.reviews TO service_role;
GRANT ALL ON public.subscription_plans TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.validated_coupons TO service_role;

-- Authenticated : CRUD, filtré par les RLS existantes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.validated_coupons TO authenticated;

-- Anon : lecture seule sur les tables avec une policy SELECT non scopée à auth.uid()
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.coupons TO anon;
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.validated_coupons TO anon;
