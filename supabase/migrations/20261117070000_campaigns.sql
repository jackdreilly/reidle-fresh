-- Referral / ad tracking (Jack, 2026-11-16: "prepare to count referrals" for the Instagram ad, whose link carries
-- ?utm_source=instagram&utm_medium=paid&utm_campaign=launch).
-- index.html reads the utm_* tags from the landing URL before the router can rewrite it, and keeps the first tagged
-- visit for 30 days on the device. telemetry.ts sends both with every log_visit:
--   visits.utm       = this visit's landing tags, "source/medium/campaign" (a click on the tagged link)
--   visits.first_utm = the first tagged visit of the last 30 days on this device (so a sign-up on a later,
--                      untagged visit still counts toward the campaign)
-- admin_campaigns() -> /admin "Campaigns": per tag, the clicks, later visits, new players and how far they got.
-- Also brings back /admin "Speed", which admin_page dropped in 20261028050000.
alter table visits add column utm text, add column first_utm text;

create or replace function log_visit(p_sid uuid, p_views jsonb, p_meta jsonb default '{}') returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  n text := me();
begin
  if p_sid is null or jsonb_typeof(p_views) <> 'array' then return; end if;
  insert into visits (sid, user_id, name, device, pwa, theme, referrer, entry, utm, first_utm)
  values (p_sid, u, n, left(p_meta ->> 'device', 20), (p_meta ->> 'pwa')::boolean, left(p_meta ->> 'theme', 10),
          left(p_meta ->> 'ref', 100), left(p_meta ->> 'entry', 100),
          nullif(lower(left(p_meta ->> 'utm', 120)), ''), nullif(lower(left(p_meta ->> 'first_utm', 120)), ''))
  on conflict (sid) do update set last_at = now(), user_id = coalesce(visits.user_id, excluded.user_id),
    name = coalesce(visits.name, excluded.name), utm = coalesce(visits.utm, excluded.utm),
    first_utm = coalesce(visits.first_utm, excluded.first_utm);
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

create index visits_tag_idx on visits (started_at) where utm is not null or first_utm is not null;

-- One row per tag. A player belongs to the tag of the first tagged visit their account was on; they count as new
-- when the account was made at or after that visit (10 minutes' grace for clocks), else as already playing.
create function admin_campaigns(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pt constant text := 'America/Los_Angeles';
  today date := (now() at time zone pt)::date;
  since_ts timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return (
  with
  tagged as (select v.*, coalesce(v.utm, v.first_utm) as tag from visits v
             where v.started_at >= since_ts and coalesce(v.utm, v.first_utm) is not null),
  who as (select distinct on (p.name) p.name, p.created_at, t.tag, t.started_at as first_at
          from tagged t join players p on p.user_id = t.user_id order by p.name, t.started_at),
  pl as (select w.tag, w.name, w.created_at >= w.first_at - interval '10 minutes' as is_new, fp.at as first_play,
                fp.at is not null and exists (select 1 from submissions s where s.name = w.name
                  and (s.created_at at time zone pt)::date = (fp.at at time zone pt)::date + 1) as next_day,
                fp.at is not null and (fp.at at time zone pt)::date + 1 < today as could_next
         from who w
         left join lateral (select min(s.created_at) as at from submissions s
                            where s.name = w.name and s.created_at >= w.first_at - interval '10 minutes') fp on true),
  tags as (select tag from tagged group by tag)
  select coalesce(jsonb_agg(jsonb_build_object(
      'tag', g.tag,
      'clicks', (select count(*) from tagged t where t.tag = g.tag and t.utm = g.tag),
      'later_visits', (select count(*) from tagged t where t.tag = g.tag and t.utm is distinct from g.tag),
      'first_click', (select min(started_at) from tagged t where t.tag = g.tag),
      'new_players', (select count(*) from pl where pl.tag = g.tag and pl.is_new),
      'played', (select count(*) from pl where pl.tag = g.tag and pl.is_new and pl.first_play is not null),
      'next_day', (select count(*) from pl where pl.tag = g.tag and pl.is_new and pl.next_day),
      'could_next', (select count(*) from pl where pl.tag = g.tag and pl.is_new and pl.could_next),
      'existing_players', (select count(*) from pl where pl.tag = g.tag and not pl.is_new),
      'names', (select coalesce(jsonb_agg(pl.name order by pl.name), '[]') from pl where pl.tag = g.tag and pl.is_new))
    order by g.tag), '[]')
  from tags g);
end $$;
revoke all on function admin_campaigns(integer) from public, anon, authenticated;

create or replace function admin_page(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select admin_stats(p_days) || jsonb_build_object('growth', admin_growth(p_days), 'speed', admin_speed(p_days),
    'campaigns', admin_campaigns(p_days),
    'asks', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'question', a.question, 'answer', a.answer,
                                                          'ms', a.ms, 'at', a.created_at, 'tools', a.tools) order by a.created_at desc)
                      from (select * from ask_log order by created_at desc limit 100) a), '[]'),
    'asks_7d', (select count(*) from ask_log where created_at > now() - interval '7 days'))
$$;
