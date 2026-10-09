import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("sign in lands on today's leaderboard with seeded data", async ({ page }) => {
  await signIn(page, "alice");
  await expect(page).toHaveURL(/\/stats\/daily\/\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("row").filter({ hasText: "alice" })).toBeVisible();
  await expect(page.getByText("hours remaining")).toBeVisible();
  await page.screenshot({ path: "test-results/daily.png" });
});
