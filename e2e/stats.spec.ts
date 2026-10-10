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

test("past winners lists last week's winner", async ({ page }) => {
  await page.goto("/stats/past_winners");
  await expect(page.getByRole("row").filter({ hasText: "alice" }).first()).toBeVisible();
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
