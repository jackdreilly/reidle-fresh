"""Remove daily reminder email data.

Revision ID: 20260927_remove_daily_reminders
Revises: 20260926_add_message_likes
Create Date: 2026-09-27

"""
from alembic import op
import sqlalchemy as sa


revision = "20260927_remove_daily_reminders"
down_revision = "20260926_add_message_likes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP VIEW IF EXISTS emails_to_send")
    op.drop_column("players", "notifications_enabled")
    op.drop_column("players", "email")


def downgrade() -> None:
    op.add_column(
        "players",
        sa.Column("email", sa.String(), nullable=True, unique=True),
    )
    op.add_column(
        "players",
        sa.Column(
            "notifications_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
