/**
 * Abrir una ruta y volcar los ERRORES DE CONSOLA, sin minificar.
 *
 * Un «Minified React error #NNN» de producción no dice dónde: el dev server sí,
 * porque sirve el bundle sin minificar y React imprime el mensaje entero con el
 * componente que falló. Sin esto, un #300 se diagnostica leyendo código y
 * adivinando cuál de los treinta hooks es.
 *
 * uso (PowerShell): node _consola.mjs <ruta> [puerto]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUTA = process.argv[2] ?? '/video-generator';
const PUERTO_APP = process.argv[3] ?? process.env.MAKO_PUERTO ?? '3000';
const PUERTO = 9337;

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
if (!CHROME) { console.error('no encontre chrome.exe'); process.exit(1); }
if (RUTA.includes(':')) { console.error('la ruta llego mangleada: correlo con PowerShell'); process.exit(1); }

const perfil = mkdtempSync(join(tmpdir(), 'mako-cdp-'));
const chrome = spawn(CHROME, [`--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  '--headless=new', '--no-first-run', '--disable-gpu', '--window-size=1440,1000', 'about:blank'], { stdio: 'ignore' });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    wsUrl = j.find((x) => x.type === 'page')?.webSocketDebuggerUrl;
  } catch { /* todavía no levantó */ }
  if (!wsUrl) await dormir(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0; const pend = new Map();
const errores = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') {
    const e = d.params.exceptionDetails;
    errores.push({ tipo: 'excepcion', txt: e.exception?.description || e.text, stack: (e.stackTrace?.callFrames || []).slice(0, 6) });
  }
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) {
    errores.push({ tipo: d.params.type, txt: d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 900) });
  }
};
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pend.set(n, (d) => (d.error ? rej(new Error(d.error.message)) : res(d.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: `http://localhost:${PUERTO_APP}/api/auth/dev-login?ws=1&next=${encodeURIComponent(RUTA)}` });
await dormir(3000);
await cdp('Page.navigate', { url: `http://localhost:${PUERTO_APP}${RUTA}` });
// ⚠️ Se espera a que HAYA algo, no un timeout fijo: la primera compilación de una
// ruta con Turbopack tarda decenas de segundos, y una captura tomada antes
// devuelve una página vacía con CERO errores — que se lee como «no hay bug».
for (let i = 0; i < 60; i++) {
  await dormir(1000);
  const r = await cdp('Runtime.evaluate', { expression: 'document.body ? document.body.innerText.length : 0', returnByValue: true }).catch(() => null);
  if ((r?.result?.value ?? 0) > 40 || errores.length) break;
}
await dormir(2500);

const txt = await cdp('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,260)', returnByValue: true });
console.log('=== LO QUE SE VE ===');
console.log(txt.result.value);
console.log(`\n=== ${errores.length} error(es) de consola ===`);
for (const e of errores.slice(0, 12)) {
  console.log(`\n[${e.tipo}] ${e.txt}`);
  for (const f of e.stack ?? []) console.log(`    ${f.functionName || '(anon)'}  ${f.url.split('/').slice(-1)[0]}:${f.lineNumber}`);
}

ws.close();
chrome.kill();
