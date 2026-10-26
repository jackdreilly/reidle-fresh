-- Run after signin.cjs: pretend the demo accounts linked Google, so the "Lock your name" banner stays away.
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
select 'g-' || id, id, jsonb_build_object('sub', 'g-' || id), 'google', now(), now() from auth.users
on conflict do nothing;
