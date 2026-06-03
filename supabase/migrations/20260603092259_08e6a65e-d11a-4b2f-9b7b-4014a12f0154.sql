
-- 1) Trigger: when a coupon becomes published with a coupon_type, archive other published coupons of the same coupon_type
CREATE OR REPLACE FUNCTION public.archive_previous_coupon_of_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published'::publish_status AND NEW.coupon_type IS NOT NULL THEN
    UPDATE public.coupons
       SET status = 'archived'::publish_status,
           is_featured = false,
           updated_at = now()
     WHERE coupon_type = NEW.coupon_type
       AND id <> NEW.id
       AND status = 'published'::publish_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_previous_coupon_of_type ON public.coupons;
CREATE TRIGGER trg_archive_previous_coupon_of_type
AFTER INSERT OR UPDATE OF status, coupon_type ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.archive_previous_coupon_of_type();

-- 2) Modify refresh_coupon_statuses so expired coupons remain 'published'
-- (they stay visible until a replacement is published).
CREATE OR REPLACE FUNCTION public.refresh_coupon_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.coupons c
    SET status = CASE
          WHEN now() < c.start_date THEN 'draft'::publish_status
          ELSE 'published'::publish_status
        END,
        is_featured = CASE
          WHEN now() < c.start_date THEN false
          WHEN c.end_date IS NULL OR now() < c.end_date THEN true
          ELSE false
        END,
        updated_at = now()
    WHERE c.start_date IS NOT NULL
      AND c.status <> 'archived'::publish_status
      AND (
        c.status IS DISTINCT FROM (CASE
          WHEN now() < c.start_date THEN 'draft'::publish_status
          ELSE 'published'::publish_status
        END)
        OR c.is_featured IS DISTINCT FROM (CASE
          WHEN now() < c.start_date THEN false
          WHEN c.end_date IS NULL OR now() < c.end_date THEN true
          ELSE false
        END)
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- 3) Apply the new rule immediately: for each coupon_type, keep only the most-recent
-- published coupon; archive the older ones so the homepage shows max 4.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY coupon_type ORDER BY COALESCE(start_date, created_at) DESC) AS rn
    FROM public.coupons
   WHERE status = 'published'::publish_status
     AND coupon_type IS NOT NULL
)
UPDATE public.coupons c
   SET status = 'archived'::publish_status,
       is_featured = false,
       updated_at = now()
  FROM ranked r
 WHERE c.id = r.id
   AND r.rn > 1;
