import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

test("the activity log records sign-ins and browser errors; /admin shows them to admins only", async ({ page, browser }) => {
  await signIn(page, "alice", "/stats/today"); // alice is the fixture's admin
  await page.evaluate(() => setTimeout(() => { throw new Error("e2e boom"); }));
  await expect.poll(() => sql("select data ->> 'message' from events where kind = 'error' and name = 'alice' order by at desc limit 1"))
    .toContain("e2e boom");

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Day by day (Pacific)" })).toBeVisible();
  await expect(page.getByText("e2e boom")).toBeVisible();
  await expect(page.getByText(/signed in \(name/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/admin.png", fullPage: true });

  const other = await (await browser.newContext()).newPage();
  await signIn(other, "bob", "/stats/today");
  await other.goto("/admin");
  await expect(other.getByRole("heading", { name: "Admin" })).toHaveCount(0);
  await expect.poll(() => sql("select data ->> 'message' from events where kind = 'error' and name = 'bob' order by at desc limit 1"))
    .toContain("admins only");
});
