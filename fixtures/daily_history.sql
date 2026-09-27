\if :{?confirm_fixture_seed}
\else
\echo "Set -v confirm_fixture_seed=1 to replace fixture_* daily submissions."
\quit
\endif

-- Run with:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v confirm_fixture_seed=1 -f fixtures/daily_history.sql
-- Only reserved fixture_* players and challenge IDs tracked by this fixture are touched.
BEGIN;

CREATE TABLE IF NOT EXISTS reidle_fixture_challenges (
    challenge_id INTEGER PRIMARY KEY
);

INSERT INTO players (name, created_at)
SELECT player_name, CURRENT_DATE - INTERVAL '5 years'
FROM (
    SELECT unnest(ARRAY[
        'fixture_ava',
        'fixture_ben',
        'fixture_cleo',
        'fixture_drew',
        'fixture_ella',
        'fixture_finn',
        'fixture_gray',
        'fixture_hope'
    ]) AS player_name
    UNION ALL
    SELECT 'fixture_' || LPAD(tail_no::TEXT, 3, '0')
    FROM generate_series(1, 100) AS tails(tail_no)
) AS fixture_players
ON CONFLICT (name) DO NOTHING;

DELETE FROM submissions
WHERE challenge_id IS NULL
  AND name LIKE 'fixture\_%' ESCAPE '\';

DELETE FROM submissions
USING reidle_fixture_challenges
WHERE submissions.challenge_id = reidle_fixture_challenges.challenge_id;

DELETE FROM challenges
USING reidle_fixture_challenges
WHERE challenges.challenge_id = reidle_fixture_challenges.challenge_id;

DELETE FROM reidle_fixture_challenges;

WITH core_players (player_no, name) AS (
    VALUES
        (1, 'fixture_ava'),
        (2, 'fixture_ben'),
        (3, 'fixture_cleo'),
        (4, 'fixture_drew'),
        (5, 'fixture_ella'),
        (6, 'fixture_finn'),
        (7, 'fixture_gray'),
        (8, 'fixture_hope')
),
tail_players AS (
    SELECT
        100 + tail_no AS player_no,
        'fixture_' || LPAD(tail_no::TEXT, 3, '0') AS name
    FROM generate_series(1, 100) AS tails(tail_no)
),
fixture_players AS (
    SELECT player_no, name, true AS core_player FROM core_players
    UNION ALL
    SELECT player_no, name, false AS core_player FROM tail_players
),
fixture_days AS (
    SELECT
        generated_day::DATE AS day,
        generated_day::DATE - DATE '2000-01-01' AS day_no
    FROM generate_series(
        CURRENT_DATE - INTERVAL '5 years',
        CURRENT_DATE,
        INTERVAL '1 day'
    ) AS generated_days(generated_day)
),
plays AS (
    SELECT
        fixture_days.day,
        fixture_days.day_no,
        fixture_players.player_no,
        fixture_players.name,
        fixture_players.core_player,
        (ARRAY[
            'CIGAR', 'REBUT', 'SISSY', 'HUMPH', 'AWAKE',
            'BLUSH', 'FOCAL', 'EVADE', 'NAVAL', 'SERVE'
        ])[MOD(fixture_days.day_no + fixture_players.player_no, 10) + 1] AS word,
        40 + MOD(fixture_days.day_no * 17 + fixture_players.player_no * 31, 180)
            AS solve_seconds,
        CASE
            WHEN MOD(fixture_days.day_no + fixture_players.player_no, 9) = 0
                THEN 5
            ELSE 0
        END AS penalty,
        3 + MOD(fixture_days.day_no + fixture_players.player_no, 4) AS guesses
    FROM fixture_days
    CROSS JOIN fixture_players
    WHERE CASE
        WHEN fixture_players.core_player THEN
            MOD(
                fixture_days.day_no * 37 + fixture_players.player_no * 101,
                100
            ) < 55 + MOD(fixture_players.player_no * 13, 36)
        ELSE
            MOD(
                fixture_days.day_no + fixture_players.player_no * 97,
                120 + MOD(fixture_players.player_no * 31, 260)
            ) = 0
    END
),
ranked_plays AS (
    SELECT
        plays.*,
        ROW_NUMBER() OVER (
            PARTITION BY day
            ORDER BY solve_seconds, player_no
        )::INTEGER AS daily_rank
    FROM plays
)
INSERT INTO submissions (
    day,
    name,
    time,
    penalty,
    playback,
    word,
    paste,
    score,
    "rank",
    created_at
)
SELECT
    day,
    name,
    solve_seconds,
    penalty,
    json_build_object(
        'events', (
            SELECT json_agg(events.event ORDER BY events.event_no)
            FROM (
                SELECT
                    character_no AS event_no,
                    json_build_object(
                        'time', character_no * 250,
                        'letter', SUBSTRING(ranked_plays.word FROM character_no FOR 1)
                    ) AS event
                FROM generate_series(1, 5) AS characters(character_no)
                UNION ALL
                SELECT
                    6 AS event_no,
                    json_build_object(
                        'time', ranked_plays.solve_seconds * 1000,
                        'score', (
                            SELECT json_agg(
                                json_build_object(
                                    'letter', SUBSTRING(ranked_plays.word FROM score_letters.letter_no FOR 1),
                                    'score', 0
                                )
                                ORDER BY score_letters.letter_no
                            )
                            FROM generate_series(1, 5) AS score_letters(letter_no)
                        )
                    ) AS event
            ) AS events
        )
    ),
    word,
    REPEAT('⬜⬜⬜⬜⬜' || E'\n', guesses - 1) || '🟩🟩🟩🟩🟩',
    LEAST(daily_rank, 9),
    daily_rank,
    day::TIMESTAMP + solve_seconds * INTERVAL '1 second'
FROM ranked_plays;

WITH fixture_days AS (
    SELECT
        generated_day::DATE AS day,
        generated_day::DATE - DATE '2000-01-01' AS day_no
    FROM generate_series(
        CURRENT_DATE - INTERVAL '5 years',
        CURRENT_DATE,
        INTERVAL '1 day'
    ) AS generated_days(generated_day)
),
created_challenges AS (
    INSERT INTO challenges (starting_word, answer, created_at)
    SELECT
        (
            SELECT word
            FROM words
            ORDER BY word
            OFFSET MOD(fixture_days.day_no, (SELECT COUNT(*) FROM words))
            LIMIT 1
        ),
        (
            SELECT answer
            FROM answers
            ORDER BY answer
            OFFSET MOD(fixture_days.day_no, (SELECT COUNT(*) FROM answers))
            LIMIT 1
        ),
        fixture_days.day::TIMESTAMP + INTERVAL '12 hours'
    FROM fixture_days
    RETURNING challenge_id
)
INSERT INTO reidle_fixture_challenges (challenge_id)
SELECT challenge_id FROM created_challenges;

WITH core_players (player_no, name) AS (
    VALUES
        (1, 'fixture_ava'),
        (2, 'fixture_ben'),
        (3, 'fixture_cleo'),
        (4, 'fixture_drew'),
        (5, 'fixture_ella'),
        (6, 'fixture_finn'),
        (7, 'fixture_gray'),
        (8, 'fixture_hope')
),
tail_players AS (
    SELECT
        100 + tail_no AS player_no,
        'fixture_' || LPAD(tail_no::TEXT, 3, '0') AS name
    FROM generate_series(1, 100) AS tails(tail_no)
),
fixture_players AS (
    SELECT player_no, name, true AS core_player FROM core_players
    UNION ALL
    SELECT player_no, name, false AS core_player FROM tail_players
),
challenge_plays AS (
    SELECT
        challenges.challenge_id,
        fixture_days.day,
        fixture_players.player_no,
        fixture_players.name,
        challenges.answer AS word,
        45 + MOD(
            fixture_days.day_no * 19 + fixture_players.player_no * 23,
            210
        ) AS solve_seconds,
        CASE
            WHEN MOD(fixture_days.day_no + fixture_players.player_no, 11) = 0
                THEN 5
            ELSE 0
        END AS penalty,
        3 + MOD(fixture_days.day_no + fixture_players.player_no + 1, 4) AS guesses
    FROM generate_series(
        CURRENT_DATE - INTERVAL '5 years',
        CURRENT_DATE,
        INTERVAL '1 day'
    ) AS generated_days(generated_day)
    CROSS JOIN fixture_players
    JOIN challenges
      ON challenges.created_at::DATE = generated_day::DATE
     AND challenges.challenge_id IN (
        SELECT challenge_id FROM reidle_fixture_challenges
     )
    CROSS JOIN LATERAL (
        SELECT
            generated_day::DATE AS day,
            generated_day::DATE - DATE '2000-01-01' AS day_no
    ) AS fixture_days
    WHERE CASE
        WHEN fixture_players.core_player THEN
            MOD(
                fixture_days.day_no * 37 + fixture_players.player_no * 101,
                100
            ) < 55 + MOD(fixture_players.player_no * 13, 36)
        ELSE
            MOD(
                fixture_days.day_no + fixture_players.player_no * 97,
                120 + MOD(fixture_players.player_no * 31, 260)
            ) = 0
    END
),
ranked_challenge_plays AS (
    SELECT
        challenge_plays.*,
        ROW_NUMBER() OVER (
            PARTITION BY challenge_id
            ORDER BY solve_seconds, player_no
        )::INTEGER AS challenge_rank
    FROM challenge_plays
)
INSERT INTO submissions (
    day,
    name,
    time,
    penalty,
    playback,
    word,
    paste,
    score,
    "rank",
    challenge_id,
    created_at
)
SELECT
    day,
    name,
    solve_seconds,
    penalty,
    json_build_object(
        'events', (
            SELECT json_agg(events.event ORDER BY events.event_no)
            FROM (
                SELECT
                    character_no AS event_no,
                    json_build_object(
                        'time', character_no * 250,
                        'letter', SUBSTRING(ranked_challenge_plays.word FROM character_no FOR 1)
                    ) AS event
                FROM generate_series(1, 5) AS characters(character_no)
                UNION ALL
                SELECT
                    6 AS event_no,
                    json_build_object(
                        'time', ranked_challenge_plays.solve_seconds * 1000,
                        'score', (
                            SELECT json_agg(
                                json_build_object(
                                    'letter', SUBSTRING(ranked_challenge_plays.word FROM score_letters.letter_no FOR 1),
                                    'score', 0
                                )
                                ORDER BY score_letters.letter_no
                            )
                            FROM generate_series(1, 5) AS score_letters(letter_no)
                        )
                    ) AS event
            ) AS events
        )
    ),
    word,
    REPEAT('⬜⬜⬜⬜⬜' || E'\n', guesses - 1) || '🟩🟩🟩🟩🟩',
    LEAST(challenge_rank, 9),
    challenge_rank,
    challenge_id,
    day::TIMESTAMP + solve_seconds * INTERVAL '1 second'
FROM ranked_challenge_plays;

SELECT
    COUNT(*) FILTER (WHERE challenge_id IS NULL) AS daily_submissions,
    COUNT(*) FILTER (WHERE challenge_id IS NOT NULL) AS challenge_submissions,
    COUNT(DISTINCT name) AS seeded_players,
    COUNT(DISTINCT challenge_id) FILTER (WHERE challenge_id IS NOT NULL) AS challenges,
    MIN(day) AS first_day,
    MAX(day) AS last_day
FROM submissions
WHERE name LIKE 'fixture\_%' ESCAPE '\'
   OR challenge_id IN (SELECT challenge_id FROM reidle_fixture_challenges);

COMMIT;
