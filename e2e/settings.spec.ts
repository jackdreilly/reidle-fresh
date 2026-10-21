import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

test("settings: notification choices save, Game Stats opens your stats", async ({ page }) => {
  await signIn(page, "erin", "/account");
  await expect(page.getByRole("heading", { name: "erin", exact: true })).toBeVisible();
  const beaten = page.getByRole("switch", { name: "Beaten" });
  await expect(beaten).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Chat messages" })).toBeChecked();
  await beaten.locator("..").click();
  await expect(beaten).toBeChecked();
  await page.locator("select").selectOption("3");
  await expect.poll(() => sql("select beaten || ',' || reminder_before from notify_prefs where name = 'erin'")).toBe("true,3");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Beaten" })).toBeChecked();
  await expect(page.locator("select")).toHaveValue("3");
  await page.screenshot({ path: "test-results/settings.png", fullPage: true });
  await page.getByRole("link", { name: /Game Stats/ }).click();
  await expect(page).toHaveURL(/\/players\/erin$/);
});
