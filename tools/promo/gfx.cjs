const { chromium } = require('playwright');
const OUT = process.argv[2];
const css = `
*{margin:0;box-sizing:border-box} body{width:1080px;height:1920px;font-family:Inter,sans-serif;color:#fff;overflow:hidden;
 background:radial-gradient(120% 70% at 50% 0%,#1e3a5f 0%,#0b1220 60%,#070b14 100%)}
.cap{position:absolute;top:0;left:0;right:270px;height:365px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;text-align:left;padding:0 0 0 64px}
.cap h1{font-size:62px !important;letter-spacing:-1px}.cap p{font-size:34px !important}
.corner{position:absolute;top:52px;right:52px;width:232px;text-align:center}.corner .box{background:#fff;padding:14px;border-radius:22px;width:232px;height:232px}.corner div.l{font-size:24px;font-weight:600;color:#cbd5e1;margin-top:10px}
.cap h1{font-size:74px;line-height:1.08;font-weight:800;letter-spacing:-1.5px}
.cap p{font-size:40px;color:#9fb3c8;margin-top:16px;font-weight:500}
.g{color:#6aaa64}.y{color:#e3b341}
.bezel{position:absolute;left:168px;top:363px;width:744px;height:1620px;border-radius:78px;background:#111;box-shadow:0 0 0 3px #2a3445,0 30px 80px rgba(0,0,0,.6)}
.tiles{display:flex;gap:14px;justify-content:center}
.t{width:138px;height:138px;display:flex;align-items:center;justify-content:center;font-size:92px;font-weight:800;border:5px solid #3a4558;color:#fff}
.t.f{border:none}.t.G{background:#6aaa64}.t.Y{background:#c9b458}.t.X{background:#787c7e}
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 70px}
.big{font-size:96px;font-weight:800;letter-spacing:-2px;line-height:1.05;margin-top:70px}
.sub{font-size:44px;color:#9fb3c8;margin-top:28px;font-weight:500}
.pill{margin-top:80px;font-size:46px;font-weight:700;background:#e11d74;padding:26px 48px;border-radius:999px;box-shadow:0 12px 40px rgba(225,29,116,.45)}
.small{margin-top:30px;font-size:34px;color:#7d8fa5}
.clock{font-size:64px;font-weight:700;color:#e3b341;margin-top:60px;font-variant-numeric:tabular-nums}
`;
const qr = require('fs').readFileSync(OUT + '/qr.svg', 'utf8');
const corner = `<div class="corner"><div class="box">${qr.replace('<svg', '<svg width="204" height="204"')}</div><div class="l">Scan to play</div></div>`;
const word = 'REIDLE', cols = ['G','Y','G','G','Y','G'];
const tiles = (n) => `<div class="tiles">${[...word].map((c,i)=>i<n?`<div class="t f ${cols[i]}">${c}</div>`:`<div class="t"></div>`).join('')}</div>`;
const scenes = {
  cap_play: `<div class="cap"><h1>One word a day.<br><span class="y">The clock is running.</span></h1></div><div class="bezel"></div>${corner}`,
  cap_today: `<div class="cap"><h1>Fastest time<br><span class="g">takes the day.</span></h1><p>Same word for your whole crew</p></div>${corner}`,
  cap_week: `<div class="cap"><h1>Every day counts<br>toward <span class="y">the week.</span></h1></div>${corner}`,
  cap_chat: `<div class="cap"><h1>Your league chat.<br><span class="g">Your bragging rights.</span></h1></div><div class="bezel"></div>${corner}`,
};
const tqr = `<div style="margin-top:80px;background:#fff;padding:24px;border-radius:32px;width:360px;height:360px">${qr.replace('<svg', '<svg width="312" height="312"')}</div><div class="small" style="margin-top:22px">Scan to play</div>`;
for (let n = 0; n <= 6; n++) scenes[`title_${n}`] = `<div class="center">${tiles(n)}<div class="big" style="opacity:0">Wordle, but<br>it's a race.</div>${tqr}</div>`;
scenes.title_7 = `<div class="center">${tiles(6)}<div class="big">Wordle, but<br>it's a <span class="y">race.</span></div>${tqr}</div>`;
scenes.end = `<div class="center" style="justify-content:flex-start;padding-top:330px">${tiles(6)}<div class="big" style="margin-top:60px">Start a league.<br>Race your <span class="g">friends.</span></div><div style="margin-top:70px;background:#fff;padding:28px;border-radius:36px;width:420px;height:420px;box-shadow:0 20px 60px rgba(0,0,0,.5)">${qr.replace('<svg', '<svg width="364" height="364"')}</div><div class="pill" style="margin-top:56px">reidle.reillybrothers.net</div><div class="small">Free · plays in your browser</div></div>`;
(async () => {
  const b = await chromium.launch(require('./browser.cjs').launchOptions());
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [k, html] of Object.entries(scenes)) {
    await p.setContent(`<style>${css}</style>${html}`); await p.waitForTimeout(50);
    await p.screenshot({ path: `${OUT}/${k}.png` });
  }
  await p.setViewportSize({ width: 700, height: 1515 });
  await p.setContent(`<style>body{margin:0;background:transparent}</style><div style="width:700px;height:1515px;border-radius:60px;background:#fff"></div>`);
  await p.screenshot({ path: `${OUT}/mask.png`, omitBackground: true });
  await b.close();
})();
(async () => {
  const b = await chromium.launch(require('./browser.cjs').launchOptions()); const p = await b.newPage();
  for (const [w, h] of [[960, 1354], [854, 1450]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<style>body{margin:0;background:transparent}</style><div style="width:${w}px;height:${h}px;border-radius:44px;background:#fff"></div>`);
    await p.screenshot({ path: `${OUT}/mask_${w}.png`, omitBackground: true });
  }
  await b.close();
})();
