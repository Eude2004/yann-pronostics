
DROP POLICY IF EXISTS "Profiles are viewable by authenticated" ON public.profiles;
CREATE POLICY "Users can view their own profile or admins view all"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT (id, full_name, username, avatar_url, locale, theme_preference, reduce_motion, preferences_updated_at, created_at, updated_at) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles for others"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

CREATE POLICY "Block self role assignment"
  ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (user_id <> auth.uid());

ALTER PUBLICATION supabase_realtime DROP TABLE public.app_settings;
