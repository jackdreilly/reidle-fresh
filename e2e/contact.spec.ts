import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

test("Contact Jack: a player writes, the owner answers from the inbox, the player sees the reply", async ({ page, browser }) => {
  sql("delete from feedback where name = 'carol'; delete from feedback_threads where name = 'carol'");
  await signIn(page, "carol", "/stats/today");
  await page.getByRole("link", { name: "Contact Jack" }).click();
  await expect(page.getByRole("heading", { name: "Contact Jack" })).toBeVisible();
  await page.getByRole("textbox", { name: "Your message" }).fill("How do I invite my sister?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Sent.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Your conversation with Jack" })).toContainText("How do I invite my sister?");
  expect(sql("select path from feedback where name = 'carol'")).toBe("/stats");
  await page.screenshot({ path: "test-results/contact-sent.png" });

  // the owner (alice, with a Google login) sees it in the menu and the inbox, and replies
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "alice", "/stats/today");
  sql(`insert into auth.identities (provider_id, user_id, identity_data, provider)
       select 'g-alice', user_id, '{"sub":"g-alice"}', 'google' from players where name = 'alice' on conflict do nothing`);
  await owner.goto("/admin");
  await expect(owner.locator("#logo-sidebar").getByRole("link", { name: "Inbox" })).toContainText("1");
  const inbox = owner.locator("#inbox");
  await expect(inbox).toContainText("How do I invite my sister?");
  await expect(inbox).toContainText("waiting on you");
  await inbox.screenshot({ path: "test-results/contact-admin-inbox.png" });
  await inbox.getByRole("link", { name: /carol/ }).click();
  await expect(owner).toHaveURL(/\/admin\/inbox\/carol/);
  await owner.getByRole("textbox", { name: "Reply to carol" }).fill("Open Invite & league and share the link!");
  await owner.getByRole("button", { name: "Send" }).click();
  await expect(owner.getByText("not seen yet")).toBeVisible();
  await owner.screenshot({ path: "test-results/contact-admin-convo.png" });
  expect(sql("select count(*) from push_outbox where tag = 'contact-carol'")).toBe("1");

  // the player: a banner on the next page, the reply on /contact, then the banner is gone
  await page.goto("/stats/today");
  await expect(page.getByText("Jack replied to your message.")).toBeVisible();
  await page.screenshot({ path: "test-results/contact-banner.png" });
  await page.getByRole("link", { name: "Read it" }).click();
  await expect(page.getByText("Open Invite & league and share the link!")).toBeVisible();
  await page.screenshot({ path: "test-results/contact-reply.png" });
  await page.goto("/stats/today");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Jack replied to your message.")).toHaveCount(0);
  await owner.reload();
  await expect(owner.getByText(/seen /)).toBeVisible();
  sql("delete from auth.identities where provider_id = 'g-alice'");
});
