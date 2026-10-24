import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

test("visits, errors and the owner dashboard (admins with a saved login only)", async ({ page, browser }) => {
  await signIn(page, "alice", "/stats/today"); // alice is the fixture's admin
  // admins need a verified login: give alice a Google identity
  sql(`insert into auth.identities (provider_id, user_id, identity_data, provider)
       select 'g-alice', user_id, '{"sub":"g-alice"}', 'google' from players where name = 'alice' on conflict do nothing`);

  // pages and time on screen are reported (after the first page, by src/lib/telemetry.ts)
  await expect.poll(() => sql("select count(*) from page_views where name = 'alice'"), { timeout: 15_000 }).not.toBe("0");
  await page.getByRole("link", { name: "Messages" }).first().click();
  await expect(page).toHaveURL(/\/messages/);
  await page.evaluate(() => setTimeout(() => { throw new Error("e2e boom"); }));
  await expect.poll(() => sql("select data ->> 'message' from events where kind = 'error' and name = 'alice' order by at desc limit 1"))
    .toContain("e2e boom");

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  for (const h of ["Day by day", "When people play", "How long a visit lasts", "Pages", "Players", "Retention", "Browser errors"]) {
    await expect(page.getByRole("heading", { name: h, exact: false }).first()).toBeVisible();
  }
  await expect(page.getByText("e2e boom").first()).toBeVisible();
  await expect(page.locator("#pages")).toContainText("/stats/daily/:date");
  await page.screenshot({ path: "test-results/admin.png", fullPage: true });

  await page.locator("#players tr", { hasText: "alice" }).first().click();
  const sheet = page.getByRole("dialog", { name: "alice" });
  await expect(sheet).toContainText("Recent visits");
  await expect(sheet).toContainText("/stats/daily/:date");
  await page.screenshot({ path: "test-results/admin-player.png" });

  // a name-only admin (anyone typing the name) and a non-admin both get nothing
  sql("delete from auth.identities where provider_id = 'g-alice'");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Day by day" })).toHaveCount(0);
  const other = await (await browser.newContext()).newPage();
  await signIn(other, "bob", "/stats/today");
  await other.goto("/admin");
  await expect(other.getByRole("heading", { name: "Admin" })).toHaveCount(0);
});
