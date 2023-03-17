# %%
import json
import os
from pathlib import Path
import psycopg2
import psycopg2.extras
import firebase_admin
import firebase_admin.firestore
from firebase_admin import credentials
from google.cloud import firestore

firebase_admin.initialize_app(
    credentials.Certificate(next(Path.cwd().glob("*adminsdk*.json")))
)

client: firestore.Client = firebase_admin.firestore.client()

# %%


def connect():
    return psycopg2.connect(os.environ["POSTGRES_URL"])


# export interface PlaybackEvent {
#   time: number;
#   letter?: string;
#   score?: ScoredWord;
#   backspace?: boolean;
#   clear?: boolean;
#   error?: { message: string; penalty: number };
# }

# %%
def converter(x):
    out = []
    time = 0
    word = ""
    for message in x:
        time += message["duration"] / 1e6
        event = message["event"]
        rt_type = event["runtimeType"]
        if rt_type == "word":
            new_word = event["word"].upper()
            for l in new_word[len(word) :]:
                out.append(dict(time=time, letter=l))
            if word and not new_word:
                out.append(dict(time=time, clear=True))
            else:
                for _ in word[len(new_word) :]:
                    out.append(dict(time=time, backspace=True))
            word = new_word
        if rt_type == "penalty":
            out.append(
                dict(
                    time=time,
                    error=dict(message="error", penalty=event["duration"] / 1e6),
                )
            )
        if rt_type == "enter":
            out.append(
                dict(
                    time=time,
                    score=[dict(letter=c, score=2) for c in word[:5].ljust(5, "A")],
                )
            )
            word = ""
    return dict(events=out)


# %%
cursor.close()
connection.close()
# %%
connection = connect()
cursor = connection.cursor()
# %%
cursor.execute("truncate submissions")

psycopg2.extras.execute_values(
    cursor,
    """
INSERT INTO
    submissions (
        word,
        created_at,
        time,
        penalty,
        name,
        paste,
        playback,
        rank,
        score,
        day
    )
VALUES
    %s""",
    [
        (
            x.get("answer", "").upper(),
            x["submissionTime"],
            x.get("time", 0) / 1e6,
            int(x.get("penalty", 0) / 1e6),
            {"natnat": "natalie"}.get(
                x.get("name", "").lower(), x.get("name", "").lower()
            ),
            x.get("paste", ""),
            json.dumps(converter(x.get("events", []))),
            1,
            1,
            x.get("submissionTime", "")[:10],
        )
        for x in {
            (x.get("submissionTime", "")[:10], x.get("name").lower()): x
            for x in [x._data for x in client.collection("submissions").get()]
        }.values()
    ],
    page_size=10000,
)

connection.commit()
# %%
cursor.execute("truncate messages")

psycopg2.extras.execute_values(
    cursor,
    """
INSERT INTO
    messages (
        name,
        created_at,
        message
    )
VALUES
    %s""",
    [
        (
            x.get("name", ""),
            x.get("date"),
            x.get("message"),
        )
        for x in (x._data for x in client.collection("chats").get())
    ],
    page_size=10000,
)

connection.commit()

# %%
