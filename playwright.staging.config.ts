import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";

// Closed-loop QA against a DEPLOYED environment (default: live staging). No local server, no DB
// reset: every test signs in as a throwaway `qa…` player. Run: npm run qa:staging
function chromium(): string | undefined {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().at(-1);
  const exe = dir && `${root}/${dir}/chrome-linux/chrome`;
  return exe && existsSync(exe) ? exe : undefined;
}

export default defineConfig({
  testDir: "e2e-staging",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.STAGING_URL ?? "https://reidle-staging.reidle.workers.dev",
    headless: true,
    viewport: { width: 1000, height: 800 },
    launchOptions: chromium() ? { executablePath: chromium() } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
