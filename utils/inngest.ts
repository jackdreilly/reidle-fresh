import { IAddress } from "https://deno.land/x/sendgrid@0.0.3/mod.ts";
import { EventPayload, Inngest } from "https://esm.sh/v111/inngest@1.4.0";
export type SendEmailData = {
  to?: IAddress[];
  cc?: IAddress[];
  bcc?: IAddress[];
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
