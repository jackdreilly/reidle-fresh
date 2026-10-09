import { expect, test } from "@playwright/test";
import { signIn, sql, typeWord } from "./helpers";

test("daily game: play, win, appear on the leaderboard, cannot replay", async ({ page }) => {
  await signIn(page, "erin", "/play");
  const answer = sql("select upper(answer) from daily_words where day = current_date");
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: "Start" }).click();
  // starting word is forced and auto-submitted; wait for it to land
  await expect(page.locator("div.font-bold").first()).toBeVisible();
  await page.waitForTimeout(500);
  await typeWord(page, answer);
  await expect(page.getByText(/^\d+:\d{2}$/).first()).toBeVisible();
  await expect.poll(() => sql("select count(*) from submissions where name='erin' and day=current_date and challenge_id is null")).toBe("1");

  await page.goto("/stats/today");
  await expect(page.getByRole("row").filter({ hasText: "erin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play", exact: true })).toHaveCount(0); // nav hides Play once played
  await page.goto("/play");
  await expect(page).toHaveURL(/\/stats\/daily\//); // already played -> home
});

test("after winning, the in-app home link shows today's pastes and playbacks without a reload", async ({ page }) => {
  await signIn(page, "ivan");
  // Stay inside the SPA the whole time, like a player: stats -> Play -> win -> dog.
  await page.goto("/stats/today");
  await expect(page.locator("td.invisible, a.invisible").first()).toBeAttached();
  await page.locator('aside a[href="/play"]').click();
  await expect(page).toHaveURL(/\/play$/);
  const answer = sql("select upper(answer) from daily_words where day = current_date");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("div.font-bold").first()).toBeVisible();
  await page.waitForTimeout(500);
  await typeWord(page, answer);
  await expect.poll(() => sql("select count(*) from submissions where name='ivan' and day=current_date and challenge_id is null")).toBe("1");

  await page.getByRole("link", { name: "Reidle Logo" }).click(); // the dog: client-side nav, no reload
  await expect(page).toHaveURL(/\/stats\/daily\//);
  await expect(page.getByRole("row").filter({ hasText: "ivan" })).toBeVisible();
  await expect(page.locator("td.invisible, a.invisible")).toHaveCount(0);
  await expect(page.locator('a[href="/play"]:visible')).toHaveCount(0);
});

test("today's pastes and playbacks stay hidden until you have played", async ({ page }) => {
  await signIn(page, "frank");
  const id = sql("select submission_id from submissions where name='bob' and day = current_date and challenge_id is null");
  await page.goto(`/submissions/${id}/playback`);
  await expect(page.getByText("You need to play today to see this")).toBeVisible();
  await page.goto("/stats/today");
  await expect(page.locator("td.invisible, a.invisible").first()).toBeAttached();
});

test("practice game loads with a stable word via URL params", async ({ page }) => {
  await signIn(page, "grace", "/practice");
  await expect(page).toHaveURL(/\/practice\?word=\d+&startingWord=\d+/);
  await expect(page.getByText("Practice").first()).toBeVisible();
});

test("loading /play never starts the clock or leaks the word; only the Start POST does", async ({ page }) => {
  await signIn(page, "grace");
  const count = () => sql("select count(*) from checkpoints where name='grace' and day=current_date");
  const word = sql("select upper(answer) from daily_words where day = current_date");

  // visit, reload, prefetch-style revisits: none of it may create a checkpoint or expose the answer
  const bodies: string[] = [];
  page.on("response", async (r) => { if (r.url().includes("/rpc/")) bodies.push(await r.text().catch(() => "")); });
  await page.goto("/play");
  await page.reload();
  await page.goto("/stats/today");
  await page.locator('aside a[href="/play"]').hover();
  await page.goto("/play");
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  expect(count()).toBe("0");
  expect(bodies.join("")).not.toContain(word);

  // pressing Start is the single start event; it is idempotent and survives reload (clock keeps running)
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
  expect(count()).toBe("1");
  const startedAt = sql("select created_at from checkpoints where name='grace'");
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0); // resumes, no new start gate
  expect(sql("select created_at from checkpoints where name='grace'")).toBe(startedAt);
});

test("timer starts at ~0 even when the device clock is minutes off", async ({ page }) => {
  await page.clock.install({ time: Date.now() + 5 * 60_000 }); // device clock 5 minutes fast
  await signIn(page, "heidi", "/play");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText(/^0:0\d$/).first()).toBeVisible({ timeout: 10_000 });
});
