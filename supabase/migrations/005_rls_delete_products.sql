-- Ensure tracked_products DELETE works under RLS
DROP POLICY IF EXISTS "products_delete_own" ON public.tracked_products;
CREATE POLICY "products_delete_own" ON public.tracked_products
  FOR DELETE
  USING (user_id = auth.uid());
