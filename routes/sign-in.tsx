import { Head } from "$fresh/runtime.ts";
import Input from "@/components/input.tsx";
import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    ctx.state.name =
      ((await req.formData()).get("name") as string | undefined)?.trim()
        .replace(/\s+/gi, "")
        .toLowerCase()
        .slice(
          0,
          15,
        ) ?? "";
    return new Response("go to account", {
      status: 303,
      headers: { location: "/account" },
    });
  },
};

export default function Page() {
  return (
    <html>
      <Head>
        <title>Reidle - Sign In</title>
      </Head>
      <body class="m-2">
        <nav>
          <h1 class="m-2 font-bold text-3xl">Reidle</h1>
        </nav>
        <main class="m-2">
          <h2 class="text-2xl">Sign in</h2>
          <div>
            Just put your name to start playing Reidle!
          </div>
          <form method="POST">
            <Input
              class="m-4"
              autoFocus={true}
              type="text"
              placeholder="Your name"
              name="name"
              required
            />
            <Input type="submit" />
          </form>
        </main>
      </body>
    </html>
  );
}