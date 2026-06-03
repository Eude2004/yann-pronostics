
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
          WHEN c.end_date IS NULL OR now() < c.end_date THEN 'published'::publish_status
          ELSE 'archived'::publish_status
        END,
        is_featured = CASE
          WHEN now() < c.start_date THEN false
          WHEN c.end_date IS NULL OR now() < c.end_date THEN true
          ELSE false
        END,
        updated_at = now()
    WHERE c.start_date IS NOT NULL
      AND (
        c.status IS DISTINCT FROM (CASE
          WHEN now() < c.start_date THEN 'draft'::publish_status
          WHEN c.end_date IS NULL OR now() < c.end_date THEN 'published'::publish_status
          ELSE 'archived'::publish_status
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

GRANT EXECUTE ON FUNCTION public.refresh_coupon_statuses() TO anon, authenticated, service_role;

SELECT public.refresh_coupon_statuses();
