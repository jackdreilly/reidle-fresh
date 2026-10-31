-- Reidle OG (league 1) had daily_words set for every day into 2027, imported from the legacy app. Jack, 2026-10-31:
-- "We don't need og reidle future days anymore it's just like any other league now." Drop every row after a league's
-- current day, so its words are drawn on the day (ensure_daily_word) from the current pool, like every other league.
delete from daily_words where day > league_day(league_id);
