import { expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { credentials } from "../src/lib/credentials";

const AUTH = "http://127.0.0.1:54321/auth/v1";
const APIKEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

/**
 * Signs in as player `name` with an old-style name account (there is no name sign-in in the app any more:
 * the account is made straight through the local auth API and its tokens handed to the page). New names are put
 * in the founding league first (like the original crew), unless `fresh`: then they start in Reidle Global.
 */
export async function signIn(page: Page, name: string, to = "/", { fresh = false } = {}) {
  if (!fresh) {
    sql(`insert into players (name, tour_seen) values ('${name}', true) on conflict do nothing;
      insert into league_members (league_id, name) values (1, '${name}') on conflict do nothing`);
  }
  const creds = await credentials(name);
  const call = (path: string, body: unknown) => fetch(`${AUTH}${path}`, {
    method: "POST", headers: { apikey: APIKEY, authorization: `Bearer ${APIKEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let res = await call("/token?grant_type=password", creds);
  if (!res.ok) res = await call("/signup", { ...creds, data: { name } });
  const t = await res.json();
  expect(t.access_token, `sign in as ${name}: ${JSON.stringify(t)}`).toBeTruthy();
  await page.goto("/privacy.html"); // same origin, without booting the app
  await page.evaluate((v) => localStorage.setItem("reidle:auth", v), JSON.stringify({
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600),
  }));
  await page.goto(to);
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
