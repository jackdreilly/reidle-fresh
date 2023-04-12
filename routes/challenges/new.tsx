import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import Challengers from "@/islands/Challengers.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { wordlePromise } from "../practice.tsx";
import { sendEmail } from "../api/inngest.ts";

type Players = Player[];
interface Player {
  name: string;
  email: string;
}
interface Data {
  players: Players;
}

export const handler: SessionHandler<Data> = {
  async POST(req, ctx) {
    const players: Player[] = [];
    const form = await req.formData();
    form.getAll("name").forEach((entry, i) => {
      const name = entry as string;
      if (name === ctx.state.name) {
        return new Response("Cannot challenge yourself", { status: 400 });
      }
      players.push({
        name: name as string,
        email: form.getAll("email")[i] as string,
      });
    });
    const wordle = await wordlePromise;
    const starting_word =
      wordle.words[Math.floor(Math.random() * wordle.words.length)];
    const answer =
      wordle.answers[Math.floor(Math.random() * wordle.answers.length)];
    const id = await ctx.state.connection.queryObject<{ id: number }>`
WITH
challenge AS (
  INSERT INTO
    challenges (
      challenger,
      starting_word,
      answer
    )
  VALUES (
    ${ctx.state.name},
    ${starting_word},
    ${answer}
  )
  RETURNING
    id
),
challengers AS (
  INSERT INTO
    challenge_requests (
      challenge_id,
      name,
      email
    )
  SELECT
    challenge.id,
    name,
    email
  FROM
    challenge,
    jsonb_to_recordset(${JSON.stringify(players)})
      AS t(name text, email text)
)
SELECT
  challenge.id AS id
FROM
  challenge
    `.then((r) => r.rows[0].id);
    const doNotEmail = await ctx.state.connection
      .queryArray`select email from players where email IS NOT NULL AND NOT challenge_notifications_enabled`
      .then((x) => x.rows.map((x) => x[0]));
    const to = players.filter((x) => !doNotEmail.includes(x.email));
    if (to.length) {
      await sendEmail({
        to,
        subject: `Reidle Challenge ${id} from ${ctx.state.name}`,
        text:
          `You have been challenged to a game of Reidle by ${ctx.state.name}! Go to https://reidle.reillybrothers.net/challenges/challenge/${id} to play!`,
        html:
          `<p>You have been challenged to a game of Reidle by ${ctx.state.name}! Go to <a href="https://reidle.reillybrothers.net/challenges/challenge/${id}">https://reidle.reillybrothers.net/challenges/challenge/${id}</a> to play!</p>`,
      });
    }

    return new Response("Challenge created", {
      status: 303,
      headers: { location: `/challenges/challenge/${id}` },
    });
  },
  async GET(req, ctx) {
    const { state: { connection, render } } = ctx;
    return render(ctx, {
      players: await connection.queryObject<Player>`
    SELECT
      name,
      email
    FROM
      players
    `.then((r) => r.rows),
    });
  },
};

export default function Page(
  { data: { playedToday, players } }: PageProps<Data & SessionData>,
) {
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route="/challenges"
      title="Challenge"
    >
      <h2 class="text-xl">New Challenge</h2>
      <form class="my-4" method="POST">
        <Challengers players={players} />
        <input
          type="submit"
          class="text-white cursor-pointer bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300  font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 mb-2"
          value="Create and Play!"
        />
      </form>
    </ReidleTemplate>
  );
}
