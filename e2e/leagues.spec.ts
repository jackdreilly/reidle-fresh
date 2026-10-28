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
  await signIn(page, "nina", "/league");
  await page.getByRole("link", { name: "+ Start another league" }).click();
  await page.getByPlaceholder("e.g. The Reillys").fill("Nina Pals");
  await page.getByRole("button", { name: "Create league" }).click();
  await expect(page).toHaveURL(/\/league\?created=1$/);
  await expect(page.getByText("Your league is ready")).toBeVisible();
  const link = await page.getByLabel("Invite link", { exact: true }).inputValue();
  expect(link).toMatch(/\/join\/[0-9a-f]{10}$/);

  // commissioner: Formula 1 points
  await page.getByLabel(/Formula 1/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Scoring: 25, 18, 15")).toBeVisible();
  await page.screenshot({ path: "test-results/league-settings.png", fullPage: true });

  // a friend opens the link signed out, signs in, joins
  const friend = await (await browser.newContext()).newPage();
  await friend.goto(new URL(link).pathname);
  await expect(friend.getByRole("heading", { name: "Nina Pals", exact: true })).toBeVisible();
  // the sign-in options are right on the invite; guests are pointed at Reidle Global instead
  await expect(friend.getByRole("heading", { name: "Sign in to join Nina Pals" })).toBeVisible();
  await expect(friend.getByRole("button", { name: "Email me a link" })).toBeVisible();
  await expect(friend.getByRole("button", { name: "Not ready? Play as a guest in Reidle Global" })).toBeVisible();
  await friend.screenshot({ path: "test-results/invite-signed-out.png", fullPage: true });
  // back from signing in, it joins by itself
  await friend.getByRole("link", { name: "Played before leagues? Sign in with your name" }).click();
  await friend.getByText("Played before leagues?").click();
  await friend.getByPlaceholder("Your name").fill("omar");
  await friend.locator('input[type="submit"]').click();
  await expect(friend).toHaveURL(/\/stats\/daily\//);
  await expect.poll(() => sql("select string_agg(l.name, ',' order by l.name) from league_members m join leagues l using (league_id) where m.name = 'omar'"))
    .toBe("Nina Pals,Reidle Global");
  await expect(friend.getByRole("link", { name: /League · switch Nina Pals/ })).toBeVisible();
  // the owner's invite funnel: opened signed out, then again as omar, in the same tab
  await expect.poll(() => sql(`select string_agg(coalesce(e.name, '-'), ',' order by e.at) from events e join leagues l using (league_id)
                               where e.kind = 'invite_open' and l.name = 'Nina Pals'`)).toBe("-,omar");

  // open invite by default: omar sees the link; once Nina keeps it to commissioners, he doesn't
  await friend.goto("/league");
  await expect(friend.getByLabel("Invite link", { exact: true })).toHaveValue(link);
  await page.getByLabel(/Commissioners only/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByLabel("Invite link", { exact: true })).toHaveValue(link);
  await friend.reload();
  await expect(friend.getByText("Only the commissioner can invite people")).toBeVisible();
  await expect(friend.getByLabel("Invite link", { exact: true })).toHaveCount(0);
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

test("guest: try it in Reidle Global, then save the account", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Not ready? Try it as a guest" }).click();
  await expect(page).toHaveURL(/\/stats\/daily\//);
  await page.getByRole("dialog").getByRole("button", { name: "Skip" }).click(); // the new-player tour (onboarding.spec)
  await expect(page.getByRole("link", { name: /League Reidle Global/ })).toBeVisible();
  await expect(page.getByText("You're playing as a guest")).toBeVisible();
  await expect(page.getByRole("link", { name: "▶ Play today's word" })).toBeVisible();
  // private leagues ask a guest to save their account first
  await page.goto("/join/bookclub");
  await expect(page.getByRole("heading", { name: "Save your account to join Book Club" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Link Google" })).toBeVisible();
  await expect(page.getByLabel("Link an email")).toBeVisible();
  await page.screenshot({ path: "test-results/invite-guest.png", fullPage: true });
  await page.getByRole("button", { name: "Keep playing as a guest in Reidle Global" }).click();
  await expect(page.getByRole("link", { name: /League Reidle Global/ })).toBeVisible();
  await page.goto("/account");
  // nickname: auto-assigned, changeable
  await page.getByRole("link", { name: "Change" }).click();
  await page.getByLabel("Nickname").fill("guesty");
  await expect(page.getByText("guesty is free")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Nickname: guesty")).toBeVisible();
  await page.screenshot({ path: "test-results/guest-account.png", fullPage: true });
});

test("signed out on a private invite: play as a guest in Reidle Global instead", async ({ page }) => {
  await page.goto("/join/bookclub");
  await page.getByRole("button", { name: "Not ready? Play as a guest in Reidle Global" }).click();
  await expect(page).toHaveURL(/\/stats\/daily\//);
  await page.getByRole("dialog").getByRole("button", { name: "Skip" }).click(); // the new-player tour
  await expect(page.getByRole("link", { name: /League Reidle Global/ })).toBeVisible();
});

test("back from Google or an email link: the tokens in the URL hash sign you in", async ({ page, request }) => {
  const res = await request.post("http://127.0.0.1:54321/auth/v1/signup", {
    headers: { apikey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" }, data: {},
  });
  const t = await res.json();
  await page.goto(`/auth/callback#access_token=${t.access_token}&refresh_token=${t.refresh_token}&expires_in=3600&token_type=bearer`);
  await expect(page).toHaveURL(/\/nickname/);
  await expect(page.getByLabel("Nickname")).toBeVisible();
});

test("name-only players are nudged to link Google or email", async ({ page }) => {
  await signIn(page, "alice");
  await expect(page.getByText("name-only sign-in is going away")).toBeVisible();
  await page.getByRole("link", { name: /Lock alice to you/ }).click();
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole("heading", { name: "Lock alice to you" })).toBeVisible();
  await page.screenshot({ path: "test-results/legacy-nudge.png" });
});

test("a long players list scrolls and can be searched", async ({ page }) => {
  await signIn(page, "alice", "/league");
  const list = page.locator("section").filter({ hasText: /^Players/ }).locator("ul");
  const before = await list.locator("li").count();
  await page.getByLabel("Find a player").fill("bo");
  await expect(list.locator("li")).not.toHaveCount(before);
  await expect(list.getByRole("link", { name: /^bob/ })).toBeVisible();
  await page.getByLabel("Find a player").fill("zzzz");
  await expect(list.getByText("No player named")).toBeVisible();
});

test("the commissioner bans a player: out, and the invite link won't let them back", async ({ page, browser }) => {
  await signIn(page, "kim", "/league?league=3");
  await expect(page.getByRole("heading", { name: "Book Club" })).toBeVisible();
  page.on("dialog", (d) => void d.accept());
  await page.getByLabel("Manage leo").selectOption("ban");
  await expect(page.getByRole("heading", { name: "Banned" })).toBeVisible();
  await expect(page.getByLabel("Manage leo")).toHaveCount(0);

  const leo = await (await browser.newContext()).newPage();
  await signIn(leo, "leo", "/join/bookclub");
  await leo.getByRole("button", { name: "Join Book Club" }).click();
  await expect(leo.getByText("you can't join Book Club")).toBeVisible();

  await page.getByRole("button", { name: "Unban" }).click();
  await expect(page.getByText("leo can join again.")).toBeVisible();
});

test("a guest who logs out gets the same guest back on this device", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Not ready? Try it as a guest" }).click();
  await expect(page).toHaveURL(/\/stats\/daily\//);
  await page.getByRole("dialog").getByRole("button", { name: "Skip" }).click(); // the new-player tour
  const name = (await page.getByText(/You're playing as a guest/).innerText()).match(/\((.+)\)/)![1];
  await page.goto("/account");
  await page.getByRole("link", { name: "Log Out" }).click();
  await page.getByRole("button", { name: `Continue as ${name}` }).click();
  await expect(page.getByText(`You're playing as a guest (${name})`)).toBeVisible();
});

test("private league players can find Reidle Global, and leave it again", async ({ page }) => {
  await signIn(page, "alice", "/league");
  await page.getByRole("button", { name: "Join Reidle Global" }).click();
  await expect(page.getByRole("link", { name: /League · switch Reidle Global/ })).toBeVisible();
  await page.goto("/leagues");
  page.on("dialog", (d) => void d.accept());
  await page.locator("section").filter({ hasText: "Reidle Global" }).getByRole("button", { name: "Leave" }).click();
  await expect.poll(() => sql("select count(*) from league_members where name = 'alice' and league_id = 2")).toBe("0");
  await expect(page.getByRole("link", { name: /League Reidle OG/ })).toBeVisible();
});
