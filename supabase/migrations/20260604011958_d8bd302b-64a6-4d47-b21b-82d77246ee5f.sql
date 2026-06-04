
-- 1. Validated coupons (historique des gains) — table publique, gérée par les admins.
CREATE TYPE public.validated_coupon_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE public.validated_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  media_url text,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  published_at timestamptz NOT NULL DEFAULT now(),
  display_start timestamptz,
  display_end timestamptz,
  status public.validated_coupon_status NOT NULL DEFAULT 'published',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.validated_coupons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.validated_coupons TO authenticated;
GRANT ALL ON public.validated_coupons TO service_role;

ALTER TABLE public.validated_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read live validated coupons"
  ON public.validated_coupons
  FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'published'
      AND (display_start IS NULL OR display_start <= now())
      AND (display_end IS NULL OR display_end > now()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins insert validated coupons"
  ON public.validated_coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update validated coupons"
  ON public.validated_coupons
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete validated coupons"
  ON public.validated_coupons
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_validated_coupons_updated_at
  BEFORE UPDATE ON public.validated_coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_validated_coupons_visible
  ON public.validated_coupons (display_end, published_at DESC)
  WHERE status = 'published';

-- 2. Backfill missing event_date on existing coupons to today 15:00 (Africa/Douala-equivalent UTC).
-- We use 14:00 UTC ≈ 15:00 in WAT (UTC+1) which is the Cameroun timezone for this project.
UPDATE public.coupons
SET event_date = date_trunc('day', COALESCE(start_date, now())) + interval '14 hours'
WHERE event_date IS NULL;
