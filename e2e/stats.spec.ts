import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

test.beforeEach(async ({ page }) => signIn(page, "alice"));

test("current week uses additive points (Σ), prior week legacy product (Π)", async ({ page }) => {
  await page.goto("/stats/this_week");
  await expect(page).toHaveURL(/\/stats\/weekly\/\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("columnheader", { name: "Σ" })).toBeVisible();
  // total (Σ) must equal the sum of the daily points shown
  const days = Number(sql("select (current_date - date_trunc('week', current_date)::date) + 1"));
  const cells = await page.getByRole("row").filter({ hasText: "alice" }).getByRole("cell").allInnerTexts();
  const points = cells.slice(0, days).map(Number);
  expect(points.every((p) => Number.isInteger(p) && p >= 0 && p <= 40)).toBe(true);
  expect(Number(cells[days])).toBe(points.reduce((a, b) => a + b, 0));

  // a fixed pre-cutover week (2026-10-05): always legacy scoring, whatever today's date is
  await page.goto("/stats/weekly/2026-09-14");
  await expect(page.getByRole("columnheader", { name: "Π" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "alice" })).toBeVisible();
});

test("past tab: power rankings, records and every week's podium", async ({ page }) => {
  await page.goto("/stats/past_winners");
  await expect(page.getByRole("heading", { name: "Power rankings" })).toBeVisible();
  const first = page.getByRole("heading", { name: "Power rankings" }).locator("xpath=../..").getByRole("listitem").first();
  await expect(first.getByLabel(/^Recent finishes: /)).toBeVisible();
  await first.getByRole("button").click();
  await expect(page.getByText(/Career high #\d+/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Most weekly titles" }).getByRole("link").first()).toBeVisible();
  await expect(page.getByText("Weeks at #1", { exact: true })).toBeVisible();
  const weeks = page.getByRole("list", { name: "Weekly podiums" });
  await expect(weeks.getByText("so far")).toBeVisible();
  const before = await weeks.getByRole("link").count();
  await page.getByRole("button", { name: "Show older weeks" }).click();
  await expect.poll(() => weeks.getByRole("link").count()).toBeGreaterThan(before);
  await weeks.getByRole("link").nth(1).click();
  await expect(page).toHaveURL(/\/stats\/weekly\/\d{4}-\d{2}-\d{2}$/);
});

test("player page and rankings render charts", async ({ page }) => {
  await page.goto("/players/alice");
  await expect(page.getByText(/Playing since \w+ \d{4} · [\d,]+ games/)).toBeVisible();
  await expect(page.getByText("Head to head", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Rolling median solve time" })).toBeVisible();
  await expect(page.getByText(/weeks? won/)).toBeVisible();
  await page.goto("/rankings");
  await expect(page.getByText("Reidle Power Rankings")).toBeVisible();
  await expect(page.locator("svg path[stroke-width='12']").first()).toBeAttached();
});

test("player page compares other players on the charts", async ({ page }) => {
  await page.goto("/players/alice");
  await page.getByRole("button", { name: "+ bob" }).click();
  await expect(page).toHaveURL(/\/players\/alice\?vs=bob$/);
  await expect(page.getByRole("columnheader", { name: "bob" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Rolling median solve time" }).locator("polyline")).toHaveCount(2);
  await page.getByLabel("Compare with player").fill("Carol");
  await page.getByLabel("Compare with player").press("Enter");
  await expect(page).toHaveURL(/\?vs=bob,carol$/);
  await expect(page.getByRole("columnheader", { name: "carol" })).toBeVisible();
  await page.getByRole("button", { name: "Stop comparing with bob" }).click();
  await expect(page).toHaveURL(/\?vs=carol$/);
  await expect(page.getByRole("columnheader", { name: "bob" })).toHaveCount(0);
});

test("on another player's page, me is the first compare choice", async ({ page }) => {
  await page.goto("/players/bob");
  await page.getByRole("button", { name: "+ me (alice)" }).click();
  await expect(page).toHaveURL(/\/players\/bob\?vs=alice$/);
  await expect(page.getByRole("columnheader", { name: "alice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ me (alice)" })).toHaveCount(0);
  await page.goto("/players/alice");
  await expect(page.getByRole("button", { name: /^\+ me/ })).toHaveCount(0);
});

test("playback of a past submission animates", async ({ page }) => {
  const id = sql("select submission_id from submissions where name='bob' and day < current_date and challenge_id is null limit 1");
  await page.goto(`/submissions/${id}/playback`);
  await expect(page.getByText("You need to play today")).toHaveCount(0);
  await expect(page.getByText(/^\d+:\d{2}$/).first()).toBeVisible();
  await expect(page.getByText("Wrong C @ 1")).toBeVisible({ timeout: 10_000 });
});

test("clicking a paste on the daily table opens that player's playback", async ({ page }) => {
  const day = sql("select max(day) from submissions where name='bob' and day < current_date and challenge_id is null");
  const id = sql(`select submission_id from submissions where name='bob' and day='${day}' and challenge_id is null`);
  await page.goto(`/stats/daily/${day}`);
  await expect(page.getByRole("columnheader", { name: "Watch" })).toHaveCount(0);
  await page.getByRole("row").filter({ hasText: "bob" }).getByRole("link", { name: "Watch bob's replay" }).click();
  await expect(page).toHaveURL(new RegExp(`/submissions/${id}/playback$`));
  await expect(page.getByText(/^\d+:\d{2}$/).first()).toBeVisible();
});

test("unknown route shows not-found", async ({ page }) => {
  await page.goto("/nope/nothing/here");
  await expect(page.getByText("Not found")).toBeVisible();
});
