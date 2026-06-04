-- Realtime: ensure transactions table broadcasts INSERT/UPDATE/DELETE so the
-- user dashboard reacts instantly when the admin confirms a payment for any
-- account (new or old). coupons is already in the publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
END $$;

-- REPLICA IDENTITY FULL gives realtime the complete row on UPDATE/DELETE so
-- payload-based filtering works reliably for every subscriber.
ALTER TABLE public.coupons REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

-- Seed the admin-configurable display timezone (used by countdowns and the
-- "EN COURS" switch). Public read is already allowed for whitelisted keys;
-- extend the public SELECT policy to include this key so unauthenticated
-- visitors get the same countdown timezone as admins.
INSERT INTO public.app_settings (key, value)
VALUES ('admin_timezone', 'Africa/Lagos')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Public settings are viewable by everyone" ON public.app_settings;
CREATE POLICY "Public settings are viewable by everyone"
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (key = ANY (ARRAY['whatsapp_number','site_name','anonymous_mode','admin_timezone']));
