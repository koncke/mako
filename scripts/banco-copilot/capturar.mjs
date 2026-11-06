// Capturas del banco por CDP con Chrome sin ventana (perfil descartable). Uso: node scripts/banco-carruseles/capturar.mjs <lista.json> <carpeta>
// lista: [{ url, salida, ancho, alto, movil?, mover? ([x, y]: el mouse encima), antes? (js que corre antes de capturar), espera? (ms), entero? }]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const lista = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const carpeta = process.argv[3];
fs.mkdirSync(carpeta, { recursive: true });
const PERFIL = fs.mkdtempSync(path.join(os.tmpdir(), 'captura-'));
const PUERTO = 9474;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${PERFIL}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--mute-audio', '--hide-scrollbars', 'about:blank',
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
s.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); } };
const cdp = (method, params = {}) => new Promise((res) => { const id = ++n; pendientes.set(id, res); s.send(JSON.stringify({ id, method, params })); });
await cdp('Page.enable');
await cdp('Runtime.enable');
try {
  for (const c of lista) {
    await cdp('Emulation.setDeviceMetricsOverride', { width: c.ancho, height: c.alto, deviceScaleFactor: 1, mobile: !!c.movil });
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: c.movil ? 'none' : 'hover' }, { name: 'pointer', value: c.movil ? 'coarse' : 'fine' }] }).catch(() => {});
    await cdp('Page.navigate', { url: c.url });
    await esperar(c.espera ?? 1800);
    if (c.antes) {
      const r = await cdp('Runtime.evaluate', { expression: c.antes, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) console.log('antes falló:', JSON.stringify(r.result.exceptionDetails).slice(0, 300));
      await esperar(700);
    }
    if (c.mover) { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.mover[0], y: c.mover[1] }); await esperar(500); }
    const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!c.entero });
    fs.writeFileSync(path.join(carpeta, c.salida), Buffer.from(r.result.data, 'base64'));
    console.log('✔', c.salida);
  }
} finally {
  s.close();
  chrome.kill();
}
