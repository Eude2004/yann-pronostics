-- Ajoute la clé Mode Test Pay dans app_settings
INSERT INTO public.app_settings (key, value)
VALUES ('test_pay_mode', 'false')
ON CONFLICT (key) DO NOTHING;