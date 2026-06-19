-- Repair script: run in Supabase Dashboard → SQL Editor
-- Fixes: wishlist_items.name missing, notifications table missing

-- wishlist_items: add missing columns
ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.wishlist_items
SET name = 'My Wishlist'
WHERE name IS NULL;

ALTER TABLE public.wishlist_items
  ALTER COLUMN name SET NOT NULL;

-- notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_product_id uuid REFERENCES public.tracked_products(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'price_alert',
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- alert_logs (if also missing)
CREATE TABLE IF NOT EXISTS public.alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_product_id uuid NOT NULL REFERENCES public.tracked_products(id) ON DELETE CASCADE,
  price_history_id uuid NOT NULL REFERENCES public.price_history(id),
  triggered_price numeric NOT NULL,
  target_price numeric NOT NULL,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_all_own" ON public.notifications;
CREATE POLICY "notifications_all_own" ON public.notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS for alert_logs
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_logs_select_own" ON public.alert_logs;
CREATE POLICY "alert_logs_select_own" ON public.alert_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tracked_products tp
      WHERE tp.id = alert_logs.tracked_product_id
        AND tp.user_id = auth.uid()
    )
  );
