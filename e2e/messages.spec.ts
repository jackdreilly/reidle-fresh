import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("post, like and delete a message; unread dot clears", async ({ page }) => {
  await signIn(page, "dave", "/messages");
  await expect(page.getByText("good morning reidlers")).toBeVisible();
  const text = `hello from e2e ${Date.now()}`;
  await page.getByPlaceholder("Your message...").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  const item = page.getByRole("listitem").filter({ hasText: text });
  await expect(item).toBeVisible();

  await item.locator('form button:has(img)').click();
  await expect(item).toContainText("dave");

  page.once("dialog", (d) => void d.accept());
  await item.locator('form:not(:has(img)) button').first().click(); // trash (own message)
  await expect(page.getByText(text)).toHaveCount(0);
  await expect(page.locator("aside .animate-ping")).toBeHidden();
});

test("others' messages have no delete control", async ({ page }) => {
  await signIn(page, "dave", "/messages");
  const theirs = page.getByRole("listitem").filter({ hasText: "good morning reidlers" });
  await expect(theirs.locator("svg path[d^='m14.74']")).toHaveCount(0);
});

test("sign out returns to sign-in and protects routes", async ({ page }) => {
  await signIn(page, "dave");
  await page.getByRole("link", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/sign-in/);
  await page.goto("/stats/today");
  await expect(page).toHaveURL(/sign-in\?redirect=/);
});
