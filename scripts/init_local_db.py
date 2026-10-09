"""Create the local dev schema from schema.py.

Usage:
    .venv/bin/python scripts/init_local_db.py

Uses POSTGRES_URL (defaults to the local Homebrew Postgres). Drops and recreates
the `public` schema, so it is destructive. `page_views` is not in schema.py and
is created here because the request middleware inserts into it.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import SQLModel, create_engine  # noqa: E402

import schema  # noqa: E402,F401  (registers the tables)

url = os.environ.get(
    "POSTGRES_URL", "postgres://postgres:postgres@localhost:5432/postgres"
).replace("postgres://", "postgresql://")
engine = create_engine(url, echo=False)
with engine.begin() as conn:
    conn.exec_driver_sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
SQLModel.metadata.create_all(engine)
with engine.begin() as conn:
    conn.exec_driver_sql(
        """
        CREATE TABLE page_views (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name text,
            url text,
            method text,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    # SQLModel cannot make submission_id autoincrement because the table has a
    # composite primary key (submission_id, day). The app's INSERT omits
    # submission_id, so give it a sequence-backed default.
    conn.exec_driver_sql(
        """
        CREATE SEQUENCE IF NOT EXISTS submissions_submission_id_seq;
        ALTER SEQUENCE submissions_submission_id_seq
            OWNED BY submissions.submission_id;
        ALTER TABLE submissions ALTER COLUMN submission_id
            SET DEFAULT nextval('submissions_submission_id_seq');
        """
    )
    # The app also relies on columns that production has but schema.py does not
    # model: messages.likes (used by /messages and the like endpoint).
    conn.exec_driver_sql(
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS "
        "likes varchar[] NOT NULL DEFAULT '{}'::varchar[]"
    )
print("created tables:", ", ".join(sorted(SQLModel.metadata.tables)))
