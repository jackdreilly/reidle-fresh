-- Settings page tells the owner they can open /admin (Jack, 2026-10-24: "Add an admin button for Jack on profile
-- page"). Same check as the admin pages themselves: is_admin() (in `admins` AND a verified login).
create or replace function settings_page() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', n, 'admin', is_admin(), 'prefs', jsonb_build_object(
      'chat', coalesce(p.chat, true), 'results', coalesce(p.results, false), 'beaten', coalesce(p.beaten, false),
      'challenges', coalesce(p.challenges, false), 'new_day', coalesce(p.new_day, false),
      'recap', coalesce(p.recap, false), 'reminder_before', p.reminder_before))
  from require_me() n left join notify_prefs p on p.name = n
$$;
