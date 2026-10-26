// Records app scenes as high-DPI JPEG frame sequences via CDP screencast.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT;
async function recorder(page, name) {
  const dir = `${OUT}/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = []; let on = true;
  const loop = (async () => { while (on) { const t = Date.now() / 1000; const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: 0, y: 0, width: 390, height: 844, scale: 2 } });
    const f = `${dir}/${String(frames.length).padStart(5, '0')}.jpg`; fs.writeFileSync(f, Buffer.from(data, 'base64')); frames.push({ f, t }); } })();
  const t0 = Date.now() / 1000;
  return async () => {
    const end = Date.now() / 1000;
    on = false; await loop;
    let s = 'ffconcat version 1.0\n';
    frames.forEach((fr, i) => { const nx = i + 1 < frames.length ? frames[i + 1].t : end; s += `file '${fr.f}'\nduration ${Math.max(0.001, nx - fr.t).toFixed(4)}\n`; });
    if (frames.length) s += `file '${frames.at(-1).f}'\n`;
    fs.writeFileSync(`${dir}/list.txt`, s);
    console.log(name, frames.length, 'frames', (end - t0).toFixed(1), 's');
  };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function type(page, w, gap = 110) { for (const c of w) { await page.keyboard.press(c); await sleep(gap); } await page.keyboard.press('Enter'); }

(async () => {
  const which = process.argv.slice(2);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, baseURL: 'http://127.0.0.1:3000' });
  const page = await ctx.newPage();
  await page.goto('/sign-in?redirect=/');
  await page.getByText('Played before leagues?').click();
  await page.getByPlaceholder('Your name').fill('sam');
  await page.locator('input[type="submit"]').click();
  await page.waitForURL((u) => !/sign-in/.test(u.toString()));
  await sleep(1000);
  const scenes = {
    async play() {
      await page.goto('/play'); await sleep(1200);
      const stop = await recorder(page, 'play');
      await sleep(700);
      await page.getByRole('button', { name: 'Start' }).click();
      await sleep(2600);
      await type(page, 'SLANT', 230); await sleep(2600);
      await type(page, 'PLAIN', 200); await sleep(4500);
      await stop();
    },
    async today() {
      await page.goto('/stats/today'); await sleep(1500);
      const stop = await recorder(page, 'today'); await sleep(3500); await stop();
    },
    async week() {
      await page.goto('/stats/weekly/2026-10-19'); await sleep(1500);
      const stop = await recorder(page, 'week');
      await sleep(500);
      await page.getByText('Replay').click().catch((e) => console.log(e.message));
      await sleep(6000); await stop();
    },
    async past() {
      await page.goto('/stats/past_winners'); await sleep(1500);
      const stop = await recorder(page, 'past'); await sleep(3500); await stop();
    },
    async chat() {
      await page.goto('/messages'); await sleep(1500);
      const stop = await recorder(page, 'chat');
      await sleep(600);
      await page.getByPlaceholder('Your message...').click();
      for (const c of '0:07 😎 who wants it') { await page.keyboard.type(c); await sleep(60); }
      await sleep(300);
      await page.getByRole('button', { name: 'Send' }).click();
      await sleep(2500); await stop();
    },
    async challenges() {
      await page.goto('/challenges'); await sleep(1500);
      const stop = await recorder(page, 'challenges'); await sleep(3000); await stop();
    },
  };
  for (const s of which) await scenes[s]();
  await b.close();
})();
