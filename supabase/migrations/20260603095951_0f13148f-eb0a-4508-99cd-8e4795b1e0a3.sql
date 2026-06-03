-- Optimized refresh: only touch coupons whose start_date or end_date boundary has actually been crossed
-- and whose computed (status, is_featured) differs from current.
CREATE OR REPLACE FUNCTION public.refresh_coupon_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH candidates AS (
    SELECT c.id,
           CASE
             WHEN now() < c.start_date THEN 'draft'::publish_status
             ELSE 'published'::publish_status
           END AS new_status,
           CASE
             WHEN now() < c.start_date THEN false
             WHEN c.end_date IS NULL OR now() < c.end_date THEN true
             ELSE false
           END AS new_featured
    FROM public.coupons c
    WHERE c.start_date IS NOT NULL
      AND c.status <> 'archived'::publish_status
      -- Only consider rows whose status or featured flag is on the edge of a transition.
      AND (
        -- start_date boundary may have been crossed (draft -> published)
        (c.status = 'draft'::publish_status AND c.start_date <= now())
        -- end_date boundary may have been crossed (loses featured)
        OR (c.is_featured = true AND c.end_date IS NOT NULL AND c.end_date <= now())
        -- start_date moved into the future after the fact (published -> draft)
        OR (c.status = 'published'::publish_status AND c.start_date > now())
      )
  ),
  updated AS (
    UPDATE public.coupons c
    SET status = cand.new_status,
        is_featured = cand.new_featured,
        updated_at = now()
    FROM candidates cand
    WHERE c.id = cand.id
      AND (c.status IS DISTINCT FROM cand.new_status
           OR c.is_featured IS DISTINCT FROM cand.new_featured)
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;

-- Supporting index to make the candidate scan cheap at high frequency.
CREATE INDEX IF NOT EXISTS idx_coupons_lifecycle
  ON public.coupons (status, start_date, end_date)
  WHERE status <> 'archived'::publish_status;
