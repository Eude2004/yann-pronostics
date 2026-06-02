
CREATE POLICY "Admins can upload coupon images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'coupon-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coupon images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'coupon-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coupon images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'coupon-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read coupon images via signed urls"
ON storage.objects FOR SELECT TO authenticated, anon
USING (bucket_id = 'coupon-images');
