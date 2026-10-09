import { test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { layoutProblems, qaName, signIn, watch, type Issue } from "./helpers";

// Visit every route at phone + desktop sizes; report console errors, failed requests, overflow...
const VIEWPORTS = [{ name: "phone", width: 375, height: 667 }, { name: "desktop", width: 1280, height: 800 }];
const OUT = "/tmp/qa-shots";

test("crawl every route at phone and desktop sizes", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  const issues: Issue[] = [];
  let where = "setup";
  watch(page, issues, () => where);
  await signIn(page, qaName("c"));

  // discover real ids from the app itself
  await page.goto("/stats/this_week");
  const lastMonday = new Date(Date.now() - ((new Date().getUTCDay() + 6) % 7 + 7) * 86400000).toISOString().slice(0, 10);
  await page.goto(`/stats/weekly/${lastMonday}`);
  await page.waitForSelector("tbody tr");
  const pb = page.locator('a[href*="/playback"]').first();
  const playbackHref = (await pb.count()) ? await pb.getAttribute("href") : null;
  await page.goto("/challenges");
  await page.waitForSelector("text=Your Challenges");
  // a brand-new player has no history rows, so fall back to a fixture challenge id
  const link = page.locator('a[href^="/challenges/challenge/"]').first();
  const challengeHref = (await link.count()) ? ((await link.getAttribute("href")) ?? "/challenges/challenge/1") : "/challenges/challenge/1";
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const routes = [
    "/stats/today", "/stats/this_week", "/stats/past_winners", `/stats/weekly/${lastMonday}`, `/stats/daily/${yesterday}`,
    "/challenges", challengeHref, "/battles", "/rankings", "/players/alice", "/messages", "/account", "/practice", "/play",
    playbackHref ?? "/stats/today", "/this/route/does/not/exist",
  ];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    for (const route of routes) {
      where = `${vp.name} ${route}`;
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(500);
      for (const p of await layoutProblems(page)) issues.push({ where, kind: "layout", detail: p });
      await page.screenshot({ path: `${OUT}/${vp.name}-${route.replace(/[^a-z0-9]+/gi, "_").slice(0, 60)}.png` });
    }
  }
  writeFileSync("/tmp/qa-crawl.json", JSON.stringify(issues, null, 2));
  console.log(`\nCRAWL: ${routes.length * VIEWPORTS.length} pages, ${issues.length} issue(s)`);
  for (const i of issues) console.log(`  [${i.kind}] ${i.where}: ${i.detail}`);
});
