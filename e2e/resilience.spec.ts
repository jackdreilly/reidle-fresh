import { expect, test } from "@playwright/test";
import { sql } from "./helpers";

// Route interception only sees page requests when the service worker is out of the way.
test.use({ serviceWorkers: "block" });

test("a stale deploy (route chunk 404) recovers with one automatic reload", async ({ page }) => {
  let blocked = 0;
  await page.route(/\/assets\/Daily-[^/]+\.js$/, (route) => {
    if (blocked++ === 0) return route.fulfill({ status: 404, body: "gone" }); // old build's chunk is gone
    return route.continue();
  });
  await page.goto("/sign-in");
  await page.getByPlaceholder("Your name").fill("dave");
  await page.locator('input[type="submit"]').click();
  await expect(page.getByRole("row").filter({ hasText: "dave" })).toBeVisible({ timeout: 15_000 });
  expect(blocked).toBeGreaterThanOrEqual(2); // first attempt failed, the reload fetched it fine
});

test("a network failure during sign-in shows an error and never creates an account", async ({ page }) => {
  const signups: string[] = [];
  page.on("request", (r) => r.url().includes("/auth/v1/signup") && signups.push(r.url()));
  await page.route("**/auth/v1/token*", (route) => route.abort("connectionfailed"));
  await page.goto("/sign-in");
  await page.getByPlaceholder("Your name").fill("ghostuser");
  await page.locator('input[type="submit"]').click();
  await expect(page.getByText(/Can't reach the server/)).toBeVisible();
  await expect(page.locator('input[type="submit"]')).toBeEnabled(); // not stuck on a spinner
  expect(signups).toHaveLength(0);
  expect(sql("select count(*) from players where name = 'ghostuser'")).toBe("0");
});
