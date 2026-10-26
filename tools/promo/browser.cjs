// Launch options like playwright.config.ts: use the preinstalled Chromium when Playwright's pinned build is missing.
const { existsSync, readdirSync } = require("node:fs");
function executablePath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().at(-1);
  const exe = dir && [`${root}/${dir}/chrome-linux/chrome`, `${root}/${dir}/chrome-linux64/chrome`].find(existsSync);
  return exe || undefined;
}
module.exports = { launchOptions: () => (executablePath() ? { executablePath: executablePath() } : {}) };
