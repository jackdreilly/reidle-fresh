import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("dark mode: follows the system, or pick it in Settings", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await signIn(page, "carol");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#dark-css")).toBeAttached();
  await page.screenshot({ path: "test-results/dark-daily.png" });
  await page.goto("/stats/this_week");
  await page.locator("tbody tr").first().waitFor();
  await page.screenshot({ path: "test-results/dark-weekly.png" });
  await page.goto("/practice");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/dark-practice.png" });
  await page.goto("/account");
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light"); // remembered over the system setting
  await page.getByRole("radio", { name: "Dark" }).click();
  await page.screenshot({ path: "test-results/dark-account.png", fullPage: true });
});
