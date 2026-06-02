
-- 1. Met à jour le trigger handle_new_user pour stocker le whatsapp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, avatar_url, whatsapp)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'whatsapp'
  )
  ON CONFLICT (id) DO UPDATE
    SET whatsapp = COALESCE(EXCLUDED.whatsapp, public.profiles.whatsapp);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  IF lower(NEW.email) = 'tsiemieude@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

-- S'assure que le trigger existe sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Fonctions d'accès
CREATE OR REPLACE FUNCTION public.has_active_vip(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.has_paid_coupon(_user_id uuid, _coupon_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = _user_id
      AND coupon_id = _coupon_id
      AND status = 'completed'
  )
$$;

-- 3. Auto-activation de l'abonnement quand une transaction VIP est validée
CREATE OR REPLACE FUNCTION public.auto_activate_subscription_on_tx()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days int;
BEGIN
  IF NEW.kind = 'subscription'
     AND NEW.status = 'completed'
     AND NEW.subscription_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    SELECT p.duration_days INTO v_days
    FROM public.subscriptions s
    LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.id = NEW.subscription_id;

    UPDATE public.subscriptions
    SET status = 'active',
        started_at = COALESCE(started_at, now()),
        expires_at = now() + (COALESCE(v_days, 30) || ' days')::interval,
        updated_at = now()
    WHERE id = NEW.subscription_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_activate_subscription_on_tx ON public.transactions;
CREATE TRIGGER trg_auto_activate_subscription_on_tx
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.auto_activate_subscription_on_tx();

-- 4. RLS sur le bucket privé coupon-videos
-- Seuls les admins peuvent uploader/modifier/supprimer. La lecture passe uniquement par URL signée (générée côté serveur).
DROP POLICY IF EXISTS "Admins upload coupon videos" ON storage.objects;
CREATE POLICY "Admins upload coupon videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'coupon-videos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update coupon videos" ON storage.objects;
CREATE POLICY "Admins update coupon videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'coupon-videos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete coupon videos" ON storage.objects;
CREATE POLICY "Admins delete coupon videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'coupon-videos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins list coupon videos" ON storage.objects;
CREATE POLICY "Admins list coupon videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'coupon-videos' AND public.has_role(auth.uid(), 'admin'));
