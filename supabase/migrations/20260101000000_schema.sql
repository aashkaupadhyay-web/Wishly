-- Wishly: core schema. Apply with `supabase db push` or paste into the Supabase SQL editor.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- ---------- catalog_products (seeded, read-only for users) ----------
create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  retailer text,
  product_url text,
  image_url text,
  category text,
  subcategory text,
  color text,
  material text,
  style text,
  silhouette text,
  hardware text,
  closure text,
  size text,
  shape text,
  description text,
  created_at timestamptz not null default now()
);

-- ---------- wishlist_items (per-user saved products) ----------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  catalog_product_id uuid references public.catalog_products (id) on delete set null,
  product_name text not null check (char_length(product_name) between 1 and 200),
  retailer text,
  product_url text check (product_url is null or product_url ~* '^https?://'),
  image_url text,
  category text,
  subcategory text,
  color text,
  material text,
  style text,
  silhouette text,
  hardware text,
  closure text,
  size text,
  shape text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wishlist_items_user_idx on public.wishlist_items (user_id, created_at desc);

-- ---------- recommendations ----------
create table public.recommendation_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  wishlist_item_id uuid not null references public.wishlist_items (id) on delete cascade,
  source text not null check (source in ('catalog', 'catalog+live')),
  preferences jsonb not null,
  created_at timestamptz not null default now()
);
create index recommendation_searches_user_idx on public.recommendation_searches (user_id, created_at desc);

create table public.recommendation_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.recommendation_searches (id) on delete cascade,
  product_data jsonb not null,
  similarity_score numeric(5, 1),
  explanation text,
  created_at timestamptz not null default now()
);
create index recommendation_results_search_idx on public.recommendation_results (search_id);

create table public.recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recommendation_result_id uuid not null references public.recommendation_results (id) on delete cascade,
  feedback_type text not null check (feedback_type in ('helpful', 'not_helpful')),
  created_at timestamptz not null default now(),
  unique (user_id, recommendation_result_id)
);

-- ---------- sharing (only a SHA-256 hash of the token is stored) ----------
create table public.shared_wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index shared_wishlists_owner_idx on public.shared_wishlists (owner_user_id, created_at desc);

create table public.shared_wishlist_items (
  id uuid primary key default gen_random_uuid(),
  shared_wishlist_id uuid not null references public.shared_wishlists (id) on delete cascade,
  wishlist_item_id uuid not null references public.wishlist_items (id) on delete cascade,
  unique (shared_wishlist_id, wishlist_item_id)
);

-- ---------- SerpAPI quota + cache (server-side only; no client policies) ----------
create table public.serpapi_usage (
  month_start date primary key,           -- first day of the month, UTC
  searches_reserved integer not null default 0 check (searches_reserved >= 0),
  updated_at timestamptz not null default now()
);

create table public.serpapi_cache (
  query_key text primary key,
  results jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- triggers ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger wishlist_items_touch before update on public.wishlist_items
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
