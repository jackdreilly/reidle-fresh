import { expect, test } from "@playwright/test";
import { signIn, sql, typeWord } from "./helpers";

test("two players share a private battle room and a win syncs live", async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  await signIn(alice, "alice", "/battles");
  await signIn(bob, "bob", "/battles");

  // alice opens a private room; bob joins via the shared link
  await alice.getByRole("link", { name: "Private Room" }).click();
  await expect(alice).toHaveURL(/\/battles\/\d+$/);
  await expect(alice.getByText("Nobody else is in the battle")).toBeVisible();
  const url = alice.url();
  const id = url.match(/battles\/(\d+)/)![1];
  await bob.goto(url);

  // both see the board once two people are present
  await expect(alice.getByText("Nobody else is in the battle")).toHaveCount(0, { timeout: 15_000 });
  await expect(bob.getByText("Nobody else is in the battle")).toHaveCount(0, { timeout: 15_000 });

  // alice wins the round with the answer; bob sees it through realtime
  const answer = sql(`select upper(state->'game'->>'answer') from battles where battle_id = ${id}`);
  await alice.waitForTimeout(800);
  await typeWord(alice, answer);
  await expect(bob.getByText(/alice Won|Won the game/i).first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => sql(`select state->>'last_player' from battles where battle_id = ${id}`), { timeout: 15_000 }).toBe("alice");
  expect(sql(`select state->'leaderboard'->>'alice' from battles where battle_id = ${id}`)).toBe("1");
});

test("battle lobby lists the party room and active rooms", async ({ page }) => {
  await signIn(page, "carol", "/battles");
  await expect(page.getByRole("heading", { name: "Battles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Party Room" })).toBeVisible();
});
