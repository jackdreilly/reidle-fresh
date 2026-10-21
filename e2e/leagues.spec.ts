import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

test("one league: straight in, the sidebar names it", async ({ page }) => {
  await signIn(page, "alice");
  await expect(page).toHaveURL(/\/stats\/daily\//);
  await expect(page.getByRole("link", { name: /League Reidle OG/ })).toBeVisible();
});

test("several leagues: a dashboard, and playing one leaves the others to play", async ({ page }) => {
  await signIn(page, "kim");
  await expect(page).toHaveURL(/\/leagues$/);
  await expect(page.getByRole("heading", { name: "Book Club" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reidle OG" })).toBeVisible();
  await page.screenshot({ path: "test-results/leagues-dashboard.png" });
  // open Book Club's daily
  await page.locator("section").filter({ hasText: "Book Club" }).getByRole("button", { name: "▶ Play" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("button", { name: /start/i }).click();
  await expect.poll(() => sql("select league_id from checkpoints where name = 'kim'")).toBe("3");
  await expect.poll(() => sql("select count(*) from daily_words where league_id = 3")).toBe("1");
});

test("create a league, invite by link, join, commissioner scoring", async ({ page, browser }) => {
  await signIn(page, "nina", "/leagues/new");
  await page.getByPlaceholder("e.g. The Reillys").fill("Nina Pals");
  await page.getByRole("button", { name: "Create league" }).click();
  await expect(page).toHaveURL(/\/league\?created=1$/);
  await expect(page.getByText("Your league is ready")).toBeVisible();
  const link = await page.getByLabel("Invite link").inputValue();
  expect(link).toMatch(/\/join\/[0-9a-f]{10}$/);

  // commissioner: Formula 1 points
  await page.getByLabel(/Formula 1/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Scoring: 25, 18, 15")).toBeVisible();
  await page.screenshot({ path: "test-results/league-settings.png", fullPage: true });

  // a friend opens the link signed out, signs in, joins
  const friend = await (await browser.newContext()).newPage();
  await friend.goto(new URL(link).pathname);
  await expect(friend.getByRole("heading", { name: "Nina Pals" })).toBeVisible();
  await friend.getByRole("link", { name: "Sign in to join" }).click();
  await friend.getByPlaceholder("Your name").fill("omar");
  await friend.locator('input[type="submit"]').click();
  await friend.getByRole("button", { name: "Join Nina Pals" }).click();
  await expect(friend).toHaveURL(/\/stats\/daily\//);
  await expect.poll(() => sql("select string_agg(l.name, ',' order by l.name) from league_members m join leagues l using (league_id) where m.name = 'omar'"))
    .toBe("Nina Pals,Reidle Global");
  await expect(friend.getByRole("link", { name: /League · switch Nina Pals/ })).toBeVisible();
});

test("no league yet: pick one", async ({ page }) => {
  await signIn(page, "pat", "/", { fresh: true });
  sql("delete from league_members where name = 'pat'"); // e.g. left their only league
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole("button", { name: "Join Reidle Global" }).click();
  await expect(page).toHaveURL(/\/stats\/daily\//);
  await expect(page.getByRole("link", { name: /League Reidle Global/ })).toBeVisible();
});
