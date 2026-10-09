import { expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

export async function signIn(page: Page, name: string, to = "/") {
  await page.goto(`/sign-in?redirect=${encodeURIComponent(to)}`);
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
