import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

test("a page seen before shows at once from the device, then takes the fresh data", async ({ page }) => {
  await signIn(page, "alice", "/stats/past_winners");
  await expect(page.getByText("alice").first()).toBeVisible();
  await page.goto("/help"); // a full reload too: the kept data survives it
  await expect(page.getByRole("heading", { name: /help/i }).first()).toBeVisible();

  // the server is slow now: the kept power rankings still show straight away, and the answer swaps in later
  let answered = false;
  await page.route("**/rest/v1/rpc/past_page", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    answered = true;
    await route.continue();
  });
  await page.getByRole("link", { name: "Past", exact: true }).first().click();
  await expect(page).toHaveURL(/\/stats\/past_winners$/);
  await expect(page.getByText("alice").first()).toBeVisible({ timeout: 1000 });
  expect(answered).toBe(false);
  await expect.poll(() => answered, { timeout: 5000 }).toBe(true);
});

test("page-show times reach the dashboard's numbers", async ({ page }) => {
  await signIn(page, "alice");
  await expect(page.getByRole("row").filter({ hasText: "alice" })).toBeVisible();
  await page.getByRole("link", { name: "Help" }).first().click();
  await expect(page).toHaveURL(/\/help$/);
  await expect.poll(() => sql("select count(*) from page_views where name = 'alice' and load_ms is not null and nav = 'nav'"),
    { timeout: 20_000 }).not.toBe("0");
  expect(Number(sql("select count(*) from page_views where name = 'alice' and load_ms is not null and nav in ('cold', 'warm')"))).toBeGreaterThan(0);
});
