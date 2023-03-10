import * as sendgrid from "https://deno.land/x/sendgrid@0.0.3/mod.ts";
export default async function sendEmail(
  subject: string,
  messageText: string,
  messageHtml?: string,
) {
  await sendgrid.sendSimpleMail(
    {
      subject,
      to: [{ email: "jackdreilly@gmail.com" }],
      from: { email: "jackdreilly@gmail.com" },
      content: [
        {
          type: "text/plain",
          value: messageText,
        },
        {
          type: "text/html",
          value: messageHtml ?? messageText,
        },
      ],
    },
    {
      apiKey: Deno.env.get("SENDGRID_API_KEY") ?? "",
    },
  );
}
