-- Activer la réplication temps réel pour les tables clés
ALTER TABLE public.coupons REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.reviews REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.admin_audit_log REPLICA IDENTITY FULL;

-- Ajouter à la publication realtime (ignore si déjà présent)
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_audit_log; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Activer par défaut le Mode Test Pay pour permettre les paiements simulés
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('test_pay_mode', 'true', now())
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();
