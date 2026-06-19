-- Tracking policy: failure backoff, user activity for cron eligibility
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

UPDATE public.profiles
SET last_active_at = COALESCE(last_active_at, created_at, now())
WHERE last_active_at IS NULL;

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS consecutive_failures int NOT NULL DEFAULT 0;
