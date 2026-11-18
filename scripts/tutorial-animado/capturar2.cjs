// A drawn tab (C:/dev/artefactos-pestanas/publicar/app-*.html, its real components) photographed for a tutorial, plus where each
// selector of the script sits in the 1920×1080 frame. Page at 1600×900, deviceScaleFactor 2.4 (so a 2× zoom stays sharp).
//   node capturar2.cjs <pagina.html> <salida.png> '<json: ["sel1","sel2"]>'
// Prints JSON: { rects: [ {x,y,w,h} | null ] } — null when the selector finds nothing visible on screen.
const { chromium } = require('C:/dev/playwright-medidor/node_modules/playwright-core');
const [pagina, salida, selsJson] = process.argv.slice(2);
const sels = JSON.parse(selsJson || '[]');
(async () => {
  const b = await chromium.launch({ args: ['--mute-audio', '--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2.4, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto('file:///' + pagina.split('\\').join('/'));
  await p.waitForTimeout(1800);
  // no cursor-driven or animated leftovers in the photo
  await p.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}' });
  const rects = await p.evaluate((ss) => ss.map((s) => {
    if (!s) return null;
    let el;
    if (s.startsWith('texto=')) {
      const txt = s.slice(6).trim();
      el = [...document.querySelectorAll('button, a, [role="button"]')].find((x) => x.innerText.trim() === txt) || null;
    } else { try { el = document.querySelector(s); } catch (e) { return null; } }
    if (!el) return null;
    const r = el.getBoundingClientRect(), st = getComputedStyle(el);
    if (r.width < 4 || r.height < 4 || st.visibility === 'hidden' || st.display === 'none') return null;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
    const x = Math.max(0, r.left), y = Math.max(0, r.top), w = Math.min(innerWidth, r.right) - x, h = Math.min(innerHeight, r.bottom) - y;
    return { x: +(x * 1.2).toFixed(1), y: +(y * 1.2).toFixed(1), w: +(w * 1.2).toFixed(1), h: +(h * 1.2).toFixed(1) };
  }), sels);
  await p.screenshot({ path: salida });
  console.log(JSON.stringify({ rects }));
  await b.close();
})().catch((e) => { console.log(JSON.stringify({ error: e.message })); process.exit(1); });
