-- Shape of the legacy (pre-port) production tables, as inspected from the live project.
-- Dumps of prod `public` data land here (schema `legacy`), then import.sql transforms them.
drop schema if exists legacy cascade;
create schema legacy;
create table legacy.players (name text primary key, email text unique, notifications_enabled boolean not null default true, created_at timestamp not null default '2023-04-19 04:13:03');
create table legacy.words (word text primary key);
create table legacy.answers (answer text primary key);
create table legacy.daily_words (day date primary key, word text not null, answer text not null);
create table legacy.challenges (challenge_id bigint primary key, created_at timestamptz not null default now(), starting_word text not null, answer text not null);
create table legacy.submissions (submission_id bigint primary key, created_at timestamptz not null default now(), name text not null, "time" real not null, penalty real not null, paste text not null default '', playback json not null default '[]', word text not null default '', day date not null default current_date, score int not null default 0, "rank" int not null default 0, challenge_id bigint);
create table legacy.winners (name text not null, week date not null);
create table legacy.messages (message_id bigint primary key, created_at timestamptz not null default now(), name text not null default '', message text not null default '', likes text[] not null default '{}');
create table legacy.message_reads (name text primary key, last_read timestamptz not null);
create table legacy.checkpoints (name varchar primary key, day date not null default current_date, penalty double precision not null, created_at timestamptz not null default now(), history json not null default '[]');
create table legacy.battles (battle_id bigint primary key, created_at timestamptz not null default now(), state json not null default '{}', users json not null default '[]', updated_at timestamptz not null default now());
create table legacy.page_views (id serial primary key, created_at timestamp not null default now(), name varchar, url varchar, method varchar);
create table legacy.alembic_version (version_num varchar primary key);
