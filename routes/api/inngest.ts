import ReminderEmail from "@/components/reminder_email.tsx";
import { run } from "@/utils/db.ts";
import { inngest, SendEmailData } from "@/utils/inngest.ts";
import * as sendgrid from "https://deno.land/x/sendgrid@0.0.3/mod.ts";
import { serve } from "https://esm.sh/inngest@1.4.0/deno/fresh";
import render from "preact-render-to-string";

export function sendEmail(data: SendEmailData) {
  return inngest.send("email/send", { data, user: { name: "fake" } });
}

const sendEmailFunction = inngest.createFunction(
  { name: "Send Email" },
  { event: "email/send" },
  async ({ event: { data: { subject, to, text, html } } }) => {
    return {
      sendgridResponse: await sendgrid.sendSimpleMail(
        {
          subject,
          to: [{ email: to ?? "jackdreilly+reidle.admin@gmail.com" }],
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
        },
        {
          apiKey: Deno.env.get("SENDGRID_API_KEY") ?? "",
        },
      ),
    };
  },
);

const reminderEmailFunction = inngest.createFunction(
  { name: "email/reminder" },
  { cron: "TZ=UTC 0 20 * * *" },
  async () => {
    const emails = await run((c) =>
      c.queryObject<{ email: string }>`select email from emails_to_send`
    ).then((x) => x.rows.map(({ email }) => email));
    sendEmail({
      html: render(ReminderEmail()),
      text: `
You haven't played Reidle yet today!

Play at https://reidle.reillybrothers.net

Unsubscribe at https://reidle.reillybrothers.net/unsubscribe
      `,
      subject: "Reminder email",
      cc: emails,
    });
  },
);

// Serve the Inngest API.
export const handler = serve(inngest, [
  sendEmailFunction,
  reminderEmailFunction,
]);
