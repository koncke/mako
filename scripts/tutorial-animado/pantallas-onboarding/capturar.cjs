// Las 5 pantallas del WhatsApp del video de bienvenida, a 1920×1080: node capturar.cjs → s1.png … s5.png (al lado).
const { chromium } = require('C:/dev/playwright-medidor/node_modules/playwright-core');
const path = require('node:path');
(async () => {
  const b = await chromium.launch({ args: ['--mute-audio', '--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const url = 'file:///' + path.join(__dirname, 'pantallas-whatsapp.html').split('\\').join('/');
  for (let s = 1; s <= 5; s++) {
    await p.goto(`${url}?s=${s}`);
    await p.waitForTimeout(1200);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.body.dataset.listo === '1', null, { timeout: 15000 });
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(__dirname, `s${s}.png`) });
  }
  await b.close();
  console.log('listo');
})();
