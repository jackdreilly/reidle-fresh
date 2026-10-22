-- Commissioners can ban a player: out of the league, and the invite link no longer lets them back in.
create table league_bans (
  league_id bigint not null references leagues on delete cascade,
  name text not null references players (name) on update cascade on delete cascade,
  banned_by text,
  banned_at timestamptz not null default now(),
  primary key (league_id, name)
);
alter table league_bans enable row level security;

create or replace function set_member(p_name text, p_role text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare l bigint := require_league(); n text;
begin
  n := require_commissioner(l);
  if p_role in ('remove', 'ban') then
    if p_name = n then raise exception 'use leave instead' using errcode = '22023'; end if;
    delete from league_members where league_id = l and name = p_name;
    if p_role = 'ban' then
      insert into league_bans (league_id, name, banned_by) values (l, p_name, n) on conflict do nothing;
    end if;
  elsif p_role = 'unban' then
    delete from league_bans where league_id = l and name = p_name;
  elsif p_role in ('commissioner', 'member') then
    update league_members set role = p_role where league_id = l and name = p_name;
    if not exists (select 1 from league_members where league_id = l and role = 'commissioner') then
      raise exception 'a league needs a commissioner' using errcode = '22023';
    end if;
  else
    raise exception 'unknown role %', p_role using errcode = '22023';
  end if;
  return league_page();
end $$;

-- + banned players, for commissioners only
create or replace function league_page() returns jsonb
language sql stable security definer set search_path = public as $$
  select league_brief(l.league_id) || jsonb_build_object(
    'invite_code', l.invite_code,
    'created_by', l.created_by,
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', m.name, 'role', m.role, 'joined_at', m.joined_at)
                                          order by m.role, m.name)
                         from league_members m where m.league_id = l.league_id), '[]'),
    'banned', case when exists (select 1 from league_members m where m.league_id = l.league_id
                                and m.name = me() and m.role = 'commissioner')
                   then coalesce((select jsonb_agg(b.name order by b.name) from league_bans b
                                  where b.league_id = l.league_id), '[]') end)
  from leagues l where l.league_id = require_league()
$$;

create or replace function join_league(p_code text) returns bigint
language plpgsql volatile security definer set search_path = public as $$
declare
  n text := require_me();
  lgr leagues;
begin
  select * into lgr from leagues where invite_code = lower(btrim(p_code));
  if not found then raise exception 'that invite link is no longer valid' using errcode = 'P0002'; end if;
  if exists (select 1 from league_bans where league_id = lgr.league_id and name = n) then
    raise exception 'you can''t join %', lgr.name using errcode = '42501';
  end if;
  if not lgr.is_public then perform require_verified(); end if;
  insert into league_members (league_id, name) values (lgr.league_id, n) on conflict do nothing;
  return lgr.league_id;
end $$;
