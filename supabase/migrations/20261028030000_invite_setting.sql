-- Who can see a league's invite link: every member ("open invite", the default) or commissioners only.
alter table leagues add column open_invite boolean not null default true;

-- + open_invite; the invite code only for commissioners when the league is closed (public leagues stay open)
create or replace function league_page() returns jsonb
language sql stable security definer set search_path = public as $$
  with x as (
    select l.*, exists (select 1 from league_members m where m.league_id = l.league_id
                        and m.name = me() and m.role = 'commissioner') as boss
    from leagues l where l.league_id = require_league())
  select league_brief(x.league_id) || jsonb_build_object(
    'invite_code', case when x.open_invite or x.is_public or x.boss then x.invite_code end,
    'open_invite', x.open_invite,
    'created_by', x.created_by,
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'role', m.role, 'joined_at', m.joined_at)
                                          order by m.role, m.name)
                         from league_members m where m.league_id = x.league_id), '[]'),
    'banned', case when x.boss
                   then coalesce((select jsonb_agg(b.name order by b.name) from league_bans b
                                  where b.league_id = x.league_id), '[]') end)
  from x
$$;

-- Commissioner: change any of name, tz, reset_hour, scoring, open_invite; {"new_invite": true} makes a fresh link.
create or replace function update_league(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  l bigint := require_league();
  sc jsonb := p -> 'scoring';
begin
  perform require_commissioner(l);
  if p ? 'tz' and not exists (select 1 from pg_timezone_names where name = p ->> 'tz') then
    raise exception 'unknown timezone %', p ->> 'tz' using errcode = '22023';
  end if;
  if sc is not null and not (
       coalesce(sc ->> 'mode', 'table') in ('table', 'field')
       and (sc -> 'points' is null or (jsonb_typeof(sc -> 'points') = 'array'
            and jsonb_array_length(sc -> 'points') between 1 and 30
            and not exists (select 1 from jsonb_array_elements(sc -> 'points') e
                            where jsonb_typeof(e) <> 'number' or abs(e::text::numeric) > 1000)))
       and (sc ->> 'no_show' is null or abs((sc ->> 'no_show')::numeric) <= 1000)
       and (sc ->> 'best_of' is null or (sc ->> 'best_of')::int between 1 and 7)) then
    raise exception 'invalid scoring settings' using errcode = '22023';
  end if;
  update leagues set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    tz = coalesce(p ->> 'tz', tz),
    reset_hour = coalesce((p ->> 'reset_hour')::int, reset_hour),
    open_invite = coalesce((p ->> 'open_invite')::boolean, open_invite),
    scoring = case when sc is null then scoring else jsonb_build_object(
      'mode', coalesce(sc ->> 'mode', 'table'),
      'points', coalesce(sc -> 'points', scoring -> 'points'),
      'no_show', coalesce((sc ->> 'no_show')::numeric, 0),
      'best_of', (sc ->> 'best_of')::int) end,
    invite_code = case when (p ->> 'new_invite')::boolean
                       then substr(md5(random()::text || clock_timestamp()::text), 1, 10) else invite_code end
  where league_id = l;
  -- results memoised under the old settings
  if sc is not null then
    delete from winners where league_id = l and week >= week_start(league_day(l) - 7)
      and (l <> 1 or week >= scoring_cutover());
  end if;
  return league_page();
end $$;
