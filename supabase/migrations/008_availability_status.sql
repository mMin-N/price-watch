-- Wave 2: product availability status for out-of-stock handling

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'unknown';
