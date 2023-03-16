import Input from "@/components/input.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const form = await req.formData();
    ctx.state.name =
      form.get("name")?.toString()?.toLowerCase()?.slice(0, 15) ?? "";
    return new Response("go to account", {
      status: 303,
      headers: { location: "/account" },
    });
  },
};

export default function Page() {
  return (
    <ReidleTemplate route="/sign-in" title="Sign In">
      <h1 class="text-2xl">Sign in</h1>
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
    </ReidleTemplate>
  );
}
