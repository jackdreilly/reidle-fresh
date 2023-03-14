import { PageProps } from "$fresh/server.ts";
import Button from "@/components/button.tsx";
import Input from "@/components/input.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import sendEmail from "@/utils/mail.ts";
import { getName, SessionHandler } from "@/utils/utils.ts";
interface Message {
  message: string;
  name: string;
  id: number;
}
interface Data {
  messages: Message[];
  name: string;
}

export const handler: SessionHandler<Data> = {
  async POST(req, ctx) {
    const name = getName(ctx);
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
    await sendEmail(
      `${name}: ${message}`,
      `Message From ${name}: ${message}`,
      `
          <h1>Message From ${name}</h1>
          <blockquote>${message}</blockquote>
`,
    );
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
  async GET(_, ctx) {
    const name = getName(ctx);
    return ctx.render({
      messages: await ctx.state.connection.queryObject<Message>`
      SELECT
        message, name, id
      FROM
        messages
      ORDER BY
        created_at
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
      <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
        {messages.map(({ message, id, name }, i) => (
          <li key={i}>
            {name}: {message}
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
          </li>
        ))}
      </ul>
    </ReidleTemplate>
  );
}
