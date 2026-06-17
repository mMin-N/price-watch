-- Apply via Supabase Dashboard SQL Editor

-- profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- wishlist_items
create table wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- tracked_products
create table tracked_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wishlist_item_id uuid references wishlist_items(id) on delete set null,
  url text not null,
  title text,
  target_price numeric,
  currency text default 'USD',
  last_price numeric,
  last_fetched_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, url)
);

-- price_history
create table price_history (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  price numeric not null,
  currency text not null default 'USD',
  provider text not null default 'zenrows',
  created_at timestamptz default now()
);
create index idx_price_history_product_time on price_history (tracked_product_id, created_at desc);

-- notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracked_product_id uuid references tracked_products(id) on delete set null,
  type text not null default 'price_alert',
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index idx_notifications_user_unread on notifications (user_id, created_at desc) where read_at is null;

-- alert_logs
create table alert_logs (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  price_history_id uuid not null references price_history(id),
  triggered_price numeric not null,
  target_price numeric not null,
  email_sent boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table wishlist_items enable row level security;
alter table tracked_products enable row level security;
alter table price_history enable row level security;
alter table notifications enable row level security;
alter table alert_logs enable row level security;

create policy "profiles_select_own" on profiles for select using (id = auth.uid());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

create policy "wishlists_all_own" on wishlist_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "products_all_own" on tracked_products for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "price_history_select_own" on price_history for select using (
  exists (select 1 from tracked_products tp where tp.id = price_history.tracked_product_id and tp.user_id = auth.uid())
);
create policy "price_history_insert_own" on price_history for insert with check (
  exists (select 1 from tracked_products tp where tp.id = price_history.tracked_product_id and tp.user_id = auth.uid())
);

create policy "notifications_all_own" on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "alert_logs_select_own" on alert_logs for select using (
  exists (select 1 from tracked_products tp where tp.id = alert_logs.tracked_product_id and tp.user_id = auth.uid())
);
