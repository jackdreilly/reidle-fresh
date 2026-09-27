"""Add message likes and submission ID generation.

Revision ID: 20260926_add_message_likes
Revises:
Create Date: 2026-09-26

"""
from alembic import op
import sqlalchemy as sa


revision = "20260926_add_message_likes"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS "
        "likes varchar[] NOT NULL DEFAULT '{}'::varchar[]"
    )
    op.execute("CREATE SEQUENCE IF NOT EXISTS submissions_submission_id_seq")
    op.execute(
        "ALTER SEQUENCE submissions_submission_id_seq "
        "OWNED BY submissions.submission_id"
    )
    op.execute(
        "SELECT setval('submissions_submission_id_seq', "
        "GREATEST(COALESCE((SELECT MAX(submission_id) FROM submissions), 0) + 1, 1), "
        "false)"
    )
    op.execute(
        "ALTER TABLE submissions ALTER COLUMN submission_id "
        "SET DEFAULT nextval('submissions_submission_id_seq')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE submissions ALTER COLUMN submission_id DROP DEFAULT")
    op.execute("DROP SEQUENCE IF EXISTS submissions_submission_id_seq")
    op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS likes")