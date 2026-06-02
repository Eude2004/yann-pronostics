ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences_updated_at timestamptz NOT NULL DEFAULT now();