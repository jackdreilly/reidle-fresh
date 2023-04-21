import ReminderEmail from "@/components/reminder_email.tsx";
import { run } from "@/utils/db.ts";
import { inngest, SendEmailData } from "@/utils/inngest.ts";
import { spy } from "@/utils/utils.ts";
import * as sendgrid from "https://deno.land/x/sendgrid@0.0.3/mod.ts";
import { IAddress } from "https://deno.land/x/sendgrid@0.0.3/mod.ts";
import { serve } from "https://esm.sh/v111/inngest@1.4.0/deno/fresh";
import render from "preact-render-to-string";
import { runSql } from "../../utils/sql_files.ts";

export function sendEmail(data: SendEmailData) {
  return inngest.send("email/send", { data, user: { name: "fake" } });
}

const sendEmailFunction = inngest.createFunction(
  { name: "Send Email" },
  { event: "email/send" },
  async (
    { event: { data: { subject, to, text, html, bcc, cc } } }: {
      event: { data: SendEmailData };
    },
  ) => {
    if (to === undefined) {
      to = [{
        email: Deno.env.get("DEFAULT_EMAIL") ??
          "jackdreilly+reidle.admin@gmail.com",
      }];
    } else if (!to?.length) {
      to = [{
        email: Deno.env.get("ADMIN_EMAIL") ??
          "jackdreilly+reidle.admin@gmail.com",
      }];
    }
    const payload = {
      subject: `${Deno.env.get("EMAIL_TAG") ?? ""}${subject}`,
      cc,
      bcc,
      to,
      from: { email: "jackdreilly@gmail.com" },
      content: [
        {
          type: "text/plain",
          value: text,
        },
        {
          type: "text/html",
          value: html ?? text,
        },
      ],
    };
    if (!Deno.env.get("SEND_EMAILS")) {
      console.log(payload);
      return;
    }
    return {
      sendgridResponse: spy(
        await sendgrid.sendSimpleMail(
          payload,
          {
            apiKey: Deno.env.get("SENDGRID_API_KEY") ?? "",
          },
        ),
      ),
    };
  },
);

const reminderEmailFunction = inngest.createFunction(
  { name: "email/reminder" },
  { cron: "TZ=UTC 0 20 * * *" },
  async () => {
    const bcc = await run((connection) =>
      runSql({ file: "emails_to_send", connection })
    );
    sendEmail({
      to: [],
      html: render(ReminderEmail()),
      text: `
You haven't played Reidle yet today!

Play at https://reidle.reillybrothers.net

Unsubscribe at https://reidle.reillybrothers.net/unsubscribe
      `,
      subject: "Reminder email",
      bcc,
    });
  },
);

// Serve the Inngest API.
export const handler = serve(inngest, [
  sendEmailFunction,
  reminderEmailFunction,
]);
