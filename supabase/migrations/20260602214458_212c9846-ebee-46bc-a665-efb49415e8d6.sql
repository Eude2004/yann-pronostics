
-- =================== COUPONS UPDATE ===================
CREATE TYPE public.coupon_type AS ENUM ('cote_10', 'cote_30', 'cote_50', 'pair_corner');

ALTER TABLE public.coupons
  ADD COLUMN coupon_type public.coupon_type,
  ADD COLUMN video_url TEXT,
  ADD COLUMN start_date TIMESTAMPTZ,
  ADD COLUMN end_date TIMESTAMPTZ,
  ADD COLUMN sales_count INT NOT NULL DEFAULT 0;

CREATE INDEX idx_coupons_dates ON public.coupons(start_date, end_date);
CREATE INDEX idx_coupons_type ON public.coupons(coupon_type);

-- Trigger: enforce title + price from coupon_type
CREATE OR REPLACE FUNCTION public.enforce_coupon_type_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.coupon_type IS NOT NULL THEN
    CASE NEW.coupon_type
      WHEN 'cote_10' THEN NEW.title := 'Cote de 10+'; NEW.price_xaf := 4000;
      WHEN 'cote_30' THEN NEW.title := 'Cote de 30+'; NEW.price_xaf := 5000;
      WHEN 'cote_50' THEN NEW.title := 'Cote de 50+'; NEW.price_xaf := 7000;
      WHEN 'pair_corner' THEN NEW.title := 'Coupon Total Pair Corner'; NEW.price_xaf := 6000;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coupons_enforce_type
  BEFORE INSERT OR UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_coupon_type_defaults();

-- =================== APP SETTINGS ===================
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings are viewable by everyone"
  ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete settings"
  ON public.app_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =================== SUBSCRIPTION PLANS ===================
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_xaf INT NOT NULL,
  duration_days INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone"
  ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Admins manage plans insert"
  ON public.subscription_plans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage plans update"
  ON public.subscription_plans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage plans delete"
  ON public.subscription_plans FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================== SUBSCRIPTIONS ===================
CREATE TYPE public.subscription_status AS ENUM ('active', 'inactive', 'expired', 'cancelled');

CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  status public.subscription_status NOT NULL DEFAULT 'inactive',
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  activated_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subs_user ON public.subscriptions(user_id);
CREATE INDEX idx_subs_status ON public.subscriptions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert subscriptions"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update subscriptions"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete subscriptions"
  ON public.subscriptions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================== TRANSACTIONS ===================
CREATE TYPE public.transaction_kind AS ENUM ('coupon', 'subscription');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind public.transaction_kind NOT NULL,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_xaf INT NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  reference TEXT,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tx_user ON public.transactions(user_id);
CREATE INDEX idx_tx_status ON public.transactions(status);
CREATE INDEX idx_tx_created ON public.transactions(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete transactions"
  ON public.transactions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =================== DEFAULT DATA ===================
INSERT INTO public.app_settings (key, value) VALUES
  ('whatsapp_number', '654010951'),
  ('site_name', 'YANN PRONOSTICS')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.subscription_plans (name, description, price_xaf, duration_days, sort_order) VALUES
  ('VIP Hebdomadaire', 'Accès illimité aux 4 coupons quotidiens pendant 7 jours', 15000, 7, 1),
  ('VIP Mensuel', 'Accès illimité aux 4 coupons quotidiens pendant 30 jours', 50000, 30, 2),
  ('VIP Trimestriel', 'Accès illimité aux 4 coupons quotidiens pendant 90 jours', 130000, 90, 3),
  ('VIP Annuel', 'Accès illimité aux 4 coupons quotidiens pendant 365 jours', 450000, 365, 4)
ON CONFLICT DO NOTHING;
