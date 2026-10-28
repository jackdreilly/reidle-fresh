import { expect, test } from "@playwright/test";
import { signIn, sql } from "./helpers";

test("new players get a tour once; closing it sticks to the player, not the device", async ({ page, browser }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Not ready? Try it as a guest" }).click();
  const tour = page.getByRole("dialog");
  await expect(tour.getByRole("heading", { name: /Welcome to Reidle/ })).toBeVisible();
  await expect(tour).toContainText("Reidle Global");
  for (const title of ["How a game works", "Play the daily", "More ways to play", "Your league"]) {
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(tour).toContainText("You're playing as a guest");
  await page.screenshot({ path: "test-results/tour-last-step.png" });
  await tour.getByRole("button", { name: "Play today's word" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(tour).toBeHidden();

  await expect.poll(() => sql("select tour_seen from players p join auth.users u on u.id = p.user_id where u.is_anonymous order by p.created_at desc limit 1"))
    .toBe("t");
  await page.goto("/stats/today");
  await expect(page.getByRole("link", { name: /League Reidle Global/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // another device: a fresh name-only sign-up sees it, skips it, and it stays gone there too
  const other = await (await browser.newContext()).newPage();
  await signIn(other, "tina", "/", { fresh: true });
  await expect(other.getByRole("dialog")).toBeVisible();
  await other.getByRole("button", { name: "Skip" }).click();
  await expect(other.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => sql("select tour_seen from players where name = 'tina'")).toBe("t");
  const third = await (await browser.newContext()).newPage();
  await signIn(third, "tina", "/stats/today", { fresh: true });
  await expect(third.getByRole("link", { name: /League Reidle Global/ })).toBeVisible();
  await expect(third.getByRole("dialog")).toHaveCount(0);
});

test("help page covers the basics and can replay the tour", async ({ page }) => {
  await signIn(page, "alice", "/help");
  await expect(page.getByRole("heading", { name: "Help", exact: true })).toBeVisible();
  for (const h of ["How a game works", "The daily", "Challenges", "Battles", "Practice", "Leagues and invites"]) {
    await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: "test-results/help.png", fullPage: true });
  await page.getByRole("button", { name: "Show the tour again" }).click();
  await page.getByRole("dialog").getByRole("heading", { name: /Welcome to Reidle/ }).click(); // focus this page (earlier specs leave pages open)
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("after their first game, new players get a reminder card once: it opens notification settings", async ({ page, browser }) => {
  await signIn(page, "rita", "/stats/today", { fresh: true });
  await page.getByRole("dialog").getByRole("button", { name: "Skip" }).click();
  const card = page.getByRole("region", { name: "Daily reminder" });
  await expect(page.getByRole("link", { name: /League Reidle Global/ })).toBeVisible();
  await expect(card).toHaveCount(0); // not before they've played
  sql(`insert into submissions (league_id, day, name, "time", penalty, word, paste)
       select 2, league_day(2), 'rita', 30, 0, 'x', '' `);
  await page.reload();
  await expect(card).toContainText("Want a nudge each day?");
  await page.screenshot({ path: "test-results/reminder-card.png" });
  await card.getByRole("link", { name: "Set up a reminder" }).click();
  await expect(page).toHaveURL(/\/account/);
  await expect(page.locator("#notifications")).toBeInViewport();
  await expect.poll(() => sql("select reminder_prompt_seen from players where name = 'rita'")).toBe("t");

  // answered once = gone on every device
  const other = await (await browser.newContext()).newPage();
  await signIn(other, "rita", "/stats/today", { fresh: true });
  await expect(other.getByRole("link", { name: /League Reidle Global/ })).toBeVisible();
  await expect(other.getByRole("region", { name: "Daily reminder" })).toHaveCount(0);

  // the × dismisses it too
  sql("update players set reminder_prompt_seen = false where name = 'rita'");
  await other.reload();
  await other.getByRole("region", { name: "Daily reminder" }).getByRole("button", { name: "Dismiss" }).click();
  await expect(other.getByRole("region", { name: "Daily reminder" })).toHaveCount(0);
  await expect.poll(() => sql("select data ->> 'outcome' from events where kind = 'reminder_prompt' order by at desc limit 1")).toBe("dismissed");
});
