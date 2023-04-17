set time zone 'UTC';
CREATE TABLE public.answers (
    answer text not null primary key
);

CREATE TABLE public.words (
    word text not null PRIMARY KEY
);

CREATE TABLE public.challenges (
    challenge_id SERIAL primary key,
    created_at timestamp with time zone DEFAULT now(),
    starting_word text NOT NULL references words(word),
    answer text NOT NULL references answers(answer)
);

CREATE TABLE public.daily_words (
    day date NOT NULL PRIMARY KEY,
    word text NOT NULL REFERENCES words(word),
    answer text NOT NULL REFERENCES answers(answer)
);

CREATE TABLE public.players (
    name text NOT NULL PRIMARY KEY,
    email text UNIQUE,
    notifications_enabled boolean DEFAULT true NOT NULL
);

CREATE TABLE public.submissions (
    submission_id SERIAL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    "time" real NOT NULL,
    penalty real NOT NULL,
    paste text DEFAULT ''::text NOT NULL,
    playback json DEFAULT '[]'::json NOT NULL,
    word text DEFAULT ''::text NOT NULL,
    day date DEFAULT CURRENT_DATE NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    rank integer DEFAULT 0 NOT NULL,
    challenge_id bigint REFERENCES challenges(challenge_id),
    constraint submissions_name_day_challenge_id_key unique (name, day, challenge_id)
);

CREATE TABLE public.message_reads (
    name text NOT NULL PRIMARY KEY,
    last_read timestamp with time zone NOT NULL
);

CREATE TABLE public.messages (
    message_id SERIAL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    message text DEFAULT ''::text NOT NULL
);

CREATE TABLE public.winners (
    week date NOT NULL PRIMARY KEY,
    name text NOT NULL
);

\copy public.answers from 'static/answers.csv' with (format csv, header false);
\copy public.words from 'static/words.csv' with (format csv, header false);
insert into daily_words (day, word, answer)
select day, word, answer from (
  select day::DATE as day, row_number() over () as i FROM generate_series('2023-01-01'::DATE, '2030-01-01', '1 day') d(day)
) a NATURAL INNER JOIN (
  select word, row_number() over () as i from words order by random()
) b NATURAL INNER JOIN (
  select answer, row_number() over () as i from answers order by random()
) c
ON CONFLICT (day) DO NOTHING;