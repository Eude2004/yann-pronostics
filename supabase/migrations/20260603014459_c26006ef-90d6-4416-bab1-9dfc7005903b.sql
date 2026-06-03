-- 1) Remove transactions from realtime publication (sensitive financial data)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.transactions';
  END IF;
END $$;

-- 2) Defense-in-depth: a RESTRICTIVE policy that requires admin role for ANY insert on user_roles
DROP POLICY IF EXISTS "Require admin role for any user_roles insert" ON public.user_roles;
CREATE POLICY "Require admin role for any user_roles insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));