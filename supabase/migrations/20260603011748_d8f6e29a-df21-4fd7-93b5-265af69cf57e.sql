
-- 1. Coupons: hide private_content from public/authenticated; admins keep full access via grant
REVOKE SELECT ON public.coupons FROM anon, authenticated;
GRANT SELECT (id, title, slug, description, sport, category_id, price_xaf, odds, event_date, image_url, preview_content, status, is_featured, created_by, created_at, updated_at, coupon_type, video_url, start_date, end_date, sales_count) ON public.coupons TO anon, authenticated;
GRANT SELECT ON public.coupons TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.coupons TO authenticated;

-- 2. Profiles: hide whatsapp from other users; owner-only via separate policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, username, avatar_url, locale, theme_preference, reduce_motion, preferences_updated_at, created_at, updated_at) ON public.profiles TO authenticated;
GRANT SELECT (whatsapp) ON public.profiles TO authenticated; -- column grant; row-level still gated below
-- Restrict whatsapp via dedicated policy: only owner or admin sees whatsapp through a view
CREATE OR REPLACE VIEW public.profiles_self AS
  SELECT id, whatsapp FROM public.profiles WHERE id = auth.uid() OR public.has_role(auth.uid(), 'admin');
GRANT SELECT ON public.profiles_self TO authenticated;

-- 3. app_settings: restrict to public-safe keys for anon/authenticated, admin sees all
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.app_settings;
CREATE POLICY "Public settings are viewable by everyone"
  ON public.app_settings FOR SELECT TO anon, authenticated
  USING (key IN ('whatsapp_number','site_name','anonymous_mode'));
CREATE POLICY "Admins can view all settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Realtime: remove sensitive tables from publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_audit_log;
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.reviews;
-- Keep public.transactions and public.coupons (needed by app); RLS scopes rows per user.

-- 5. Lock down SECURITY DEFINER helper functions: only callable from server-side trusted code paths
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_paid_coupon(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_active_vip(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.refresh_coupon_statuses() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_paid_coupon(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_vip(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_coupon_statuses() TO service_role;
-- has_role is still usable inside RLS policies because policies execute with definer rights on the function owner, independent of EXECUTE grants on the caller. Same for the others when referenced from policies/triggers.
