CREATE OR REPLACE FUNCTION public.enforce_coupon_type_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_price_key text;
  v_price_val text;
  v_default_price int;
BEGIN
  IF NEW.coupon_type IS NOT NULL THEN
    CASE NEW.coupon_type
      WHEN 'cote_10' THEN NEW.title := 'Cote de 10+'; v_default_price := 4000;
      WHEN 'cote_30' THEN NEW.title := 'Cote de 30+'; v_default_price := 5000;
      WHEN 'cote_50' THEN NEW.title := 'Cote de 50+'; v_default_price := 7000;
      WHEN 'pair_corner' THEN NEW.title := 'Coupon Total Pair Corner'; v_default_price := 6000;
    END CASE;

    v_price_key := 'price_' || NEW.coupon_type::text;
    SELECT value INTO v_price_val FROM public.app_settings WHERE key = v_price_key;

    IF v_price_val IS NOT NULL AND v_price_val ~ '^[0-9]+$' THEN
      NEW.price_xaf := v_price_val::int;
    ELSE
      NEW.price_xaf := v_default_price;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;