GRANT SELECT (id, title, slug, description, sport, category_id, price_xaf, odds,
  image_url, preview_content, status, is_featured, created_by, created_at,
  updated_at, coupon_type, video_url, start_date, end_date, sales_count, event_date)
ON public.coupons TO anon, authenticated;

GRANT ALL ON public.coupons TO service_role;