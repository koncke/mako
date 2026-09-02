/**
 * Mirar una pantalla de la app y guardar la captura.
 *
 * Los cuatro gotchas que ya costaron una corrida y quedaron escritos en
 * docs/hallazgos-generativa.md:
 *
 *  1. Un Chrome DEDICADO, con su propio --user-data-dir. Una pestaÃ±a CDP nueva
 *     sobre el Chrome de todos los dÃ­as puede no hidratar nunca.
 *  2. Se entra por /api/auth/dev-login?ws=1 â€” ws1 es el ÃšNICO exento del
 *     onboarding global, asÃ­ que es el Ãºnico donde una tab se puede ver.
 *  3. Emulation.setDeviceMetricsOverride ANTES de navegar: sin viewport
 *     declarado, innerWidth es 0 y toda mediciÃ³n devuelve cero â€” que se lee como
 *     Â«no hay nadaÂ», el peor falso negativo.
 *  4. Se espera a que innerText se quede QUIETO tres vueltas, no a un timeout.
 *
 * uso: node _mirar.mjs <ruta> <salida.png> [ancho] [alto]
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUTA = process.argv[2] ?? '/video-generator';
const SALIDA = process.argv[3] ?? 'captura.png';
const ANCHO = Number(process.argv[4] ?? 1440);
const ALTO = Number(process.argv[5] ?? 980);
/**
 * Opcional: el aria-label del elemento sobre el que pasar el mouse antes de
 * capturar. Un `:hover` no se puede verificar leyendo el CSS, y forzar el estilo
 * a mano prueba que el velo se dibuja, NO que el hover lo dispare — que es
 * justamente lo que se quiere saber. Va un mouseMoved de verdad.
 */
const HOVER = process.argv[6] ?? '';
/**
 * Cuántas veces apretar «Siguiente» antes de capturar.
 *
 * Un wizard no tiene URL por paso, así que la única forma de mirar el paso N es
 * llegar caminando. ⚠️ Y eso ESCRIBE: cada «Siguiente» llama a la action de su
 * paso. Antes de usarlo, `scripts/onboarding-vg-respaldo.mts guardar`.
 */
const AVANCES = Number(process.argv[7] ?? 0);
const PUERTO = 9333;

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.error('no encontre chrome.exe'); process.exit(1); }

const perfil = mkdtempSync(join(tmpdir(), 'mako-cdp-'));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${perfil}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  `--window-size=${ANCHO},${ALTO}`,
  'about:blank',
], { stdio: 'ignore', detached: false });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function objetivo() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO}/json/list`);
      const j = await r.json();
      const t = j.find((x) => x.type === 'page');
      if (t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch { /* todavÃ­a no levantÃ³ */ }
    await dormir(250);
  }
  throw new Error('chrome no expuso el puerto de depuraciÃ³n');
}

const ws = new WebSocket(await objetivo());
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pendientes = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d); pendientes.delete(d.id); }
};
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pendientes.set(n, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});

await cdp('Page.enable');
await cdp('Runtime.enable');
// âš ï¸ ANTES de navegar. Ver gotcha 3.
await cdp('Emulation.setDeviceMetricsOverride', {
  width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false,
});

// âš ï¸ ESTE SCRIPT NO SE LLAMA DESDE GIT BASH. MSYS convierte todo argumento que
// empiece con `/` en una ruta de Windows ANTES de que node lo vea: `/video-
// generator` llega como `C:/Program Files/Git/video-generator`. La primera
// corrida aterrizÃ³ en /general y el diagnÃ³stico obvio â€”Â«el next= del dev-login
// no mandaÂ»â€” era el equivocado; la segunda muriÃ³ con Â«Cannot navigate to invalid
// URLÂ», que es la misma causa gritando mÃ¡s fuerte. Va por PowerShell.
if (RUTA.includes(':') || !RUTA.startsWith('/')) {
  console.error(`la ruta llegÃ³ mangleada: ${RUTA}
correlo con PowerShell, no con Git Bash`);
  process.exit(1);
}

await cdp('Page.navigate', { url: `http://localhost:3000/api/auth/dev-login?ws=1&next=${encodeURIComponent(RUTA)}` });

// âš ï¸ Se espera a que el texto se quede QUIETO, no a un timeout. Ver gotcha 4.
let previo = -1, quietas = 0;
for (let i = 0; i < 80; i++) {
  await dormir(400);
  const r = await cdp('Runtime.evaluate', {
    expression: 'document.body ? document.body.innerText.length : -1',
    returnByValue: true,
  }).catch(() => null);
  const n = r?.result?.value ?? -1;
  if (n > 0 && n === previo) { quietas += 1; if (quietas >= 3) break; } else quietas = 0;
  previo = n;
}

// âš ï¸ Y DESPUÃ‰S SE ESPERA A LAS IMÃGENES, que es otra pregunta.
//
// El texto se queda quieto mucho antes de que carguen las fotos â€”vienen de
// URLs firmadas de Supabaseâ€” y una captura tomada ahÃ­ muestra los huecos
// vacÃ­os. Ya mintiÃ³ una vez: se leyÃ³ como Â«los laterales no se dibujanÂ» sobre
// una pantalla que los tenÃ­a, sÃ³lo que todavÃ­a transparentes.
for (let i = 0; i < 60; i++) {
  const r = await cdp('Runtime.evaluate', {
    expression: `(() => {
      const im = [...document.images];
      return JSON.stringify({ total: im.length, listas: im.filter((x) => x.complete && x.naturalWidth > 0).length });
    })()`,
    returnByValue: true,
  }).catch(() => null);
  const v = JSON.parse(r?.result?.value ?? '{"total":0,"listas":0}');
  if (v.total > 0 && v.listas === v.total) { console.log(`imÃ¡genes: ${v.listas}/${v.total}`); break; }
  if (i === 59) console.log(`âš  imÃ¡genes: ${v.listas}/${v.total} â€” se captura igual`);
  await dormir(400);
}

const info = await cdp('Runtime.evaluate', {
  expression: `JSON.stringify({
    url: location.pathname,
    ancho: innerWidth,
    texto: document.body.innerText.slice(0, 900),
    // Sin backticks ni interpolacion: esto vive DENTRO de un template literal
    // y una comilla invertida de mas lo corta al medio (el gotcha de AGENTS.md).
    cajas: [...document.querySelectorAll('button[aria-label]')]
      .map((b) => { const r = b.getBoundingClientRect();
        return b.getAttribute('aria-label') + ': ' + Math.round(r.x) + ',' + Math.round(r.y) + '  ' + Math.round(r.width) + 'x' + Math.round(r.height); }),
  })`,
  returnByValue: true,
});
console.log(info.result.value);

for (let i = 0; i < AVANCES; i++) {
  const ok = await cdp('Runtime.evaluate', {
    expression: `(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Siguiente');
      if (!b) return false; b.click(); return true;
    })()`,
    returnByValue: true,
  });
  if (!ok.result.value) { console.error('no encontré el «Siguiente» en el avance ' + (i + 1)); break; }
  await dormir(2600);
}
if (AVANCES) { previo = -1; quietas = 0; for (let i = 0; i < 40; i++) { await dormir(400); const n = await cdp('Runtime.evaluate', { expression: 'document.body.innerText.length', returnByValue: true }).then((r) => r.result.value).catch(() => -1); if (n > 0 && n === previo) { quietas += 1; if (quietas >= 3) break; } else quietas = 0; previo = n; } }

if (HOVER) {
  // ⚠️ EL SELECTOR LO ARMA NODE, NO LA PÁGINA.
  //
  // Escribir JSON.stringify(HOVER) adentro de la expresión la manda TAL CUAL al
  // navegador, donde esa variable no existe: el selector viaja con la palabra
  // HOVER adentro y contesta null. El síntoma es «no encontré», que se lee como
  // que el elemento no está en la pantalla — y manda a depurar el componente.
  const SEL = JSON.stringify(`[aria-label=${JSON.stringify(HOVER)}]`);
  const c = await cdp('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector(${SEL});
      if (!el) return '';
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
    })()`,
    returnByValue: true,
  });
  if (!c.result.value) { console.error('no encontre: ' + HOVER); process.exit(1); }
  const { x, y } = JSON.parse(c.result.value);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
  await dormir(600);
  console.log('hover sobre ' + HOVER + ' en ' + x + ',' + y);
}

const shot = await cdp('Page.captureScreenshot', { format: 'png' });
writeFileSync(SALIDA, Buffer.from(shot.data, 'base64'));
console.log(`\ncaptura: ${SALIDA}`);

ws.close();
chrome.kill();
