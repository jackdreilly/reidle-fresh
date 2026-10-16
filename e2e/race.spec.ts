import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("weekly race: points and standing views, replay", async ({ page }) => {
  test.skip(new Date().getUTCDay() === 1, "the race needs two days of the week");
  await signIn(page, "alice", "/stats/this_week");
  const race = page.locator("section").filter({ hasText: "The race" });
  await expect(race.getByRole("img", { name: "Running points through the week" })).toBeVisible();
  await race.getByRole("button", { name: "Standing" }).click();
  await expect(race.getByRole("img", { name: "Standings through the week" })).toBeVisible();
  await race.getByRole("button", { name: /Replay/ }).click();
});
