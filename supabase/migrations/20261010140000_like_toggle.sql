-- Liking a message you already liked takes the like back (the Messages page's like pill is a toggle).
create or replace function like_message(p_id integer) returns void
language sql volatile security definer set search_path = public as $$
  update messages set likes = case when require_me() = any (likes) then array_remove(likes, require_me())
                                   else array_append(likes, require_me()) end
  where message_id = p_id
$$;
