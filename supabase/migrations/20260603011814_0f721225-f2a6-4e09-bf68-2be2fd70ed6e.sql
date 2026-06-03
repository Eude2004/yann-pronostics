
-- Drop the helper view (flagged as security definer view)
DROP VIEW IF EXISTS public.profiles_self;

-- Fully revoke whatsapp column from authenticated; admin reads via supabaseAdmin (service_role)
REVOKE SELECT (whatsapp) ON public.profiles FROM authenticated;

-- Lock down remaining SECURITY DEFINER functions (triggers still work; trigger execution doesn't require EXECUTE on the caller)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_activate_subscription_on_tx() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_activate_subscription_on_tx() TO service_role;
