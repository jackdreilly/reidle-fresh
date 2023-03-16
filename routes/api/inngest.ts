import { Inngest } from "inngest";
import { serve } from "inngest/deno/fresh";

const inngest = new Inngest({ name: "My app" });

const helloWorld = inngest.createFunction(
  { name: "Hello World" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    await step.sleep("1s");
    return { event, body: "Hello, World!" };
  },
);

const email = inngest.createFunction(
  { name: "Weekly digest email" },
  { cron: "TZ=UTC * * * * *" },
  async ({ event, step }) => {
    return { event, body: "yo!" };
  },
);

// Serve the Inngest API.
export const handler = serve(inngest, [helloWorld, email]);
