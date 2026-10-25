-- /admin loads in one call (the route's loader stays one line: the first-load bundle has no room for a second RPC).
create function admin_page(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select admin_stats(p_days) || jsonb_build_object('growth', admin_growth(p_days))
$$;
revoke all on function admin_page(integer) from public, anon;
grant execute on function admin_page(integer) to authenticated;
