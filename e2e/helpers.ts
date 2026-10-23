import { expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

/**
 * Name-only sign-in. New names are put in the founding league first (like the original crew), unless
 * `fresh`: then they start where a brand-new name-only player does (Reidle Global).
 */
export async function signIn(page: Page, name: string, to = "/", { fresh = false } = {}) {
  if (!fresh) {
    sql(`insert into players (name, tour_seen) values ('${name}', true) on conflict do nothing;
      insert into league_members (league_id, name) values (1, '${name}') on conflict do nothing`);
  }
  await page.goto(`/sign-in?redirect=${encodeURIComponent(to)}`);
  await page.getByText("Played before leagues?").click();
  await page.getByPlaceholder("Your name").fill(name);
  await page.locator('input[type="submit"]').click();
  await expect(page).not.toHaveURL(/sign-in/);
}

/** Direct DB access to the local stack, for arranging/inspecting state. */
export function sql(query: string): string {
  return execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -At -c "${query.replace(/"/g, '\\"')}"`)
    .toString().trim();
}

/** Types a word on the physical keyboard handler and submits it. */
export async function typeWord(page: Page, word: string) {
  for (const ch of word) await page.keyboard.press(ch);
  await page.keyboard.press("Enter");
}
