-- Contact Jack (Jack, 2026-10-28: "I just want new users to have some way of contacting me"): a private, ongoing
-- conversation between each player and the owner. Players write from /contact; the owner reads and answers from
-- the Inbox on /admin. Both directions push (player -> every admin, reply -> the player), and bootstrap() carries the
-- unread state so the menu can show a dot without another call.
--   feedback          one row per message (from_jack marks the owner's replies)
--   feedback_threads  one row per player: read marks for both sides, done flag, optional email for a reply by mail
-- Uses me() rather than require_me(): a name-only account locked out by the sunset can still ask for help.

create table feedback (
  id bigint generated always as identity primary key,
  name text not null references players (name) on update cascade on delete cascade,
  from_jack boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  league_id bigint references leagues (league_id) on delete set null,
  path text check (char_length(path) <= 200),
  device text check (char_length(device) <= 40),
  created_at timestamptz not null default now()
);
create index feedback_name_at on feedback (name, created_at);

create table feedback_threads (
  name text primary key references players (name) on update cascade on delete cascade,
  email text check (char_length(email) <= 200),
  last_at timestamptz not null default now(),
  player_seen_at timestamptz,
  jack_seen_at timestamptz,
  done boolean not null default false
);

alter table feedback enable row level security;
alter table feedback_threads enable row level security;
revoke all on feedback, feedback_threads from anon, authenticated;

-- One conversation, oldest first.
create function feedback_messages(p_name text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'from_jack', f.from_jack, 'body', f.body, 'created_at', f.created_at,
      'path', f.path, 'device', f.device, 'league', l.name) order by f.created_at, f.id), '[]')
  from feedback f left join leagues l using (league_id) where f.name = p_name
$$;

-- Player side ---------------------------------------------------------------------------------------------

-- /contact: the conversation; opening it reads Jack's replies (clears the dot everywhere).
create function contact_page() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n text := me();
begin
  if n is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update feedback_threads set player_seen_at = now() where name = n;
  return jsonb_build_object('messages', feedback_messages(n),
    'email', (select email from feedback_threads where name = n),
    'account', account_kind());
end $$;

create function send_feedback(p_body text, p_path text default null, p_device text default null, p_email text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n text := me();
  b text := btrim(p_body);
  l bigint := lg();
  e text := nullif(btrim(coalesce(p_email, '')), '');
  f feedback;
begin
  if n is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if coalesce(b, '') = '' then raise exception 'Write a message first'; end if;
  if char_length(b) > 2000 then raise exception 'That message is too long (2000 characters at most)'; end if;
  if e is not null and e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email address doesn''t look right'; end if;
  if (select count(*) from feedback where name = n and not from_jack and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s a lot of messages for one day. Jack will get back to you soon.';
  end if;
  insert into feedback (name, body, league_id, path, device)
  values (n, b, l, left(p_path, 200), left(p_device, 40)) returning * into f;
  -- a new message reopens a conversation marked done; writing also means they've seen everything so far
  insert into feedback_threads as t (name, email, last_at, player_seen_at)
  values (n, e, f.created_at, f.created_at)
  on conflict (name) do update set last_at = excluded.last_at, player_seen_at = excluded.player_seen_at, done = false,
    email = coalesce(excluded.email, t.email);
  perform push_enqueue(array(select a.name from admins a where a.name <> n),
    '✉️ ' || n || ' (' || coalesce(account_kind(), '?') || coalesce(', ' || (select name from leagues where league_id = l), '') || ')',
    left(b, 180), '/admin/inbox/' || n, 'feedback-' || n);
  return jsonb_build_object('id', f.id, 'from_jack', false, 'body', f.body, 'created_at', f.created_at,
    'path', f.path, 'device', f.device);
end $$;

-- Owner side ----------------------------------------------------------------------------------------------

-- Every conversation, waiting-on-Jack first, then newest.
create function admin_inbox() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'name', t.name, 'last_at', t.last_at, 'done', t.done, 'email', t.email,
        'body', last.body, 'from_jack', last.from_jack,
        'unread', (select count(*) from feedback f where f.name = t.name and not f.from_jack
                   and f.created_at > coalesce(t.jack_seen_at, 'epoch')),
        'login', (select coalesce(login_method(u), 'no login yet') from players p left join auth.users u on u.id = p.user_id
                  where p.name = t.name))
      order by (not t.done and not last.from_jack) desc, t.last_at desc)
    from feedback_threads t
    cross join lateral (select f.body, f.from_jack from feedback f where f.name = t.name
                        order by f.created_at desc, f.id desc limit 1) last), '[]');
end $$;

-- One conversation plus who the player is; opening it marks their messages read.
create function admin_feedback(p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare t feedback_threads;
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  update feedback_threads set jack_seen_at = now() where name = p_name returning * into t;
  if t.name is null then raise exception 'no conversation with %', p_name; end if;
  return jsonb_build_object('name', t.name, 'email', t.email, 'done', t.done, 'player_seen_at', t.player_seen_at,
    'messages', feedback_messages(t.name),
    'player', (
      select jsonb_build_object('joined', p.created_at, 'login', coalesce(login_method(u), 'no login yet'),
        'leagues', coalesce((select jsonb_agg(x.name order by m.joined_at) from league_members m join leagues x using (league_id)
                             where m.name = p.name), '[]'),
        'games', (select count(*) from submissions s where s.name = p.name),
        'last_game', (select max(s.created_at) from submissions s where s.name = p.name))
      from players p left join auth.users u on u.id = p.user_id where p.name = t.name));
end $$;

create function admin_reply(p_name text, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  b text := btrim(p_body);
  f feedback;
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if coalesce(b, '') = '' then raise exception 'Write a reply first'; end if;
  if not exists (select 1 from feedback_threads where name = p_name) then raise exception 'no conversation with %', p_name; end if;
  insert into feedback (name, from_jack, body) values (p_name, true, b) returning * into f;
  update feedback_threads set last_at = f.created_at, jack_seen_at = f.created_at where name = p_name;
  perform push_enqueue(array[p_name], '✉️ Jack replied', left(b, 180), '/contact', 'contact-' || p_name);
  return jsonb_build_object('id', f.id, 'from_jack', true, 'body', f.body, 'created_at', f.created_at);
end $$;

create function admin_feedback_done(p_name text, p_done boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  update feedback_threads set done = p_done, jack_seen_at = now() where name = p_name;
end $$;

-- /admin loads the inbox with everything else (still one call).
create or replace function admin_page(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select admin_stats(p_days) || jsonb_build_object('growth', admin_growth(p_days), 'inbox', admin_inbox())
$$;

-- The shell's state gains the two dots:
--   contact_unread: when Jack's newest unread reply was sent (null = nothing new), so a dismissed banner stays dismissed
--   inbox: for admins, how many conversations have unread messages (null for everyone else)
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
    -- after their first finished game, until they answer it once (or set a reminder in Settings)
    'reminder_prompt', (select not p.reminder_prompt_seen
                          and exists (select 1 from submissions s where s.name = p.name)
                          and not exists (select 1 from notify_prefs np where np.name = p.name and np.reminder_before is not null)
                        from players p where p.name = ctx.n),
    'contact_unread', (select max(f.created_at) from feedback f join feedback_threads t using (name)
                       where f.name = ctx.n and f.from_jack and f.created_at > coalesce(t.player_seen_at, 'epoch')),
    'inbox', case when ctx.n is not null and exists (select 1 from admins where name = ctx.n) and is_admin() then
      (select count(*) from feedback_threads t where not t.done and exists (
         select 1 from feedback f where f.name = t.name and not f.from_jack and f.created_at > coalesce(t.jack_seen_at, 'epoch')))
      end,
    'league', league_brief(ctx.l),
    'leagues', coalesce((select jsonb_agg(jsonb_build_object('id', x.league_id, 'name', x.name)
                                          order by m.joined_at, m.league_id)
                         from league_members m join leagues x using (league_id) where m.name = ctx.n), '[]'))
  from ctx
$$;

revoke all on function feedback_messages(text), contact_page(), send_feedback(text, text, text, text), admin_inbox(),
  admin_feedback(text), admin_reply(text, text), admin_feedback_done(text, boolean) from public, anon, authenticated;
grant execute on function contact_page(), send_feedback(text, text, text, text), admin_feedback(text), admin_reply(text, text),
  admin_feedback_done(text, boolean) to authenticated;
