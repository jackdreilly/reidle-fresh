import { Handlers, PageProps } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import { pool } from "@/utils/db.ts";
import { getName } from "@/utils/utils.ts";
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
    const message = (await req.formData()).get("message") ?? "";
    const cxn = await pool.connect();
    await cxn.queryObject<{ message: string; name: string }>`
        INSERT INTO
            messages (
                name,
                message
            )
        VALUES (
            ${name},
            ${message}
    )`;
    cxn.release();
    return new Response("", {
      status: 303,
      headers: { location: "/messages" },
    });
  },
  async GET(req, ctx) {
    const connection = await pool.connect();
    const response = await connection.queryObject("select * from messages");
    const messages = response.rows as Message[];
    const name = getName(ctx);
    connection.release();
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
    <div>
      <form method="POST" style={{marginBottom: 10}}>
        <input
          style={{ width: "80%", marginRight: 10 }}
          type="text"
          name="message"
          placeholder="Message"
        />
        <button type="submit">Send</button>
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
    </div>
  );
}
