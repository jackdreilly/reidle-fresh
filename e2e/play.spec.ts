import { expect, test } from "@playwright/test";
import { signIn, sql, typeWord } from "./helpers";

test("daily game: play, win, appear on the leaderboard, cannot replay", async ({ page }) => {
  await signIn(page, "erin", "/play");
  const answer = sql("select upper(answer) from daily_words where day = current_date");
  await expect(page).toHaveURL(/\/play$/);
  // starting word is forced and auto-submitted; wait for it to land
  await expect(page.locator("div.font-bold").first()).toBeVisible();
  await page.waitForTimeout(500);
  await typeWord(page, answer);
  await expect(page.getByText(/^\d+:\d{2}$/).first()).toBeVisible();
  await expect.poll(() => sql("select count(*) from submissions where name='erin' and day=current_date and challenge_id is null")).toBe("1");

  await page.goto("/stats/today");
  await expect(page.getByRole("row").filter({ hasText: "erin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play" })).toHaveCount(0); // nav hides Play once played
  await page.goto("/play");
  await expect(page).toHaveURL(/\/stats\/daily\//); // already played -> home
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
