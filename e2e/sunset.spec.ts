import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

// app_flags.legacy_until is global: put it back whatever happens (the seed keeps it open locally).
test.afterEach(() => { sql("update app_flags set legacy_until = 'infinity'"); });

test("name-only sunset: countdown banner, then a save-your-account screen and no name form", async ({ page }) => {
  sql("update app_flags set legacy_until = now() + interval '3 days 1 hour'");
  await signIn(page, "sunny", "/rankings");
  await expect(page.getByText(/Name-only sign-in ends [A-Z][a-z]+ \d+\./)).toBeVisible();

  sql("update app_flags set legacy_until = now() - interval '1 second'");
  await page.goto("/rankings");
  await expect(page).toHaveURL(/\/save-account$/);
  await expect(page.getByRole("heading", { name: "Keep playing as sunny" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Link Google/ })).toBeVisible();
  await page.screenshot({ path: "test-results/save-account.png", fullPage: true });

  await page.getByRole("link", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/sign-in/);
  await expect(page.getByRole("button", { name: /Play now|Continue as/ })).toBeVisible();
  await expect(page.getByText("Played before leagues?")).toHaveCount(0);
});
