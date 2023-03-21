import { PageProps } from "$fresh/server.ts";
import Button from "@/components/button.tsx";
import Input from "@/components/input.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { sendEmail } from "@/routes/api/inngest.ts";
import { guardLogin, SessionHandler } from "@/utils/utils.ts";
import { moment } from "https://deno.land/x/deno_moment@v1.1.2/mod.ts";
interface Message {
  message: string;
  name: string;
  id: number;
  created_at: string;
}
interface Data {
  messages: Message[];
  name: string;
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
    return guardLogin(ctx) ?? ctx.render({
      messages: await ctx.state.connection.queryObject<Message>`
WITH "read_receipt" AS (
    INSERT INTO "message_reads" ("name", "last_read")
        VALUES (${name}, NOW())
        ON CONFLICT ("name") DO UPDATE SET "last_read" = NOW()
)
SELECT
    "message",
    "name",
    "created_at",
    "id"
FROM
    "messages"
ORDER BY
    "created_at"
        DESC
      `.then((x) => x.rows),
      name,
    });
  },
};

export default function Page(
  { data: { messages, name: myName } }: PageProps<Data>,
) {
  return (
    <ReidleTemplate route="/messages" title="Messages">
      <form method="POST" style={{ marginBottom: 10 }}>
        <Input
          autocomplete="off"
          autoFocus={true}
          style={{ width: "80%", marginRight: 10 }}
          type="text"
          name="message"
          placeholder="Message"
        />
        <Button>Send</Button>
      </form>
      <ul>
        {messages.map(({ message, id, name, created_at }, i) => (
          <li class="border-b-1 p-2">
            <span class="font-bold">{name}</span>: {message}
            {myName === name
              ? (
                <form
                  style={{ display: "inline" }}
                  method="POST"
                  action={`/messages/${id}/delete`}
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
