import { Inngest } from "inngest";
import { serve } from "inngest/deno/fresh";

const inngest = new Inngest({ name: "My app" });

const fn = inngest.createFunction(
  { name: "Weekly digest email" },
  { cron: "TZ=UTC * * * * *" },
  async () => {
    
  },
);

// Serve the Inngest API.
export const handler = serve(inngest , [fn]);
