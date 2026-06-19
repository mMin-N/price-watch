-- alert_logs INSERT policy, product-level alert dedup flags, pipeline lock column

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS target_price_alert_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_alert_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pipeline_lock_until timestamptz;

DROP POLICY IF EXISTS "alert_logs_insert_own" ON public.alert_logs;
CREATE POLICY "alert_logs_insert_own" ON public.alert_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tracked_products tp
      WHERE tp.id = alert_logs.tracked_product_id
        AND tp.user_id = auth.uid()
    )
  );
