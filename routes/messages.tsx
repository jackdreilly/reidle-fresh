import { Handlers, PageProps } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { db, Message } from "@/db.ts";
import { getName } from "@/utils.ts";

export const handler: Handlers<unknown, WithSession> = {
  async POST(req, ctx) {
    const formData = await req.formData();
    const name = getName(ctx);
    const message = (formData.get("message") ?? "") as string;
    if (name.length && message.length) {
      createMessage(name, message);
    }
    return new Response("", {
      status: 303,
      headers: { Location: "/messages" },
    });
  },
  GET(req, ctx) {
    return ctx.render({ messages: getMessages(), name: getName(ctx) });
  },
};

interface Data {
  messages: Message[];
  name: string;
}

function createMessage(name: string, message: string) {
  const query = db.prepareQuery<
    [],
    // deno-lint-ignore ban-types
    {},
    { name: string; message: string }
  >("INSERT INTO messages (name, message, date) VALUES (:name, :message, datetime('now'))");
  query.execute({ name, message });
  query.finalize();
}

function getMessages(): Message[] {
  const query = db.prepareQuery<
    [number, string, string, string],
    {
      id: number;
      name: string;
      message: string;
      date: string;
    },
    // deno-lint-ignore ban-types
    {}
  >("SELECT id, name, message, date  FROM messages order by id desc");
  query.execute();
  const messages = query.allEntries();
  query.finalize();
  return messages;
}

export default function Page(
  { data: { messages, name: myName } }: PageProps<Data>,
) {
  return (
    <ReidleTemplate>
      <h2>Messages</h2>
      <form method="POST">
        <input
          autoFocus={true}
          type="text"
          placeholder="Your message"
          name="message"
        />
        <button type="submit">Send</button>
      </form>
      <ul style={{ padding: 0 }}>
        {messages.map(({ id, message, name }) => {
          const deleteButton = myName === name
            ? (
              <form
                style={{ display: "inline", marginLeft: 10 }}
                method="POST"
                action={`messages/${id}/delete`}
              >
                <input style={{ fontSize: 8 }} type="submit" value="🗑️" />
              </form>
            )
            : null;
          return (
            <li style={{ display: "inherit" }} key={id}>
              <strong>{name}</strong>: {message} {deleteButton}
            </li>
          );
        })}
      </ul>
    </ReidleTemplate>
  );
}
