# Bug Tracker

Updated: 2026-09-26

## Reported Issues

| Status | Issue | Fix / verification |
| --- | --- | --- |
| Done | Sign-in hangs after choosing a player name | Sign-in response now sets the name cookie. Verified `303` + `Set-Cookie`, then authenticated redirect reaches the app. |
| Done locally | `/messages` failed with `handler is not a function` | Root cause was missing `messages.likes`; the middleware also retried `ctx.next()` after a route exception. Middleware/read fallback fixed; local schema repaired; `/messages` returns `200`. Alembic migration is included for other databases. |
| Done locally | Submission crashed because `submissions.submission_id` had no default | Added ID sequence setup to the migration and repaired local Postgres. Verified `INSERT ... RETURNING submission_id` in a rolled-back transaction. |
| Done | Timer overflow / poor stopwatch icon | `TimerText` is non-wrapping with tabular digits; game timer uses Tabler Clock and a stable-width capsule. Checked on mobile and desktop screenshots. |
| Done | Desktop content had no clearance beside drawer | Main content padding now leaves 16px after the fixed 240px drawer. Confirmed computed layout at 1440px. |
| Done | Mobile bottom tabs overlapped each other and the game keyboard | Tab icons and labels have separate fixed rows; fullscreen play reserves bottom-nav space. Verified on a mobile screenshot. |
| Pending visual check | Confetti was right-shifted, tiny, and confined to the board | Overlay now spans the usable viewport (excluding header, bottom tabs, and drawer); pieces are larger, more saturated, and spread wider. Deno check passes; a screenshot while the game is in its won state is still needed. |
| Done | Navigation icons/tagline/play glyph were inconsistent | Replaced shell SVGs with Tabler icons, removed the “Competitive Wordle” tagline, and replaced the lightning emoji with a labeled play icon. |
| Done | Challenge landing “Start New Challenge” action appeared missing | CTA was white-on-white because the emerald utility rule was absent. Added explicit emerald/white colors; verified in a mobile screenshot. |
| Done | Preact warned about challenge table row nesting | Wrapped challenge rows in the existing `TableBody`; the subsequent `/challenges` request produced no table-nesting warnings. |

| Done | Mobile leaderboard overflowed and replay was hard to reach | Compact columns fit the viewport. The Guess grid is now the replay link with a fixed subtle play marker; the grid shrinks with guess count and caps at 28px. Verified no horizontal overflow. |
| Done | Current player was hard to spot and the “You” badge was redundant | Removed the badge and retained the subtle green row highlight with an explicit background color. |
| Done | Mobile app bars showed content through their backgrounds | Both fixed bars have explicit opaque white backgrounds. |
| Done | Completed players saw a “Done” pill in the top bar | The top Play callout appears only before the daily game is played; the completed state has no replacement pill. Bottom Play remains disabled and Practice remains available. |
| Done | Experience navigation lacked color cues | Added distinct restrained Tabler stroke colors for Play, Practice, Stats, Battles, Challenges, and Messages. |
| Done locally | Test data lacked realistic daily/challenge history | Added an opt-in deterministic fixture with 8 irregular core players and 100 sparse users. Seeded locally with 11,486 daily and 11,486 challenge submissions; verified rerun counts. |
| Done | Weekly leaderboard exceeded mobile width | Fixed the compact board columns and shortened long weekly times to whole minutes from 10 minutes onward, preserving exact time in the title. Verified it fits at 390px. |
| Done | Player profile was chart-heavy and average-sensitive | Replaced it with median solve, interquartile range, active days, podium rate, and a 12-week activity strip scaled to a percentile. Added solve-time bins trimmed to the 5th–95th percentile and bounded rank bins. Checked mobile, desktop, and no-history states. |

## Deployment Note

Run `uv sync --locked` and `.venv/bin/alembic upgrade head` against each non-local database to add message likes and restore generated submission IDs. The migration has been applied locally. Run the opt-in fixture command from the README after migration to generate synthetic history.
