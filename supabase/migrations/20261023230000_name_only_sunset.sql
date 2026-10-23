-- Name-only sign-in ends at app_flags.legacy_until (Jack, 2026-10-23: "turn off name only in five days"):
-- midnight Pacific at the start of 2026-10-28. From then on, with no deploy needed:
--   - a name-only account can't play: every RPC (require_me) refuses it, so the app shows a
--     "link Google or email to keep playing" screen instead (bootstrap still answers);
--   - nobody can claim an old name by typing it any more (confirm_legacy_claim stops confirming);
--   - private leagues need a verified account (require_verified).
-- Linking is plain Supabase Auth (identities / email change), not an RPC, so a signed-in name-only player
-- can still save their account and history. Move the date with one update on app_flags.

alter table app_flags add column legacy_until timestamptz not null default '2026-10-28 07:00:00+00';

-- Is the name-only grace period still running?
create function legacy_open() returns boolean
language sql stable security definer set search_path = public as $$
  select legacy_logins and now() < legacy_until from app_flags
$$;

create or replace function require_me() returns text
language plpgsql stable security definer set search_path = public as $$
declare n text := me();
begin
  if n is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not legacy_open() and account_kind() = 'legacy' then
    raise exception 'name-only sign-in has ended: link Google or an email in Settings to keep playing'
      using errcode = '28000';
  end if;
  return n;
end $$;

create or replace function require_verified() returns void
language plpgsql stable security definer set search_path = public as $$
declare k text := account_kind();
begin
  if k = 'verified' or (k = 'legacy' and legacy_open()) then return; end if;
  raise exception 'sign in with Google or email to join private leagues' using errcode = '28000';
end $$;

create or replace function confirm_legacy_claim() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email like '%@players.reidle.app' and new.email_confirmed_at is null and legacy_open()
     and exists (select 1 from players where name = new.raw_user_meta_data ->> 'name' and user_id is null) then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;

-- bootstrap gains legacy_until (name-only players only): the banner counts down to it, then the app locks.
create or replace function bootstrap() returns jsonb
language sql stable security definer set search_path = public as $$
  with ctx as (select me() as n, lg() as l)
  select jsonb_build_object(
    'name', ctx.n,
    'played_today', played_today(ctx.n),
    'unread', coalesce(
      coalesce((select last_read from message_reads where league_id = ctx.l and name = ctx.n), 'epoch')
        < (select max(created_at) from messages where league_id = ctx.l), false),
    'pending_challenges', case when ctx.n is null or ctx.l is null then 0
      else (select count(*) from pending_challenge_ids(ctx.n)) end,
    'account', case when ctx.n is not null then account_kind() end,
    'legacy_until', case when ctx.n is not null and account_kind() = 'legacy'
      then (select case when legacy_logins then legacy_until else 'epoch' end from app_flags) end,
    'nickname_set', (select nickname_set from players where name = ctx.n),
    'tour_seen', (select tour_seen from players where name = ctx.n),
    'league', league_brief(ctx.l),
    'leagues', coalesce((select jsonb_agg(jsonb_build_object('id', x.league_id, 'name', x.name)
                                          order by m.joined_at, m.league_id)
                         from league_members m join leagues x using (league_id) where m.name = ctx.n), '[]'))
  from ctx
$$;

-- The signed-out sign-in page hides the name form once it's over.
create function name_sign_in_open() returns boolean
language sql stable security definer set search_path = public as $$ select legacy_open() $$;

revoke all on function legacy_open(), name_sign_in_open() from public, anon, authenticated;
grant execute on function name_sign_in_open() to anon, authenticated;
