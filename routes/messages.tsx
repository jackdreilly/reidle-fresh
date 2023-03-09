import { Handlers, PageProps } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import { getName } from "@/utils/utils.ts";
import ReidleTemplate from "../components/reidle_template.tsx";
import Button from "@/components/button.tsx";
import Input from "@/components/input.tsx";
import runDb from "@/utils/db.ts";
interface Message {
  message: string;
  name: string;
  id: number;
}
interface Data {
  messages: Message[];
  name: string;
}

export const handler: Handlers<Data, WithSession> = {
  async POST(req, ctx) {
    const name = getName(ctx);
    const message = (await req.formData()).get("message") as string ?? "";
    const messages = await runDb(async (cxn, cleanup) => {
      const response = await cxn
        .queryObject`select * from messages ORDER BY created_at DESC`;
      cleanup(() => {
        cxn.queryObject<{ message: string; name: string }>`
        INSERT INTO
        messages (
          name,
          message
          )
          VALUES (
            ${name},
            ${message}
            )`;
      });
      return [
        { message, name, id: -1 },
        ...response.rows as Message[],
      ];
    });
    return ctx.render({
      messages,
      name,
    });
  },
  async GET(req, ctx) {
    const name = getName(ctx);
    const messages = await runDb((connection) =>
      connection.queryObject(
        "select * from messages ORDER BY created_at DESC",
      ).then((x) => x.rows as Message[])
    );
    return ctx.render({
      messages,
      name,
    });
  },
};

export default function Page(
  { data: { messages, name: myName } }: PageProps<Data>,
) {
  return (
    <ReidleTemplate title="Messages">
      <form method="POST" style={{ marginBottom: 10 }}>
        <Input
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
