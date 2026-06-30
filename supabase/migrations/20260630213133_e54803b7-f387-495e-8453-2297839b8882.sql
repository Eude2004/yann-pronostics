CREATE OR REPLACE FUNCTION public.enforce_coupon_type_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;

UPDATE public.coupons SET price_xaf = 4000 WHERE coupon_type = 'cote_10';