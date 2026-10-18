import { expect, test } from "@playwright/test";
import { signIn, sql, typeWord } from "./helpers";

test("challenges page shows leaderboards, history and open challenges", async ({ page }) => {
  await signIn(page, "alice", "/challenges");
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your challenges today" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Next challenge|Start a new challenge/ })).toBeVisible();
  const board = page.getByRole("table").first();
  await expect(board.getByRole("row").filter({ hasText: "alice" })).toBeVisible();
  await page.getByRole("tab", { name: "yesterday" }).click();
  await expect(page.getByRole("table").first().getByRole("row").filter({ hasText: "bob" })).toBeVisible();
});

test("open challenges are listed with a badge in the top bar", async ({ page }) => {
  // heidi has played no challenge: every challenge someone played today is open for her.
  const open = sql("select count(*) from challenges c where c.created_at >= current_date and exists (select 1 from submissions s where s.challenge_id = c.challenge_id)");
  await page.setViewportSize({ width: 390, height: 844 }); // phone: the top-bar pills show
  await signIn(page, "heidi", "/challenges");
  await expect(page.getByRole("heading", { name: new RegExp(`^${open} challenges? waiting for you`) })).toBeVisible();
  await expect(page.getByRole("link", { name: /'s challenge/ })).toHaveCount(Number(open));
  await expect(page.getByRole("link", { name: `Challenges (${open} open)` })).toBeVisible();
});

test("play a pending challenge, win, and see it on the challenge page", async ({ page }) => {
  await signIn(page, "heidi", "/challenges");
  await page.getByRole("link", { name: /Next challenge|Start a new challenge/ }).click();
  await expect(page).toHaveURL(/\/challenges\/challenge\/\d+\/play$/);
  const id = page.url().match(/challenge\/(\d+)\/play/)![1];
  const answer = sql(`select upper(answer) from challenges where challenge_id = ${id}`);
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForTimeout(800);
  await typeWord(page, answer);
  await expect.poll(() => sql(`select count(*) from submissions where challenge_id=${id} and name='heidi'`)).toBe("1");

  await page.getByRole("link", { name: "Results" }).click();
  await expect(page).toHaveURL(new RegExp(`/challenges/challenge/${id}$`));
  await expect(page.getByRole("table").first().getByRole("row").filter({ hasText: "heidi" })).toBeVisible();
  await expect(page.getByLabel(answer)).toBeVisible(); // answer revealed once played
  // the challenges leaderboard sits on the same page
  await expect(page.getByRole("heading", { name: "Leaderboard" })).toBeVisible();
  await expect(page.getByRole("table").nth(1).getByRole("row").filter({ hasText: "heidi" })).toBeVisible();
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

/** A fresh challenge that alice has already won in 1 second, so anyone playing it falls behind at once. */
function quickChallenge() {
  const id = sql(`insert into challenges (starting_word, answer)
    select (select word from words order by random() limit 1), (select answer from answers order by random() limit 1)
    returning challenge_id`).split("\n")[0]; // psql also prints the INSERT tag
  sql(`insert into submissions (challenge_id, day, name, "time", penalty, word, paste) values (${id}, current_date, 'alice', 1, 0, 'x', '')`);
  return { id, answer: sql(`select upper(answer) from challenges where challenge_id = ${id}`) };
}

test("losing a challenge offers to show the answer", async ({ page }) => {
  const { id, answer } = quickChallenge();
  await signIn(page, "ivy", `/challenges/challenge/${id}/play`);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("alice wins this one")).toBeVisible();
  await page.getByRole("button", { name: "Show answer" }).click();
  await expect(page.getByText("answer shown")).toBeVisible();
  await expect.poll(() => sql(`select count(*) from submissions where challenge_id=${id} and name='ivy'`)).toBe("1");
  await page.getByRole("link", { name: "Results" }).click();
  await expect(page.getByLabel(answer)).toBeVisible();
});

test("losing a challenge lets you keep playing and log your own time", async ({ page }) => {
  const { id, answer } = quickChallenge();
  await signIn(page, "jill", `/challenges/challenge/${id}/play`);
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.getByText("Your time still counts")).toBeVisible();
  await expect.poll(() => sql(`select count(*) from submissions where challenge_id=${id} and name='jill'`)).toBe("0");
  await typeWord(page, answer);
  await expect(page.getByText("not the fastest")).toBeVisible();
  await expect.poll(() => sql(`select count(*) from submissions where challenge_id=${id} and name='jill'`)).toBe("1");
});
