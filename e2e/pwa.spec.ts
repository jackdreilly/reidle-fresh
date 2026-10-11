import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("installable: manifest, icons and an active service worker that precaches the build", async ({ page }) => {
  await signIn(page, "alice");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ id: "/", display: "standalone", scope: "/" });
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe("activated");
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const c = await caches.open(keys.find((k) => k.startsWith("reidle-"))!);
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  });
  expect(cached).toContain("/index.html");
  expect(cached.some((p) => /^\/assets\/Game-.*\.js$/.test(p))).toBe(true);
  expect(cached.some((p) => /^\/assets\/words-.*\.csv$/.test(p))).toBe(true);
});

test("offline: the installed shell still opens and Practice is playable", async ({ page, context }) => {
  await signIn(page, "alice");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now controlled by the worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto("/practice?word=3&startingWord=5");
  await expect(page.getByText("You're offline")).toBeVisible();
  await expect(page.locator(".grid").first()).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("You're offline")).toBeHidden();
});

test("coming back to the app after a while reloads the page's data", async ({ page }) => {
  await signIn(page, "alice");
  await expect(page.getByRole("row").filter({ hasText: "alice" })).toBeVisible();
  const calls: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/rpc/")) calls.push(r.url().split("/rpc/")[1]); });
  await page.evaluate(() => {
    const t = Date.now();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Date.now = () => t + 10 * 60_000; // ten minutes in the background
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => calls).toEqual(expect.arrayContaining(["daily_page", "bootstrap"]));
  await expect(page.getByRole("row").filter({ hasText: "alice" })).toBeVisible();
});
