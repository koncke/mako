// Puente CDP contra el Chrome dedicado del 9333. Node 24 trae WebSocket y fetch,
// asi que no hace falta ninguna dependencia.
//
// Uso:  node mirar.mjs <ruta> <archivo-con-el-js-a-evaluar>
// Ej.:  node mirar.mjs /video-generator medir.js
//
// ⚠️ Entra por /api/auth/dev-login?ws=1 — sin `ws` toda ruta contesta 403, y en
// ws3 el onboarding tapa cualquier tab nueva. ws1 esta exento del wizard.
// ⚠️ Y NO se evalua sin esperar: navegar y medir 700 ms despues devuelve vacio
// sobre una pagina a medio pintar, y el vacio se lee como «no hay nada».

import { readFileSync } from 'node:fs';

const ruta = process.argv[2] || '/video-generator';
const jsFile = process.argv[3];
const CDP = 'http://127.0.0.1:9333';

const v = await (await fetch(`${CDP}/json/version`)).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let id = 0;
const pend = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
};
const cmd = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const n = ++id;
  pend.set(n, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)));
  ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = await cmd('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cmd('Target.attachToTarget', { targetId, flatten: true });
const ev = async (expr) => {
  const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};

try {
  await cmd('Page.enable', {}, sessionId);
  // El tamaño se fija: una medicion de layout sin viewport declarado no dice nada.
  await cmd('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cmd('Page.navigate',
    { url: `http://localhost:3000/api/auth/dev-login?ws=1&next=${encodeURIComponent(ruta)}` }, sessionId);

  // Se espera a que el texto se quede QUIETO tres vueltas, no a un timeout fijo.
  let previo = -1, quieto = 0;
  for (let i = 0; i < 60 && quieto < 3; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const n = await ev('document.body ? document.body.innerText.length : 0').catch(() => 0);
    if (n === previo && n > 0) quieto++; else quieto = 0;
    previo = n;
  }

  const hidratado = await ev(
    "(()=>{const e=document.querySelector('main')||document.body;"
    + "return !!Object.keys(e).find(k=>k.startsWith('__reactFiber'))})()",
  );
  const url = await ev('location.pathname');
  const vw = await ev('innerWidth');
  console.error(`[mirar] ${url} · hidratado=${hidratado} · viewport=${vw} · texto=${previo}`);
  if (!hidratado) console.error('[mirar] ⚠️ NO HIDRATO: lo que salga de acá no vale para nada que sea React.');

  if (jsFile) {
    const out = await ev(readFileSync(jsFile, 'utf8'));
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  }
} finally {
  await cmd('Target.closeTarget', { targetId }).catch(() => {});
  ws.close();
}
