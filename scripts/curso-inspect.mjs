// Diagnostico de UNA pagina de curso, sin recargar y sin tocar la sesion.
// Saca las dos cosas que hacen falta para escribir el descargador del curso entero:
//   A. la ESTRUCTURA del listado de clases (que selector las agrupa, cuantas hay,
//      si cada una es un link propio o cambia el player por JS)
//   B. el TRANSPORTE del video (m3u8 / mp4 / dash) + headers, arrancando el play
//      por codigo en vez de pedirle al humano que le de play.
//
// A diferencia de curso-sniff.mjs, este NO recarga: la pagina ya esta como esta.
//
//   node <ruta-absoluta>\scripts\curso-inspect.mjs [--segundos 25] [--port 9333]

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 9333));
const SEGUNDOS = Number(arg('segundos', 25));
const RAIZ = arg('raiz', 'C:\\cursos');

const TIPOS = [
  [/licen[sc]e|widevine|playready|fairplay|\/wv\/|certificate/i, 'LICENCIA'],
  [/\.m3u8(\?|$)/i, 'HLS'],
  [/\.mpd(\?|$)/i, 'DASH'],
  [/\.mp4(\?|$)/i, 'MP4'],
  [/\.(ts|m4s)(\?|$)/i, 'SEGMENTO'],
];
const clasificar = (u) => TIPOS.find(([re]) => re.test(u))?.[1] ?? null;

const HOOK_DRM = `(()=>{if(window.__drm)return;window.__drm={eme:[],ses:[]};
const r=navigator.requestMediaKeySystemAccess;if(r)navigator.requestMediaKeySystemAccess=function(k){try{window.__drm.eme.push(String(k))}catch(e){}return r.apply(this,arguments)};
if(window.MediaKeySession&&MediaKeySession.prototype.generateRequest){const g=MediaKeySession.prototype.generateRequest;MediaKeySession.prototype.generateRequest=function(t){try{window.__drm.ses.push(String(t))}catch(e){}return g.apply(this,arguments)}}})();`;

// Corre EN la pagina. Busca el patron repetido que forma el listado de clases.
const LEER_DOM = `(() => {
  const out = { url: location.href, titulo: document.title };

  // 1. Iframes (el player casi siempre es uno)
  out.iframes = [...document.querySelectorAll('iframe')].map(f => ({
    src: f.src || null, id: f.id || null, cls: f.className || null,
  })).filter(f => f.src);

  // 2. <video> nativos ya presentes
  out.videos = [...document.querySelectorAll('video')].map(v => ({
    src: v.currentSrc || v.src || null,
    fuentes: [...v.querySelectorAll('source')].map(s => s.src),
    dur: v.duration || null,
  }));

  // 3. Candidatos a "fila de clase": un elemento cuyo texto tiene duracion mm:ss
  //    o arranca con "N." — y despues se agrupa por el selector del PADRE, que es
  //    lo que convierte 40 nodos sueltos en "una lista de 40".
  const sel = (el) => {
    if (!el) return null;
    const t = el.tagName.toLowerCase();
    const c = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    return t + c;
  };
  const dur = /\\b\\d{1,2}:\\d{2}\\b/;
  const num = /^\\s*\\d{1,3}[.)]\\s+\\S/;
  const grupos = new Map();
  for (const el of document.querySelectorAll('a,li,div,article,button')) {
    const txt = (el.innerText || '').trim();
    if (!txt || txt.length > 220) continue;
    if (!dur.test(txt) && !num.test(txt)) continue;
    // el mas chico que contiene el texto: evita capturar el contenedor entero
    if ([...el.children].some((h) => (h.innerText || '').trim() === txt)) continue;
    const k = \`\${sel(el.parentElement)} > \${sel(el)}\`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push({
      texto: txt.replace(/\\s+/g, ' ').slice(0, 110),
      href: el.tagName === 'A' ? el.href : (el.querySelector('a')?.href ?? null),
      data: Object.fromEntries([...el.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value])),
    });
  }
  out.grupos = [...grupos.entries()]
    .map(([selector, items]) => ({ selector, n: items.length, muestra: items.slice(0, 6) }))
    .sort((a, b) => b.n - a.n).slice(0, 6);

  // 4. Links que parecen de leccion (por si cada clase es su propia URL)
  out.links = [...new Set([...document.querySelectorAll('a[href]')].map(a => a.href)
    .filter(h => /curso|leccion|lecci|clase|module|modulo|video|watch|lesson/i.test(h)))].slice(0, 60);

  // 5. Payloads que las apps meten en el HTML (Next/Nuxt/Inertia): ahi suele
  //    estar la lista COMPLETA de lecciones sin tener que clickear nada.
  out.payloads = [];
  for (const s of document.querySelectorAll('script')) {
    const id = s.id || '';
    const t = s.type || '';
    if (/__NEXT_DATA__|__NUXT__|__remixContext|application\\/json/i.test(id + ' ' + t) ||
        /self\\.__next_f|__NUXT__|window\\.__INITIAL/.test((s.textContent || '').slice(0, 200))) {
      out.payloads.push({ id: id || null, type: t || null, largo: (s.textContent || '').length });
    }
  }
  return out;
})()`;

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
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 20000);
    });
  }
  al(f) { this.oye.push(f); }
}

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en 127.0.0.1:${PORT}. ¿Corriste curso-perfil.ps1?\n`); process.exit(1); }

  const pag = lista.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const obj = pag.find((t) => /curso|leccion|clase/i.test(t.url)) ?? pag.find((t) => t.url !== 'about:blank') ?? pag[0];
  if (!obj) { console.error('  ✖ No hay pestañas.'); process.exit(1); }

  console.log(`\n  Pestaña: ${obj.title}\n  URL    : ${obj.url}\n`);

  const ws = new WebSocket(obj.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);

  const media = new Map();
  const sesiones = new Set();
  const iframesVistos = new Set();

  const preparar = async (sid) => {
    for (const [m, p] of [['Runtime.enable', {}], ['Network.enable', {}], ['Page.enable', {}],
      ['Page.addScriptToEvaluateOnNewDocument', { source: HOOK_DRM }],
      ['Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }]]) {
      await cdp.enviar(m, p, sid).catch(() => {});
    }
  };

  cdp.al(async (m) => {
    if (m.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = m.params;
      sesiones.add(sessionId);
      if (targetInfo.url && targetInfo.url !== 'about:blank') {
        iframesVistos.add(targetInfo.url);
        console.log(`  → target: ${targetInfo.url.slice(0, 120)}`);
      }
      await preparar(sessionId);
      await cdp.enviar('Runtime.runIfWaitingForDebugger', {}, sessionId).catch(() => {});
      return;
    }
    if (m.method === 'Network.requestWillBeSent') {
      const u = m.params.request.url;
      const t = clasificar(u);
      if (!t) return;
      if (!media.has(u)) {
        media.set(u, { tipo: t, referer: m.params.request.headers?.Referer ?? null, doc: m.params.documentURL ?? null });
        if (t !== 'SEGMENTO') console.log(`  [${t}] ${u.slice(0, 140)}`);
      }
    }
  });

  await preparar(undefined);

  const { result: dom } = await cdp.enviar('Runtime.evaluate', { expression: LEER_DOM, returnByValue: true, awaitPromise: false });
  const d = dom?.value ?? {};

  console.log('\n  ── LISTADO DE CLASES ──');
  for (const g of d.grupos ?? []) {
    console.log(`\n  ${g.n}×  ${g.selector}`);
    for (const it of g.muestra) console.log(`      · ${it.texto}${it.href ? `   → ${it.href.slice(-70)}` : ''}`);
  }
  console.log('\n  ── IFRAMES ──');
  for (const f of d.iframes ?? []) console.log(`  · ${f.src.slice(0, 140)}`);
  if (d.videos?.length) {
    console.log('\n  ── <video> ──');
    for (const v of d.videos) console.log(`  · src=${v.src || '(vacío)'} fuentes=${JSON.stringify(v.fuentes)}`);
  }
  if (d.payloads?.length) {
    console.log('\n  ── PAYLOADS EN EL HTML (acá puede estar el curso entero) ──');
    for (const p of d.payloads) console.log(`  · ${p.id || p.type} — ${p.largo} chars`);
  }
  console.log(`\n  Links tipo lección: ${d.links?.length ?? 0}`);
  for (const l of (d.links ?? []).slice(0, 12)) console.log(`      ${l}`);

  // Arrancar el play por codigo: ni el humano ni un click a ciegas.
  console.log(`\n  Intentando arrancar el video por código y capturando ${SEGUNDOS}s…\n`);
  const PLAY = `(async () => {
    const r = [];
    for (const v of document.querySelectorAll('video')) { try { v.muted = true; await v.play(); r.push('video.play()'); } catch (e) { r.push('video: ' + e.message); } }
    const b = document.querySelector('[aria-label*="lay" i],button[class*="play" i],.vjs-big-play-button,.plyr__control--overlaid');
    if (b) { b.click(); r.push('click ' + (b.className || b.getAttribute('aria-label'))); }
    return r.join(' | ') || 'sin <video> ni botón en el documento de arriba (está en el iframe)';
  })()`;
  for (const sid of [undefined, ...sesiones]) {
    const { result } = await cdp.enviar('Runtime.evaluate', { expression: PLAY, returnByValue: true, awaitPromise: true }, sid).catch(() => ({ result: null }));
    if (result?.value) console.log(`  play(${sid ? sid.slice(0, 8) : 'raíz'}): ${result.value}`);
  }

  await new Promise((r) => setTimeout(r, SEGUNDOS * 1000));

  const drm = { eme: [], ses: [] };
  for (const sid of [undefined, ...sesiones]) {
    const { result } = await cdp.enviar('Runtime.evaluate', { expression: 'JSON.stringify(window.__drm||{})', returnByValue: true }, sid).catch(() => ({ result: null }));
    try { const x = JSON.parse(result?.value || '{}'); drm.eme.push(...(x.eme ?? [])); drm.ses.push(...(x.ses ?? [])); } catch {}
  }

  const todo = [...media.entries()].map(([url, v]) => ({ url, ...v }));
  const porTipo = (t) => todo.filter((x) => x.tipo === t);
  mkdirSync(RAIZ, { recursive: true });
  const salida = join(RAIZ, 'inspect.json');
  writeFileSync(salida, JSON.stringify({ dom: d, media: todo, drm, iframes: [...iframesVistos] }, null, 2), 'utf8');

  console.log('\n' + '─'.repeat(70));
  console.log(`  HLS ${porTipo('HLS').length} · MP4 ${porTipo('MP4').length} · DASH ${porTipo('DASH').length} · LICENCIA ${porTipo('LICENCIA').length} · segmentos ${porTipo('SEGMENTO').length}`);
  console.log(`  EME: ${drm.eme.length ? [...new Set(drm.eme)].join(', ') : 'ninguno'}`);
  console.log(`  → ${salida}`);
  console.log('─'.repeat(70) + '\n');
  ws.close();
  process.exit(0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
