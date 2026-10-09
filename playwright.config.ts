import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";

// In the Claude web sandbox Chromium is preinstalled (PLAYWRIGHT_BROWSERS_PATH) but may not
// match Playwright's pinned build number; fall back to whatever is there.
function chromium(): string | undefined {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().at(-1);
  const exe = dir && `${root}/${dir}/chrome-linux/chrome`;
  return exe && existsSync(exe) ? exe : undefined;
}

// Headless E2E against the local Supabase stack (`npm run db:start`).
// The data fixture is reset before the suite (see e2e/global-setup.ts).
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    viewport: { width: 1000, height: 800 },
    launchOptions: chromium() ? { executablePath: chromium() } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  // E2E runs against the production build (what users get), pointed at the local stack.
  webServer: {
    command: "npx vite build --mode development --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false, // always build + serve a fresh production bundle
    timeout: 120_000,
  },
});
