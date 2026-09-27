from datetime import date, datetime
from typing import Any
from sqlmodel import JSON, Column, Field, SQLModel, UniqueConstraint
from sqlalchemy.ext.declarative import declared_attr
import sqlalchemy as sa
import re


def created_at_field(index: bool = False):
    return Field(
        sa_column=sa.Column(
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            index=index,
        )
    )


def seq_field():
    return Field(primary_key=True)


class TableBase(SQLModel):
    @declared_attr  # type: ignore
    def __tablename__(cls) -> str:
        return re.sub(r"([A-Z])", r"_\1", cls.__name__).lower()[1:] + "s"


class Player(TableBase, table=True):
    name: str = Field(primary_key=True)
    email: str | None = Field(None, unique=True)
    notifications_enabled: bool = True
    created_at: datetime = created_at_field()


class Message(TableBase, table=True):
    message_id: int = seq_field()
    name: str
    message: str
    created_at: datetime = created_at_field(True)


class MessageRead(TableBase, table=True):
    name: str = Field(primary_key=True)
    last_read: datetime


class Winner(TableBase, table=True):
    week: date = Field(primary_key=True)
    name: str


class Submission(TableBase, table=True):
    __table_args__ = (UniqueConstraint("day", "name", "challenge_id"),)
    submission_id: int = seq_field()
    day: date = Field(
        primary_key=True,
        sa_column_kwargs=dict(server_default=sa.func.CURRENT_DATE()),
        index=True,
    )
    name: str
    paste: str
    playback: dict[str, Any] = Field(
        sa_column=Column(JSON, server_default="[]", nullable=False),
    )
    challenge_id: int | None = Field(foreign_key="challenges.challenge_id", index=True)
    time: float
    penalty: float
    word: str
    score: int = Field(sa_column_kwargs=dict(server_default="1"))
    rank: int = Field(sa_column_kwargs=dict(server_default="1"))
    created_at: datetime = created_at_field()


class Word(TableBase, table=True):
    word: str = Field(primary_key=True)


class Answer(TableBase, table=True):
    answer: str = Field(primary_key=True)


class Challenge(TableBase, table=True):
    challenge_id: int = seq_field()
    starting_word: str = Field(foreign_key="words.word")
    answer: str = Field(foreign_key="answers.answer")
    created_at: datetime = created_at_field(True)


class DailyWord(TableBase, table=True):
    day: date = Field(primary_key=True)
    word: str = Field(foreign_key="words.word")
    answer: str = Field(foreign_key="answers.answer")


class Battle(TableBase, table=True):
    battle_id: int = seq_field()
    state: dict[str, Any] = Field(
        sa_column=Column(JSON, server_default="{}", nullable=False),
    )
    updated_at: datetime = created_at_field(True)
    users: list[str] = Field(
        sa_column=Column(JSON, server_default="[]", nullable=False),
    )


class Checkpoint(TableBase, table=True):
    name: str = Field(primary_key=True)
    day: date = Field(sa_column_kwargs=dict(server_default=sa.func.CURRENT_DATE()))
    penalty: float
    created_at: datetime = created_at_field()
    history: list[str] = Field(
        sa_column=Column(JSON, server_default="[]", nullable=False),
    )
