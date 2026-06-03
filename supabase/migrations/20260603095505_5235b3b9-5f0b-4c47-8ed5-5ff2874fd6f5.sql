-- Attach trigger so that publishing a coupon automatically archives the previous published one of the same type
DROP TRIGGER IF EXISTS trg_archive_previous_coupon_of_type ON public.coupons;
CREATE TRIGGER trg_archive_previous_coupon_of_type
AFTER INSERT OR UPDATE OF status ON public.coupons
FOR EACH ROW
WHEN (NEW.status = 'published'::publish_status)
EXECUTE FUNCTION public.archive_previous_coupon_of_type();
