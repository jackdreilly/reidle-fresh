import { PageProps } from "$fresh/server.ts";
import Button from "@/components/button.tsx";
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
      <ul class="overflow-scroll" style={{ height: "calc(90vh - 5em)" }}>
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
      <div class="mt-3">
        <form method="POST" class="flex">
          <textarea
            rows={2}
            required
            class="flex-grow-1 break-word mr-2.5 p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Your message..."
            autocomplete="off"
            autoFocus
            name="message"
          />
          <Button>Send</Button>
        </form>
      </div>
    </ReidleTemplate>
  );
}
