-- Speed: how long each page took to show, so performance work has real numbers (/admin "Speed").
-- page_views.load_ms: from the tap (or the document request, for the first page) until the page was painted.
-- page_views.nav: cold = first page of a fresh load, warm = first page from the installed app's cache (service
-- worker), nav = in-app navigation, cache = shown instantly from data kept on the device.
alter table page_views add column load_ms integer, add column nav text;

create or replace function log_visit(p_sid uuid, p_views jsonb, p_meta jsonb default '{}') returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  n text := me();
begin
  if p_sid is null or jsonb_typeof(p_views) <> 'array' then return; end if;
  insert into visits (sid, user_id, name, device, pwa, theme, referrer, entry)
  values (p_sid, u, n, left(p_meta ->> 'device', 20), (p_meta ->> 'pwa')::boolean, left(p_meta ->> 'theme', 10),
          left(p_meta ->> 'ref', 100), left(p_meta ->> 'entry', 100))
  on conflict (sid) do update set last_at = now(), user_id = coalesce(visits.user_id, excluded.user_id),
    name = coalesce(visits.name, excluded.name);
  -- a visit that has logged thousands of pages is a runaway tab or a script: stop listening to it
  if (select pages from visits where sid = p_sid) > 2000 then return; end if;
  insert into page_views (sid, name, at, path, ms, load_ms, nav)
  select p_sid, n, to_timestamp((v ->> 't')::double precision / 1000), left(v ->> 'p', 100),
         least(greatest(coalesce((v ->> 'ms')::integer, 0), 0), 3600000),
         case when (v ->> 'lms') ~ '^\d{1,6}$' then least((v ->> 'lms')::integer, 120000) end,
         case when v ->> 'k' in ('cold', 'warm', 'nav', 'cache') then v ->> 'k' end
  from jsonb_array_elements(p_views) with ordinality x(v, i)
  where i <= 50 and v ->> 'p' like '/%' and (v ->> 't') ~ '^\d{13}$'
    -- shown within the last day (a clock far off, or a replay, is ignored)
    and to_timestamp((v ->> 't')::double precision / 1000) between now() - interval '1 day' and now() + interval '5 minutes'
  on conflict (sid, path, at) do update set ms = greatest(page_views.ms, excluded.ms),
    load_ms = coalesce(page_views.load_ms, excluded.load_ms), nav = coalesce(page_views.nav, excluded.nav);
  update visits set
    active_ms = (select coalesce(sum(ms), 0) from page_views where sid = p_sid),
    pages = (select count(*) from page_views where sid = p_sid),
    started_at = least(started_at, (select min(at) from page_views where sid = p_sid))
  where sid = p_sid;
exception when others then
  raise warning 'log_visit failed: %', sqlerrm;
end $$;

-- p50/p75/p90 page-show times for /admin, overall by kind and per page.
create function admin_speed(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  with v as (
    select path, nav, load_ms from page_views
    where load_ms is not null and at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))))
  select jsonb_build_object(
    'kinds', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(nav, '?') as kind, count(*) as n,
             percentile_cont(0.5) within group (order by load_ms)::int as p50,
             percentile_cont(0.75) within group (order by load_ms)::int as p75,
             percentile_cont(0.9) within group (order by load_ms)::int as p90
      from v group by 1) x),
    'pages', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select path, count(*) as n,
             percentile_cont(0.5) within group (order by load_ms)::int as p50,
             percentile_cont(0.9) within group (order by load_ms)::int as p90,
             (percentile_cont(0.5) within group (order by load_ms) filter (where nav in ('cold', 'warm')))::int as first_p50
      from v group by 1 order by count(*) desc limit 20) x))
$$;
revoke all on function admin_speed(integer) from public, anon, authenticated;

create or replace function admin_page(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select admin_stats(p_days) || jsonb_build_object('growth', admin_growth(p_days), 'speed', admin_speed(p_days))
$$;
