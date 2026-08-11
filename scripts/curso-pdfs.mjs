// Baja los PDF de resumen de cada clase.
//
// El problema: los links del plan son /Reader?type=resource&id=<uuid>, que es una
// PÁGINA, no el PDF. Y el PDF real vive detrás de la sesión.
//
// La solución que evita extraer cookies: se navega la página en el Chrome dedicado
// (ya logueado) y se saca el cuerpo con Network.getResponseBody de CDP — el
// navegador ya autenticó, descargó y tiene los bytes en su buffer. No hace falta
// ni fetch en la página ni pelearse con las cookies v20.
//
//   node <abs>\scripts\curso-pdfs.mjs --plan C:\cursos\<slug>\plan.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 9333));
const PLAN = arg('plan', '');
const ESPERA = Number(arg('espera', 25)) * 1000;

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const plan = JSON.parse(readFileSync(PLAN, 'utf8'));
const destino = join(dirname(PLAN), 'pdfs');

const limpio = (s) => s.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120) || 'resumen';

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map(); this.oye = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id); this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      } else if (m.method) for (const f of this.oye) f(m);
    });
  }
  enviar(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 30000);
    });
  }
}

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}.\n`); process.exit(1); }

  // Nombre por PDF: se lee del curso, asociando cada link Reader a su clase.
  // Sin esto quedarían 20 archivos llamados por uuid.
  const cursoTab = lista.find((t) => t.type === 'page' && /\/curso\//i.test(t.url));
  const etiquetas = new Map();
  if (cursoTab) {
    const wsC = new WebSocket(cursoTab.webSocketDebuggerUrl);
    await new Promise((ok) => wsC.addEventListener('open', ok, { once: true }));
    const c = new Cdp(wsC);
    await c.enviar('Runtime.enable');
    const { result } = await c.enviar('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const dur = /\\b\\d{1,2}:\\d{2}\\b/;
        const out = [];
        // Recorrido en orden de documento: la clase precede a su(s) PDF(s).
        const nodos = [...document.querySelectorAll('button, a[href*="Reader?type=resource"]')];
        let clase = null, n = 0;
        for (const el of nodos) {
          const txt = (el.innerText || '').replace(/\\s+/g, ' ').trim();
          if (el.tagName === 'BUTTON') {
            if (dur.test(txt) && !/\\d+\\/\\d+\\s*$/.test(txt)) {
              n++;
              clase = txt.replace(/^\\s*\\d{1,3}\\s+/, '').replace(dur, '').replace(/^\\s*\\d{1,3}[.)]\\s*/, '').trim();
            }
            continue;
          }
          const id = new URL(el.href).searchParams.get('id');
          if (id) out.push({ id, n, clase, label: txt.replace(/\\s*\\d+([.,]\\d+)?\\s*(KB|MB)\\s*$/i, '').trim() });
        }
        return out;
      })()`,
    });
    for (const e of result?.value ?? []) etiquetas.set(e.id, e);
    wsC.close();
    console.log(`  Asocié ${etiquetas.size} PDF(s) a su clase.\n`);
  }

  // Una sola pestaña de trabajo, reusada para los 20.
  const wsB = new WebSocket(lista.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok) => wsB.addEventListener('open', ok, { once: true }));
  const raiz = new Cdp(wsB);
  const { targetId } = await raiz.enviar('Target.createTarget', { url: 'about:blank', background: true });
  const { sessionId } = await raiz.enviar('Target.attachToTarget', { targetId, flatten: true });

  const pdfs = new Map(); // requestId -> {url, mime}
  let listos = [];
  raiz.oye.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Network.responseReceived') {
      const { response, requestId } = m.params;
      if (/application\/pdf|octet-stream/i.test(response.mimeType) || /\.pdf(\?|$)/i.test(response.url)) {
        pdfs.set(requestId, { url: response.url, mime: response.mimeType });
      }
    }
    if (m.method === 'Network.loadingFinished' && pdfs.has(m.params.requestId)) {
      listos.push(m.params.requestId);
    }
  });

  await raiz.enviar('Network.enable', {}, sessionId);
  await raiz.enviar('Page.enable', {}, sessionId);
  mkdirSync(destino, { recursive: true });

  let ok = 0;
  const fallos = [];

  for (const [i, url] of (plan.pdfs ?? []).entries()) {
    const id = new URL(url).searchParams.get('id');
    const meta = etiquetas.get(id);
    const nombre = meta?.clase
      ? `${String(meta.n).padStart(2, '0')} - ${limpio(meta.clase)}${meta.label ? ` - ${limpio(meta.label)}` : ''}.pdf`
      : `resumen-${String(i + 1).padStart(2, '0')}.pdf`;
    const salida = join(destino, nombre);

    if (existsSync(salida)) { console.log(`  = ${nombre}`); ok++; continue; }

    pdfs.clear(); listos = [];
    await raiz.enviar('Page.navigate', { url }, sessionId).catch(() => {});

    const t0 = Date.now();
    let guardado = false;
    while (Date.now() - t0 < ESPERA && !guardado) {
      await new Promise((r) => setTimeout(r, 400));
      for (const rid of [...listos]) {
        try {
          const { body, base64Encoded } = await raiz.enviar('Network.getResponseBody', { requestId: rid }, sessionId);
          const buf = base64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body, 'utf8');
          // Verificar que sea un PDF de verdad y no una página de error: si el
          // endpoint contesta HTML con status 200 (ya nos pasó con Drive), el
          // archivo quedaría "bajado" y roto.
          if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') continue;
          writeFileSync(salida, buf);
          console.log(`  ✓ ${nombre}  (${(buf.length / 1024).toFixed(0)} KB)`);
          guardado = true; ok++;
          break;
        } catch { /* el body puede no estar más en el buffer */ }
      }
    }
    if (!guardado) { console.log(`  ✖ ${nombre} — no apareció ningún PDF en ${ESPERA / 1000}s`); fallos.push({ url, nombre }); }
  }

  await raiz.enviar('Target.closeTarget', { targetId }).catch(() => {});
  wsB.close();

  console.log('\n' + '─'.repeat(70));
  console.log(`  ${ok}/${(plan.pdfs ?? []).length} PDF(s) · ${fallos.length} sin bajar`);
  console.log(`  → ${destino}`);
  console.log('─'.repeat(70));
  if (fallos.length) {
    console.log('\n  Sin bajar (volver a correr los reintenta; los que están se saltean):');
    for (const f of fallos.slice(0, 8)) console.log(`    ${f.nombre}\n      ${f.url}`);
  }
  console.log('');
  process.exit(fallos.length && !ok ? 1 : 0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
