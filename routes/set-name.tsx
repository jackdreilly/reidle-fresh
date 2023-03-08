import { Handlers } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import { setName } from "@/utils/utils.ts";

export const handler: Handlers<
  unknown,
  WithSession
> = {
  async POST(req, ctx) {
    const name = (await req.formData()).get("name") as string ?? "";
    if (name) {
      setName(ctx, name);
      return new Response("", {
        status: 303,
        headers: { Location: "/" },
      });
    }
    return ctx.render();
  },
};

export default function Page() {
  return (
    <form method="POST">
      <input autoFocus={true} type="text" placeholder="Your name" name="name" />
      <button type="submit">Set Name</button>
    </form>
  );
}
