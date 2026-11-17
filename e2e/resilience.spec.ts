import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

// Route interception only sees page requests when the service worker is out of the way.
test.use({ serviceWorkers: "block" });

test("a stale deploy (route chunk 404) recovers with one automatic reload", async ({ page }) => {
  let blocked = 0;
  await page.route(/\/assets\/Daily-[^/]+\.js$/, (route) => {
    if (blocked++ === 0) return route.fulfill({ status: 404, body: "gone" }); // old build's chunk is gone
    return route.continue();
  });
  await signIn(page, "dave");
  await expect(page.getByRole("row").filter({ hasText: "dave" })).toBeVisible({ timeout: 15_000 });
  expect(blocked).toBeGreaterThanOrEqual(2); // first attempt failed, the reload fetched it fine
});

test("a network failure during sign-in shows an error and never creates an account", async ({ page }) => {
  const guests = () => sql("select count(*) from auth.users where is_anonymous");
  const before = guests();
  await page.route("**/auth/v1/signup*", (route) => route.abort("connectionfailed"));
  await page.goto("/sign-in");
  const guest = page.getByRole("button", { name: "Not ready? Try it as a guest" });
  await guest.click();
  await expect(page.getByText(/Can't reach the server/)).toBeVisible();
  await expect(guest).toBeEnabled(); // not stuck on a spinner
  expect(guests()).toBe(before);
});
