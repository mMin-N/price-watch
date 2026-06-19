-- Fix: tracked_products and related tables missing columns
-- Run in Supabase Dashboard → SQL Editor (after 002 or instead of failed part)

-- tracked_products: add all columns the app expects
ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS wishlist_item_id uuid REFERENCES public.wishlist_items(id) ON DELETE SET NULL;

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS url text;

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS target_price numeric;

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS last_price numeric;

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS last_fetched_at timestamptz;

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.tracked_products
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- wishlist_items: ensure user_id exists
ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- price_history: ensure required columns
ALTER TABLE public.price_history
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

ALTER TABLE public.price_history
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'zenrows';

-- notifications (skip if already created)
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

CREATE TABLE IF NOT EXISTS public.alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracked_product_id uuid NOT NULL REFERENCES public.tracked_products(id) ON DELETE CASCADE,
  price_history_id uuid NOT NULL REFERENCES public.price_history(id),
  triggered_price numeric NOT NULL,
  target_price numeric NOT NULL,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS policies (only after user_id columns exist)
ALTER TABLE public.tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_all_own" ON public.tracked_products;
CREATE POLICY "products_all_own" ON public.tracked_products
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_all_own" ON public.notifications;
CREATE POLICY "notifications_all_own" ON public.notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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
