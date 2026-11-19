-- Wishly: Row Level Security + privileged functions.

alter table public.profiles                enable row level security;
alter table public.catalog_products        enable row level security;
alter table public.wishlist_items          enable row level security;
alter table public.recommendation_searches enable row level security;
alter table public.recommendation_results  enable row level security;
alter table public.recommendation_feedback enable row level security;
alter table public.shared_wishlists        enable row level security;
alter table public.shared_wishlist_items   enable row level security;
alter table public.serpapi_usage           enable row level security;
alter table public.serpapi_cache           enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- catalog: read-only for signed-in users, no write policies at all
create policy catalog_read on public.catalog_products for select to authenticated using (true);

-- wishlist
create policy wishlist_select_own on public.wishlist_items for select to authenticated using (user_id = auth.uid());
create policy wishlist_insert_own on public.wishlist_items for insert to authenticated with check (user_id = auth.uid());
create policy wishlist_update_own on public.wishlist_items for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wishlist_delete_own on public.wishlist_items for delete to authenticated using (user_id = auth.uid());

-- searches
create policy searches_select_own on public.recommendation_searches for select to authenticated using (user_id = auth.uid());
create policy searches_insert_own on public.recommendation_searches for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.wishlist_items w where w.id = wishlist_item_id and w.user_id = auth.uid())
  );
create policy searches_delete_own on public.recommendation_searches for delete to authenticated using (user_id = auth.uid());

-- results (owned through their search)
create policy results_select_own on public.recommendation_results for select to authenticated
  using (exists (select 1 from public.recommendation_searches s where s.id = search_id and s.user_id = auth.uid()));
create policy results_insert_own on public.recommendation_results for insert to authenticated
  with check (exists (select 1 from public.recommendation_searches s where s.id = search_id and s.user_id = auth.uid()));

-- feedback
create policy feedback_select_own on public.recommendation_feedback for select to authenticated using (user_id = auth.uid());
create policy feedback_insert_own on public.recommendation_feedback for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.recommendation_results r
      join public.recommendation_searches s on s.id = r.search_id
      where r.id = recommendation_result_id and s.user_id = auth.uid()
    )
  );
create policy feedback_update_own on public.recommendation_feedback for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy feedback_delete_own on public.recommendation_feedback for delete to authenticated using (user_id = auth.uid());

-- share links: owner manages; visitors never touch these tables directly
create policy shares_select_own on public.shared_wishlists for select to authenticated using (owner_user_id = auth.uid());
create policy shares_insert_own on public.shared_wishlists for insert to authenticated with check (owner_user_id = auth.uid());
create policy shares_update_own on public.shared_wishlists for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy shares_delete_own on public.shared_wishlists for delete to authenticated using (owner_user_id = auth.uid());

create policy share_items_select_own on public.shared_wishlist_items for select to authenticated
  using (exists (select 1 from public.shared_wishlists s where s.id = shared_wishlist_id and s.owner_user_id = auth.uid()));
create policy share_items_insert_own on public.shared_wishlist_items for insert to authenticated
  with check (
    exists (select 1 from public.shared_wishlists s where s.id = shared_wishlist_id and s.owner_user_id = auth.uid())
    and exists (select 1 from public.wishlist_items w where w.id = wishlist_item_id and w.user_id = auth.uid())
  );
create policy share_items_delete_own on public.shared_wishlist_items for delete to authenticated
  using (exists (select 1 from public.shared_wishlists s where s.id = shared_wishlist_id and s.owner_user_id = auth.uid()));

-- serpapi_usage / serpapi_cache: RLS on, intentionally NO policies. Only the service role can touch them.
revoke all on public.serpapi_usage from anon, authenticated;
revoke all on public.serpapi_cache from anon, authenticated;
revoke all on public.catalog_products from anon;

-- ---------- atomic SerpAPI quota reservation ----------
-- A single UPDATE with a guard clause: concurrent callers serialise on the row lock and the
-- `searches_reserved < limit` predicate is re-checked after the lock, so the counter can never
-- exceed the limit. The 250 ceiling is hard-coded here too, so a bad argument can't raise it.
-- The month boundary is UTC.
create or replace function public.reserve_serpapi_search(p_limit integer default 250)
returns table (allowed boolean, used integer)
language plpgsql security definer set search_path = public as $$
declare
  m date := (date_trunc('month', now() at time zone 'utc'))::date;
  v integer;
begin
  insert into public.serpapi_usage (month_start, searches_reserved) values (m, 0)
  on conflict (month_start) do nothing;

  update public.serpapi_usage
     set searches_reserved = searches_reserved + 1, updated_at = now()
   where month_start = m and searches_reserved < least(greatest(p_limit, 0), 250)
  returning searches_reserved into v;

  if found then
    return query select true, v;
  else
    return query select false, (select u.searches_reserved from public.serpapi_usage u where u.month_start = m);
  end if;
end $$;

revoke all on function public.reserve_serpapi_search(integer) from public, anon, authenticated;
grant execute on function public.reserve_serpapi_search(integer) to service_role;

-- ---------- public shared-wishlist read path ----------
-- Returns ONLY whitelisted product fields: no ids, no user data. Callable by the service role only
-- (i.e. from our server), keyed by the SHA-256 of the secret token. Revoked links return nothing.
create or replace function public.get_shared_wishlist(p_token_hash text)
returns table (
  product_name text, retailer text, product_url text, image_url text, category text, subcategory text,
  color text, material text, style text, silhouette text, hardware text, closure text, size text,
  shape text, description text
)
language sql stable security definer set search_path = public as $$
  select w.product_name, w.retailer, w.product_url, w.image_url, w.category, w.subcategory,
         w.color, w.material, w.style, w.silhouette, w.hardware, w.closure, w.size, w.shape, w.description
    from public.shared_wishlists sw
    join public.shared_wishlist_items si on si.shared_wishlist_id = sw.id
    join public.wishlist_items w on w.id = si.wishlist_item_id and w.user_id = sw.owner_user_id
   where sw.token_hash = p_token_hash and sw.revoked_at is null
   order by w.created_at desc;
$$;

revoke all on function public.get_shared_wishlist(text) from public, anon, authenticated;
grant execute on function public.get_shared_wishlist(text) to service_role;
