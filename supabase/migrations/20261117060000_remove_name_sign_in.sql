-- Name-only sign-in is gone from the app (Jack, 2026-11-17). It already stopped working at app_flags.legacy_until
-- (2026-10-28); this removes what was left of it. Old name-only accounts keep their data: one still signed in on a
-- device still lands on /save-account (require_me / legacy_open are unchanged) to link Google or an email.

-- The sign-in page no longer asks whether to show a name form.
drop function name_sign_in_open();

-- Nothing confirms a made-up @players.reidle.app sign-up any more (it was a no-op since the cutoff).
drop trigger confirm_legacy_claim on auth.users;
drop function confirm_legacy_claim();

-- A sign-up's `name` metadata used to pick (or claim, if unclaimed) that exact player. Only an old-style name
-- account (its made-up @players.reidle.app email, as tools/sync-auth-users.ts and the tests create) may still do
-- that. Everyone else gets an auto-assigned nickname to change: an email sign-up can no longer claim an old
-- player's history by passing its name, and Google sign-ups (whose metadata carries the person's full name)
-- now get a nickname like other new players instead of their full name.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  want text := case when new.email like '%@players.reidle.app' then new.raw_user_meta_data ->> 'name' end;
  nm text;
begin
  if want is not null then
    insert into players (name, user_id)
    values (want, new.id)
    on conflict (name) do update set user_id = excluded.user_id
      where players.user_id is null;
    if not exists (select 1 from league_members where name = want) then
      insert into league_members (league_id, name) values (2, want) on conflict do nothing;
    end if;
  else
    nm := pick_nickname(coalesce(new.raw_user_meta_data ->> 'preferred_username',
                                 new.raw_user_meta_data ->> 'full_name',
                                 split_part(new.email, '@', 1)),
                        coalesce(new.is_anonymous, false));
    insert into players (name, user_id, nickname_set) values (nm, new.id, false);
    if coalesce(new.is_anonymous, false) then
      insert into league_members (league_id, name) values (2, nm);
    end if;
  end if;
  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;
