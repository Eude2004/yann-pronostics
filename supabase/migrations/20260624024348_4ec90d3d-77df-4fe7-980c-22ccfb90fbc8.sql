-- 1) Stop broadcasting per-user financial CDC events
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.transactions';
  END IF;
END $$;

-- 2) Hide private columns from anon/authenticated direct Data API reads.
--    private_content: server-only.
--    video_url: hidden from anon (admins/authenticated still need it for the admin UI).
REVOKE SELECT (private_content) ON public.coupons FROM anon, authenticated;
REVOKE SELECT (video_url) ON public.coupons FROM anon;
