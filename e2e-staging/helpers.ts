import { expect, type Page } from "@playwright/test";

/** A fresh throwaway player per call, e.g. qa482913 (<= 15 chars, lowercase). */
export const qaName = (tag = "") => `qa${String(Date.now() % 1_000_000).padStart(6, "0")}${tag}`.slice(0, 15);

export async function signIn(page: Page, name: string, to = "/") {
  await page.goto(`/sign-in?redirect=${encodeURIComponent(to)}`);
  await page.getByPlaceholder("Your name").fill(name);
  await page.locator('input[type="submit"]').click();
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });
}

export interface Issue { where: string; kind: string; detail: string }

/** Collects the things a user would call "broken" while a page is exercised. */
export function watch(page: Page, issues: Issue[], where: () => string) {
  page.on("pageerror", (e) => issues.push({ where: where(), kind: "pageerror", detail: e.message.slice(0, 300) }));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource.*(400|401)/.test(m.text())) issues.push({ where: where(), kind: "console.error", detail: m.text().slice(0, 300) });
  });
  page.on("requestfailed", (r) => !/\/auth\/v1\/logout/.test(r.url()) && r.failure()?.errorText !== "net::ERR_ABORTED" && issues.push({ where: where(), kind: "requestfailed", detail: `${r.method()} ${r.url().slice(0, 120)} ${r.failure()?.errorText}` }));
  page.on("response", (r) => {
    if (r.status() >= 500 || (r.status() >= 400 && !/\/auth\/v1\/token/.test(r.url()))) issues.push({ where: where(), kind: `http ${r.status()}`, detail: `${r.request().method()} ${r.url().slice(0, 140)}` });
  });
}

/** Layout invariants that are cheap to check on any page. */
export const layoutProblems = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > innerWidth + 1) out.push(`horizontal scroll: scrollWidth ${de.scrollWidth} > ${innerWidth}`);
    for (const img of Array.from(document.images)) if (img.complete && img.naturalWidth === 0) out.push(`broken image ${img.src.slice(-60)}`);
    const wide = Array.from(document.querySelectorAll("body *")).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > innerWidth + 2 && !el.closest(".overflow-x-auto, .overflow-hidden, svg, aside");
    }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(el.getBoundingClientRect().right)}`);
    if (wide.length) out.push(`content wider than viewport: ${wide.join(" | ")}`);
    if (!document.title || document.title === "undefined") out.push(`bad title: ${document.title}`);
    return out;
  });
