"""Seed local dev data: players, a fake week of submissions, and the word lists.

Usage:
    .venv/bin/python scripts/seed_local_data.py

Reads `static/words.csv` and `static/answers.csv` for the word/answer/daily word
tables. Current week is seeded with decreasing participation so the additive
weekly scoring (`Σ`) can be exercised; previous week is a full legacy week
(`Π`). Also seeds daily_words for the surrounding weeks so /play works.
"""

import datetime

import psycopg2

DSN = "postgres://postgres:postgres@localhost:5432/postgres"
PLAYERS = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi"]
BASE_TIMES = [30, 40, 50, 60, 70, 80, 90, 100]

conn = psycopg2.connect(DSN)
cur = conn.cursor()


def seed_words() -> None:
    words = [w.upper() for w in open("static/words.csv").read().split() if w]
    answers = [
        a.upper() for a in open("static/answers.csv").read().split() if a
    ]
    cur.execute("TRUNCATE daily_words, words, answers RESTART IDENTITY CASCADE")
    cur.executemany(
        "INSERT INTO words (word) VALUES (%s) ON CONFLICT DO NOTHING",
        [(w,) for w in words],
    )
    cur.executemany(
        "INSERT INTO answers (answer) VALUES (%s) ON CONFLICT DO NOTHING",
        [(a,) for a in answers],
    )
    today = datetime.date.today()
    rows = []
    for offset in range(-14, 7):
        day = today + datetime.timedelta(days=offset)
        i = offset + 14
        w = words[(i * 137) % len(words)]
        a = answers[(i * 71) % len(answers)]
        if w == a:
            w = words[(i * 137 + 1) % len(words)]
        rows.append((day, w, a))
    cur.executemany(
        "INSERT INTO daily_words (day, word, answer) VALUES (%s, %s, %s)",
        rows,
    )
    print(f"seeded {len(words)} words, {len(answers)} answers, {len(rows)} days")


def seed_players_and_submissions() -> None:
    cur.execute("TRUNCATE submissions, players, winners RESTART IDENTITY CASCADE")
    for p in PLAYERS:
        cur.execute("INSERT INTO players (name) VALUES (%s)", (p,))

    sub_id = 1

    def insert(day: datetime.date, name: str, t: float) -> None:
        nonlocal sub_id
        cur.execute(
            """
            INSERT INTO submissions
                (submission_id, day, name, paste, playback, time, penalty,
                 word, score, rank)
            VALUES (%s, %s, %s, '', '[]'::json, %s, 0, 'crane', 1, 1)
            """,
            (sub_id, day, name, t),
        )
        sub_id += 1

    today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())

    for offset in range((today - monday).days + 1):
        day = monday + datetime.timedelta(days=offset)
        n = max(4, len(PLAYERS) - offset)
        for i in range(n):
            insert(day, PLAYERS[i], BASE_TIMES[i] + offset * 3)

    last_monday = monday - datetime.timedelta(days=7)
    for offset in range(7):
        day = last_monday + datetime.timedelta(days=offset)
        for i, name in enumerate(PLAYERS):
            insert(day, name, BASE_TIMES[i] + offset * 2)

    print(f"seeded {sub_id - 1} submissions for week of {monday}")


seed_words()
seed_players_and_submissions()
conn.commit()
cur.close()
conn.close()
print("done")
