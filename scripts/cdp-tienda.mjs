// Cliente CDP mínimo para el Chrome aparte de la tienda (puerto 9334).
// Uso:
//   node cdp.mjs list
//   node cdp.mjs goto <url>
//   node cdp.mjs eval "<expr>"            (o evalf <archivo.js>)
//   node cdp.mjs shot <salida.png>
//   node cdp.mjs setfile "<selector css>" <ruta>
//   node cdp.mjs click <x> <y>
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:9334';
const [cmd, ...args] = process.argv.slice(2);

async function pagina() {
  const l = await (await fetch(`${BASE}/json/list`)).json();
  const pags = l.filter((t) => t.type === 'page');
  return pags.find((t) => /chrome\.google\.com\/webstore|accounts\.google/.test(t.url)) ?? pags[0];
}

if (cmd === 'list') {
  const l = await (await fetch(`${BASE}/json/list`)).json();
  for (const t of l) console.log(t.type, t.id, t.url);
  process.exit(0);
}

const t = await pagina();
if (!t) { console.error('sin pestaña'); process.exit(1); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
let n = 0;
const pend = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
};
const send = (method, params = {}) => new Promise((ok) => {
  const id = ++n;
  pend.set(id, ok);
  ws.send(JSON.stringify({ id, method, params }));
});
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function evaluar(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text };
  return r.result?.result?.value;
}

if (cmd === 'goto') {
  await send('Page.enable');
  await send('Page.navigate', { url: args[0] });
  await dormir(Number(args[1] ?? 7000));
  console.log(await evaluar('location.href + " | " + document.title'));
} else if (cmd === 'eval') {
  console.log(JSON.stringify(await evaluar(args[0]), null, 1));
} else if (cmd === 'evalf') {
  console.log(JSON.stringify(await evaluar(readFileSync(args[0], 'utf8')), null, 1));
} else if (cmd === 'shot') {
  await send('Page.bringToFront');
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(args[0], Buffer.from(r.result.data, 'base64'));
  console.log('ok', args[0]);
} else if (cmd === 'setfile') {
  await send('DOM.enable');
  const doc = await send('DOM.getDocument', { depth: 0 });
  const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: args[0] });
  if (!q.result?.nodeId) { console.error('no encontré', args[0]); process.exit(1); }
  const r = await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [args[1]] });
  console.log(JSON.stringify(r.error ?? 'archivo puesto'));
} else if (cmd === 'click') {
  const x = Number(args[0]), y = Number(args[1]);
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  console.log('clic', x, y);
} else {
  console.error('comando desconocido', cmd);
  process.exit(1);
}
ws.close();
process.exit(0);
