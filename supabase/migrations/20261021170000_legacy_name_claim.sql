-- Name-only sign-in now that emails must be confirmed: a name-only account (made-up @players.reidle.app
-- email) is confirmed on creation only when it claims an existing, unclaimed player name, e.g. a player
-- imported from before logins existed. Brand-new names get no confirmed account (they sign in with Google,
-- email or as a guest).
create function confirm_legacy_claim() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email like '%@players.reidle.app' and new.email_confirmed_at is null
     and exists (select 1 from players where name = new.raw_user_meta_data ->> 'name' and user_id is null) then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;

create trigger confirm_legacy_claim before insert on auth.users
  for each row execute function confirm_legacy_claim();

revoke execute on function confirm_legacy_claim() from public, anon, authenticated;
