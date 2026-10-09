import { expect, test } from "@playwright/test";
import { signIn, sql, typeWord } from "./helpers";

test("challenges page shows leaderboards, history and pending count", async ({ page }) => {
  await signIn(page, "alice", "/challenges");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Challenges" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pending Challenge|Start New Challenge/ })).toBeVisible();
  const board = page.getByRole("table").first();
  await expect(board.getByRole("row").filter({ hasText: "alice" })).toBeVisible();
});

test("play a pending challenge, win, and see it on the challenge page", async ({ page }) => {
  await signIn(page, "heidi", "/challenges");
  await page.getByRole("link", { name: /Pending Challenge|Start New Challenge/ }).click();
  await expect(page).toHaveURL(/\/challenges\/challenge\/\d+\/play$/);
  const id = page.url().match(/challenge\/(\d+)\/play/)![1];
  const answer = sql(`select upper(answer) from challenges where challenge_id = ${id}`);
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForTimeout(800);
  await typeWord(page, answer);
  await expect.poll(() => sql(`select count(*) from submissions where challenge_id=${id} and name='heidi'`)).toBe("1");

  await page.goto(`/challenges/challenge/${id}`);
  await expect(page.getByRole("row").filter({ hasText: "heidi" })).toBeVisible();
  await page.goto(`/challenges/challenge/${id}/play`);
  await expect(page).toHaveURL(new RegExp(`/challenges/challenge/${id}$`)); // already played
});

test("a challenge's pastes stay hidden until you've played it", async ({ page }) => {
  await signIn(page, "erin");
  const id = sql("select challenge_id from challenges c where not exists (select 1 from submissions s where s.challenge_id=c.challenge_id and s.name='erin') and exists (select 1 from submissions s where s.challenge_id=c.challenge_id) limit 1");
  await page.goto(`/challenges/challenge/${id}`);
  await expect(page.locator(`a[href="/challenges/challenge/${id}/play"]`)).toBeVisible();
  await expect(page.locator("td.invisible").first()).toBeAttached();
});
