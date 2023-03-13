import { Handlers } from "$fresh/server.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";
import { setName } from "@/utils/utils.ts";
import Input from "@/components/input.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import Button from "@/components/button.tsx";

export const handler: Handlers<
  unknown,
  WithSession
> = {
  async POST(req, ctx) {
    const name = ((await req.formData()).get("name") as string ?? "").trim()
      .toLowerCase().slice(0, 15);
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
    <ReidleTemplate route="/set-name" title="Set Name">
      <form method="POST">
        <Input
          autoFocus={true}
          type="text"
          placeholder="Your name"
          name="name"
        />
        <Button class="ml-2">Set Name</Button>
      </form>
    </ReidleTemplate>
  );
}
