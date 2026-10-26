const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const n of process.argv.slice(2)) {
    const page = await (await b.newContext({ baseURL: 'http://127.0.0.1:3000' })).newPage();
    await page.goto('/sign-in?redirect=/');
    await page.getByText('Played before leagues?').click();
    await page.getByPlaceholder('Your name').fill(n);
    await page.locator('input[type="submit"]').click();
    await page.waitForURL(u => !/sign-in/.test(u.toString()));
  }
  await b.close();
})();
