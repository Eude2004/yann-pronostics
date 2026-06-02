ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system'
    CHECK (theme_preference IN ('system','light','dark')),
  ADD COLUMN IF NOT EXISTS reduce_motion boolean NOT NULL DEFAULT false;