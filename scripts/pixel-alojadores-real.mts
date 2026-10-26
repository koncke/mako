// =============================================================================
// El Pixel de este árbol contra un video REAL de cada alojador, en Chrome sin ventana y mudo (25/10/2026)
// =============================================================================
// Pedido de Martín: «Implementa otros alojadores de video... Y asegurate de que funcionen bien». Los videos son los de
// la documentación de cada alojador (públicos). Por cada uno: clic para reproducir, espera, clic para pausar, y se
// imprime lo que mandó el Pixel. NADA llega a producción: el beacon se captura en la página (un envoltorio de fetch y
// de sendBeacon) y se contesta ahí mismo. La página se sirve desde localhost porque YouTube no carga en file://.
//
// Correr (desde la raíz del repo, con Chrome instalado):
//   node --conditions=react-server --import tsx scripts/pixel-alojadores-real.mts [segundos] [filtro,filtro]
//   p. ej. «… 14 bunny,cloudflare» corre sólo esos dos.
// Lo que se midió el 25/10/2026 con la v27 está en docs/hallazgos-landing.md → «Otros alojadores de video».
// =============================================================================
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { landingSnippet } from '../lib/landing-token';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SEG = Number(process.argv[2] ?? 14);
const FILTRO = process.argv[3] ? process.argv[3].split(',').map((s) => s.toLowerCase()) : null;

const VIDEOS: Array<[string, string]> = [
  ['Panda', 'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=25c0684d-528e-4382-9796-d1ec74b79634'],
  ['Vimeo', 'https://player.vimeo.com/video/76979871'],
  ['YouTube (con enablejsapi=1, sin la API en la página)', 'https://www.youtube.com/embed/M7lc1UVf-VE?enablejsapi=1'],
  ['YouTube (como lo da YouTube)', 'https://www.youtube.com/embed/aqz-KE-bpKQ?si=prueba'],
  ['Wistia', 'https://fast.wistia.net/embed/iframe/4d8229898d'],
  ['Bunny Stream', 'https://iframe.mediadelivery.net/embed/197133/dc48a09e-d9bb-420a-83d7-72dc2304c034'],
  ['Cloudflare Stream (customer-…)', 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/iframe'],
  ['Cloudflare Stream (videodelivery)', 'https://iframe.videodelivery.net/5d5bc37ffcf54c9b82e996823bffbb81'],
];
const lista = VIDEOS.filter(([n]) => !FILTRO || FILTRO.some((f) => n.toLowerCase().includes(f)));

const CAPTURA = '<script>window.__ev=[];(function(){var f=window.fetch;window.fetch=function(u,o){try{if(String(u).indexOf("/api/track/")>=0){window.__ev.push(JSON.parse((o&&o.body)||"{}"));return Promise.resolve(new Response("{}",{status:200,headers:{"Content-Type":"application/json"}}));}}catch(e){}return f.apply(this,arguments);};var sb=navigator.sendBeacon&&navigator.sendBeacon.bind(navigator);if(sb)navigator.sendBeacon=function(u,d){if(String(u).indexOf("/api/track/")>=0){try{window.__ev.push(JSON.parse(typeof d==="string"?d:""))}catch(e){}return true}return sb(u,d)};})();</script>';
const html = `<!doctype html><html><head><meta charset="utf-8">${CAPTURA}<style>body{margin:0;font:16px system-ui}section{padding:24px}iframe{display:block;width:640px;height:360px;border:0}</style></head><body>
${lista.map(([n, u], i) => `<section><h2>${n}</h2><iframe id="v${i}" src="${u}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe></section>`).join('\n')}
${landingSnippet('mko_' + 'cd'.repeat(16))}
</body></html>`;

const server = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); }).listen(0);
const puertoWeb = (server.address() as { port: number }).port;

// Un cliente CDP mínimo.
const perfil = mkdtempSync(join(tmpdir(), 'cdp-'));
const puerto = 9300 + Math.floor(Math.random() * 500);
const ch = spawn(CHROME, ['--headless=new', '--mute-audio', '--disable-gpu', '--no-first-run', `--user-data-dir=${perfil}`,
  `--remote-debugging-port=${puerto}`, '--window-size=1000,900', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let lista2: Array<{ type: string; webSocketDebuggerUrl: string }> | null = null;
for (let i = 0; i < 60 && !lista2; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try { lista2 = await (await fetch(`http://127.0.0.1:${puerto}/json`)).json(); } catch { /* todavía no */ }
}
const ws = new WebSocket(lista2!.find((t) => t.type === 'page')!.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pend = new Map<number, (m: { result?: { result?: { value?: unknown } } }) => void>();
ws.addEventListener('message', (e) => { const m = JSON.parse(String(e.data)); if (m.id && pend.has(m.id)) { pend.get(m.id)!(m); pend.delete(m.id); } });
const cmd = (method: string, params: Record<string, unknown> = {}) => new Promise<{ result?: { result?: { value?: unknown } } }>((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluar = async <T,>(expr: string): Promise<T> => (await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value as T;
const clic = async (x: number, y: number) => {
  await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cmd('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cmd('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
const esperar = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

try {
  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Page.navigate', { url: `http://localhost:${puertoWeb}/` });
  await esperar(6);
  for (let i = 0; i < lista.length; i++) {
    const caja = await evaluar<{ x: number; y: number }>(`(() => { const f = document.getElementById('v${i}'); f.scrollIntoView({ block: 'center' }); const r = f.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await esperar(1.5);
    const antes = await evaluar<number>('window.__ev.length');
    await clic(caja.x, caja.y);
    await esperar(SEG);
    await clic(caja.x, caja.y);
    await esperar(3);
    // Los videos que hablaron después del clic, con TODO lo suyo desde que cargó la página: el que arranca solo (Panda)
    // manda su play al cargar, antes del clic.
    const ev = await evaluar<string[]>(`(() => { const ids = new Set(window.__ev.slice(${antes}).map((e) => e.video_id).filter(Boolean));
      return window.__ev.filter((e) => ids.has(e.video_id)).map((e) => [e.tipo_evento, e.video_id, e.porcentaje ?? '', e.segundos == null ? '' : Math.round(e.segundos * 10) / 10, e.auto ?? ''].join(' · ')); })()`);
    const tipos = new Set(ev.map((e) => e.split(' · ')[0]));
    const veredicto = tipos.has('play') && tipos.has('pausa') && [...tipos].some((t) => /^[ps]\d+$/.test(t)) ? 'MIDE (play, avance y pausa)' : `NO MIDE ENTERO (${[...tipos].join(', ') || 'nada'})`;
    console.log(`\n${lista[i][0]}: ${veredicto}`);
    for (const e of ev.slice(0, 8)) console.log('   ', e);
    if (ev.length > 8) console.log(`    … y ${ev.length - 8} más`);
  }
} finally {
  try { ws.close(); } catch { /* */ }
  ch.kill();
  server.close();
}
