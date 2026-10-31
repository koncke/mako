// Capturas por CDP con Chrome sin ventana, con perfil descartable: node scripts/banco-editor-web/capturar.mjs <lista.json>
// Sirve a 390 (la ventana de Chrome no baja de 500) y bloquea el video de venta y los medidores: mirar no suma visitas.
// lista: [{ url, salida, ancho, alto, espera?, alFinal? (js antes de capturar), entero? (página entera), oscuro? }]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const lista = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const PERFIL = fs.mkdtempSync(path.join(os.tmpdir(), 'captura-'));
const PUERTO = 9471;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${PERFIL}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--mute-audio', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  await esperar(500);
  try {
    const t = await fetch(`http://127.0.0.1:${PUERTO}/json/list`).then((r) => r.json());
    const p = t.find((x) => x.type === 'page');
    if (p) ws = p.webSocketDebuggerUrl;
  } catch { /* todavía no levantó */ }
}
if (!ws) { chrome.kill(); throw new Error('Chrome no levantó'); }
const s = new WebSocket(ws);
await new Promise((r) => { s.onopen = r; });
let n = 0;
const pendientes = new Map();
s.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
};
const cdp = (method, params = {}) => new Promise((res) => { const id = ++n; pendientes.set(id, res); s.send(JSON.stringify({ id, method, params })); });
await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Network.enable');
await cdp('Network.setBlockedURLs', { urls: ['*pandavideo*', '*facebook*', '*/m.js*', '*clarity*', '*googletagmanager*'] });
for (const c of lista) {
  const movil = c.ancho < 768;
  await cdp('Emulation.setDeviceMetricsOverride', { width: c.ancho, height: c.alto, deviceScaleFactor: 1, mobile: movil });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: c.oscuro ? 'dark' : 'light' }] });
  await cdp('Page.navigate', { url: c.url });
  await esperar(c.espera ?? 6000);
  if (c.alFinal) { await cdp('Runtime.evaluate', { expression: c.alFinal, awaitPromise: true }); await esperar(1200); }
  const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!c.entero });
  fs.mkdirSync(path.dirname(c.salida), { recursive: true });
  fs.writeFileSync(c.salida, Buffer.from(r.result.data, 'base64'));
  console.log('ok', path.basename(c.salida));
}
s.close();
chrome.kill();
await esperar(800);
try { fs.rmSync(PERFIL, { recursive: true, force: true }); } catch { /* lo limpia el sistema */ }
