import { PageProps } from "$fresh/server.ts";
import Button from "@/components/button.tsx";
import { Name } from "@/components/daily_table.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { sendEmail } from "@/routes/api/inngest.ts";
import { runSql, Schemas } from "@/utils/sql_files.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { moment } from "https://deno.land/x/deno_moment@v1.1.2/mod.ts";
type Message = Schemas["message_reads"]["output"][number];
interface Data {
  messages: Message[];
}

export const handler: SessionHandler<Data> = {
  async POST(req, ctx) {
    const name = ctx.state.name;
    const message = (await req.formData()).get("message") as string ?? "";
    await ctx.state.connection.queryArray`
        INSERT INTO
        messages (
          name,
          message
          )
          VALUES (
            ${name},
            ${message}
            )`;
    await sendEmail({
      subject: `${name}: ${message}`,
      text: `Message From ${name}: ${message}`,
      html: `
          <h1>Message From ${name}</h1>
          <blockquote>${message}</blockquote>
`,
    });
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
  async GET(_, ctx) {
    const name = ctx.state.name;
    return ctx.state.render(ctx, {
      messages: await runSql({
        file: "message_reads",
        connection: ctx.state.connection,
        args: { name },
      }),
      name,
    });
  },
};

export default function Page(
  { data: { messages, name: myName, playedToday } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route="/messages"
      title="Messages"
    >
      <form method="POST" class="flex">
        <textarea
          required
          rows={2}
          class="flex-grow-1 break-word mr-2.5 p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Your message..."
          autocomplete="off"
          autoFocus
          name="message"
        />
        <Button>Send</Button>
      </form>
      <ul>
        {messages.map(({ message, message_id, name, created_at }, i) => (
          <li class="border-b-1 p-2 whitespace-break-spaces">
            <span class="font-bold">
              <Name name={name} />
            </span>: {message}
            {myName === name
              ? (
                <form
                  style={{ display: "inline" }}
                  method="POST"
                  action={`/messages/${message_id}/delete`}
                >
                  <input
                    class="cursor-pointer"
                    type="submit"
                    value="🗑️"
                    style={{ fontSize: 8, marginLeft: 5 }}
                  />
                </form>
              )
              : null}
            <div class="text-xs italic pl-2">
              {moment(created_at).fromNow()}
            </div>
          </li>
        ))}
      </ul>
    </ReidleTemplate>
  );
}
