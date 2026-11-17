// Clean screenshots of the onboarding mock (C:/dev/artefactos-onboarding/onboarding.html) for the tutorial sample.
// Read-only on that folder; writes PNGs + the rect of the "Second Brain" button into this folder.
const { chromium } = require('C:/dev/playwright-medidor/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const URL = 'file:///C:/dev/artefactos-onboarding/onboarding.html';
const OUT = __dirname;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2.4 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mq-onboarding-16', JSON.stringify({ tema: 'claro' })); } catch (e) {} });
  await p.goto(URL);
  await p.waitForFunction(() => window.MQ && window.MQ.estado().paso);
  await p.evaluate(() => { window.MQ_RAPIDO = true; window.MQ_QUIETO = true; });
  const limpiar = () => p.addStyleTag({ content: '#pr,#mq-rec,#mq-pip,.mq-pip,#pr-toast{display:none!important} body{padding-top:0!important}' });
  const info = {};
  for (const [nombre, paso] of [['ops', 'b-video@7'], ['brain', 'b-video@8']]) {
    await p.evaluate((v) => window.MQ.ir(v), paso);
    await dormir(1500);
    await limpiar();
    await dormir(300);
    info[nombre] = await p.evaluate(() => {
      const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
      return { app: r('#app'), sb: r('#app [data-recorrido="sb-second-brain"]'), est: window.MQ.estado() };
    });
    await p.screenshot({ path: path.join(OUT, `app-${nombre}.png`) });
  }
  fs.writeFileSync(path.join(OUT, 'app-rects.json'), JSON.stringify(info, null, 1));
  console.log(JSON.stringify(info));
  await b.close();
})();
