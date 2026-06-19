-- Add optional discount-percent alert (either target price OR discount can trigger)
ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS discount_alert_percent numeric,
  ADD COLUMN IF NOT EXISTS baseline_price numeric;

ALTER TABLE public.alert_logs
  ALTER COLUMN target_price DROP NOT NULL;

ALTER TABLE public.alert_logs
  ADD COLUMN IF NOT EXISTS trigger_reason text NOT NULL DEFAULT 'target_price',
  ADD COLUMN IF NOT EXISTS discount_percent numeric;
