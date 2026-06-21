-- Default "Other" wishlist: one per user, auto-assigned to orphan products.

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_one_default_per_user
  ON public.wishlist_items (user_id)
  WHERE is_default = true;

-- Backfill: users with orphan tracked products get an Other wishlist.
DO $$
DECLARE
  r RECORD;
  default_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id
    FROM public.tracked_products
    WHERE wishlist_item_id IS NULL
  LOOP
    SELECT id INTO default_id
    FROM public.wishlist_items
    WHERE user_id = r.user_id AND is_default = true
    LIMIT 1;

    IF default_id IS NULL THEN
      INSERT INTO public.wishlist_items (user_id, name, is_default)
      VALUES (r.user_id, 'Other', true)
      RETURNING id INTO default_id;
    END IF;

    UPDATE public.tracked_products
    SET wishlist_item_id = default_id
    WHERE user_id = r.user_id AND wishlist_item_id IS NULL;
  END LOOP;
END $$;
