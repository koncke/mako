/**
 * Recorre los pasos del onboarding de /video-generator y captura cada uno.
 * Mismos gotchas que scripts/mirar-pantalla.mjs, mÃ¡s uno propio: ANTES va
 * `npx tsx --env-file=.env.local _ws1.mts guardar` y DESPUÃ‰S `restaurar`.
 * uso (PowerShell, no Git Bash): node _recorrer.mjs <carpeta>
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SALIDA = process.argv[2] ?? '.';
// ⚠️ El puerto de la app se PASA, no se asume. Next arranca en 3001 si otra
// sesion ya tiene el 3000, y el script aterriza en «localhost rechazo la
// conexion» — que se lee como que la app esta rota.
const PUERTO_APP = process.env.MAKO_PUERTO || '3000';

const ANCHO = 1440, ALTO = 1100, PUERTO = 9335;
mkdirSync(SALIDA, { recursive: true });

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!CHROME) { console.error('no encontre chrome.exe'); process.exit(1); }

const perfil = mkdtempSync(join(tmpdir(), 'mako-cdp-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  `--window-size=${ANCHO},${ALTO}`, 'about:blank'], { stdio: 'ignore' });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function objetivo() {
  for (let i = 0; i < 40; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      const t = j.find((x) => x.type === 'page');
      if (t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch { /* todavÃ­a no levantÃ³ */ }
    await dormir(250);
  }
  throw new Error('chrome no expuso el puerto');
}

const ws = new WebSocket(await objetivo());
await new Promise((r) => { ws.onopen = r; });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pend.set(n, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const val = async (e) => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: `http://localhost:${PUERTO_APP}/api/auth/dev-login?ws=1&next=/video-generator` });

async function asentarse() {
  let previo = -1, quietas = 0;
  for (let i = 0; i < 80; i++) {
    await dormir(400);
    const n = await val('document.body ? document.body.innerText.length : -1').catch(() => -1);
    if (n > 0 && n === previo) { quietas += 1; if (quietas >= 3) break; } else quietas = 0;
    previo = n;
  }
  for (let i = 0; i < 40; i++) {
    const v = JSON.parse(await val('JSON.stringify({t:[...document.images].length,l:[...document.images].filter(x=>x.complete&&x.naturalWidth>0).length})').catch(() => '{"t":0,"l":0}'));
    if (v.t === 0 || v.l === v.t) break;
    await dormir(400);
  }
}

for (let i = 1; i <= 9; i++) {
  await asentarse();
  const titulo = await val("(document.querySelector('h2')||{}).innerText || '(sin h2)'");
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  const ruta = join(SALIDA, `p${i}.png`);
  writeFileSync(ruta, Buffer.from(shot.data, 'base64'));
  console.log(`\nâ”€â”€ ${i}. Â«${titulo}Â» â†’ ${ruta}`);
  if (i === 9) break;
  const ok = await val(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Siguiente');
    if (!b) return false; b.click(); return true;
  })()`);
  if (!ok) { console.error('   âš  sin Â«SiguienteÂ»: me quedo acÃ¡'); break; }
  await dormir(2600);
}

ws.close();
chrome.kill();
