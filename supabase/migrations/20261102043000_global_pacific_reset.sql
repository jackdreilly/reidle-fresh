-- Reidle Global resets at midnight Pacific (America/Los_Angeles, so it follows DST), like Reidle OG. Jack, 2026-11-02:
-- "Change reidle global to pst midnight reset". Days already played keep their word and plays; the day that already
-- started in UTC simply begins again at the next Pacific midnight.
update leagues set tz = 'America/Los_Angeles', reset_hour = 0 where league_id = 2;
