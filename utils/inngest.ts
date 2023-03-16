import { EventPayload, Inngest } from "https://esm.sh/inngest@1.4.0";
export type SendEmailData = {
  to?: string;
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
};

interface Events extends Record<string, EventPayload> {
  "email/send": {
    name: "email/send";
    data: SendEmailData;
    user: {
      name: string;
    };
  };
}

export const inngest = new Inngest<Events>({ name: "app" });
