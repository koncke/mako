// Recorre TODAS las clases de un curso y arma el plan de descarga. Una corrida
// por curso, no una por clase.
//
// Como funciona y por que asi: el listado de clases son <button>, no links — es
// una SPA que cambia el src del <iframe> del player. No hay URL por clase, asi
// que la unica forma de enumerar es clickear cada boton y leer el iframe nuevo.
//
// Se queda con el ID del video del player (ej. Vimeo 1214168115), NO con la URL
// firmada del CDN: esas traen exp=<timestamp> y caducan en minutos. El ID es
// estable y yt-dlp resuelve el resto con el Referer correcto.
//
//   node <abs>\scripts\curso-plan.mjs
//   node <abs>\scripts\curso-plan.mjs --port 9333 --espera 9

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 9333));
const ESPERA = Number(arg('espera', 9)) * 1000; // tope para que cambie el iframe
const RAIZ = arg('raiz', 'C:\\cursos');

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);

// Nombre de archivo valido en Windows: sin <>:"/\|?* ni punto/espacio final.
const limpio = (s) => s.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 120) || 'sin-titulo';

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
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 25000);
    });
  }
}

// Extrae el id del video de la URL del iframe, por plataforma.
const idDePlayer = (src) => {
  if (!src) return null;
  for (const [re, plat] of [
    [/player\.vimeo\.com\/video\/(\d+)/i, 'vimeo'],
    [/iframe\.mediadelivery\.net\/(?:embed|play)\/\d+\/([a-f0-9-]+)/i, 'bunny'],
    [/youtube\.com\/embed\/([\w-]{11})/i, 'youtube'],
    [/drive\.google\.com\/file\/d\/([\w-]+)/i, 'drive'],
    [/pandavideo[^?]*\?v=([\w-]+)/i, 'panda'],
    [/fast\.wistia\.net\/embed\/iframe\/(\w+)/i, 'wistia'],
  ]) {
    const m = re.exec(src);
    if (m) return { plataforma: plat, id: m[1] };
  }
  return { plataforma: 'desconocida', id: null };
};

// URL canonica para pasarle a yt-dlp.
const urlDescarga = ({ plataforma, id }, src) => {
  if (plataforma === 'vimeo') return `https://player.vimeo.com/video/${id}`;
  if (plataforma === 'youtube') return `https://www.youtube.com/watch?v=${id}`;
  if (plataforma === 'drive') return `https://drive.google.com/file/d/${id}/view`;
  return src; // bunny/wistia/panda: la URL del embed sirve tal cual
};

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}. Corré curso-perfil.ps1 primero.\n`); process.exit(1); }

  const pag = lista.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const obj = pag.find((t) => /\/curso\//i.test(t.url)) ?? pag.find((t) => t.url !== 'about:blank');
  if (!obj) { console.error('  ✖ No encuentro una pestaña con un curso abierto.\n'); process.exit(1); }

  const ws = new WebSocket(obj.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.enviar('Runtime.enable');

  const ev = async (expression, awaitPromise = false) => {
    const { result } = await cdp.enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    return result?.value;
  };

  const titulo = await ev('document.title');
  const curso = limpio(String(titulo).split(/\s+[—|]\s+/)[0]);
  console.log(`\n  Curso : ${curso}`);
  console.log(`  URL   : ${obj.url}\n`);

  // 1. Abrir todos los acordeones de módulo, si alguno estuviera cerrado.
  //    Si ya están abiertos esto no hace nada malo: se mide el antes y el después.
  const antes = await ev(`document.querySelectorAll('button').length`);
  await ev(`(() => {
    const mods = [...document.querySelectorAll('button')].filter(b => /^\\s*\\d+\\..{2,60}\\s+\\d+\\/\\d+\\s*$/.test((b.innerText||'').replace(/\\s+/g,' ').trim()));
    mods.forEach(b => { try { if (b.getAttribute('aria-expanded') === 'false') b.click(); } catch (e) {} });
    return mods.length;
  })()`);
  await new Promise((r) => setTimeout(r, 700));
  const despues = await ev(`document.querySelectorAll('button').length`);
  if (despues !== antes) console.log(`  (abrí módulos: ${antes} → ${despues} botones)\n`);

  // 2. Enumerar clases. Heurística robusta en vez de clases de Tailwind (que
  //    cambian con cualquier build): un <button> cuyo texto tiene duración mm:ss.
  //    Se les pone un data-attr para poder volver a agarrar el MISMO botón después
  //    de cada click, porque React reordena y re-renderiza los nodos.
  const clases = await ev(`(() => {
    const dur = /\\b(\\d{1,2}:\\d{2})\\b/;
    const vistos = new Set();
    const out = [];
    let i = 0;
    for (const b of document.querySelectorAll('button')) {
      const txt = (b.innerText || '').replace(/\\s+/g, ' ').trim();
      if (!txt || txt.length > 200) continue;
      const m = dur.exec(txt);
      if (!m) continue;
      if (/\\d+\\/\\d+\\s*$/.test(txt)) continue;          // cabecera de módulo
      if (/^\\d+ *\\/ *\\d+/.test(txt)) continue;
      if (vistos.has(txt)) continue;
      vistos.add(txt);
      b.setAttribute('data-cx', String(i));
      out.push({
        idx: i,
        crudo: txt,
        duracion: m[1],
        titulo: txt.replace(/^\\s*\\d{1,3}\\s+/, '').replace(dur, '').replace(/^\\s*\\d{1,3}[.)]\\s*/, '').trim(),
      });
      i++;
    }
    return out;
  })()`);

  if (!clases?.length) {
    console.error('  ✖ No encontré ninguna clase. Abrí la página del curso (no el catálogo).\n');
    process.exit(1);
  }
  console.log(`  ${clases.length} clases detectadas.\n`);

  // 3. Módulos: para saber a qué módulo pertenece cada clase, se lee el orden
  //    del documento — la cabecera de módulo precede a sus clases.
  const modulos = await ev(`(() => {
    const out = [];
    const todos = [...document.querySelectorAll('button')];
    let mod = null;
    for (const b of todos) {
      const txt = (b.innerText || '').replace(/\\s+/g, ' ').trim();
      if (/^\\s*\\d+\\..{2,60}\\s+\\d+\\/\\d+\\s*$/.test(txt)) { mod = txt.replace(/\\s+\\d+\\/\\d+\\s*$/, '').trim(); continue; }
      const cx = b.getAttribute('data-cx');
      if (cx !== null) out.push({ idx: Number(cx), modulo: mod });
    }
    return out;
  })()`);
  const modDe = new Map((modulos ?? []).map((m) => [m.idx, m.modulo]));

  // 4. Recorrer: click -> esperar a que el iframe cambie -> anotar el id.
  const srcActual = () => ev(`(document.querySelector('iframe[src*="player"], iframe[src*="embed"], iframe[src*="vimeo"]') || document.querySelector('iframe') || {}).src || null`);
  const plan = [];
  let previo = await srcActual();

  for (const c of clases) {
    const etiqueta = `${String(c.idx + 1).padStart(2, '0')} ${c.titulo}`;
    const clickeado = await ev(`(() => { const b = document.querySelector('button[data-cx="${c.idx}"]'); if (!b) return false; b.click(); return true; })()`);
    if (!clickeado) { console.log(`  ✖ ${etiqueta} — no pude re-encontrar el botón`); continue; }

    // Esperar el cambio de src, sin dormir a ciegas.
    let src = previo, t0 = Date.now();
    while (Date.now() - t0 < ESPERA) {
      await new Promise((r) => setTimeout(r, 350));
      const s = await srcActual();
      if (s && s !== previo) { src = s; break; }
    }

    const info = idDePlayer(src);
    if (!src || src === previo || !info?.id) {
      // Puede ser la clase que YA estaba cargada: no es un fallo si tiene id.
      const inf2 = idDePlayer(previo);
      if (inf2?.id && plan.every((p) => p.videoId !== inf2.id)) {
        plan.push({ n: c.idx + 1, titulo: c.titulo, duracion: c.duracion, modulo: modDe.get(c.idx) ?? null, plataforma: inf2.plataforma, videoId: inf2.id, url: urlDescarga(inf2, previo), archivo: `${String(c.idx + 1).padStart(2, '0')} - ${limpio(c.titulo)}` });
        console.log(`  ✓ ${etiqueta}  (${inf2.plataforma} ${inf2.id})  [ya cargada]`);
      } else {
        console.log(`  ⚠ ${etiqueta} — el iframe no cambió en ${ESPERA / 1000}s`);
      }
      continue;
    }

    plan.push({
      n: c.idx + 1,
      titulo: c.titulo,
      duracion: c.duracion,
      modulo: modDe.get(c.idx) ?? null,
      plataforma: info.plataforma,
      videoId: info.id,
      url: urlDescarga(info, src),
      archivo: `${String(c.idx + 1).padStart(2, '0')} - ${limpio(c.titulo)}`,
    });
    console.log(`  ✓ ${etiqueta}  (${info.plataforma} ${info.id})`);
    previo = src;
  }

  // 5. PDFs de resumen que cuelgan de las clases.
  const pdfs = await ev(`[...new Set([...document.querySelectorAll('a[href*="Reader?type=resource"]')].map(a => a.href))]`);

  const ua = await ev('navigator.userAgent');
  const dir = join(RAIZ, slug(curso));
  mkdirSync(dir, { recursive: true });
  const destino = join(dir, 'plan.json');

  // Si ya existe un plan, no se pisa a ciegas: se guarda al lado.
  const salida = existsSync(destino) ? join(dir, 'plan.nuevo.json') : destino;
  writeFileSync(salida, JSON.stringify({
    curso, slug: slug(curso), pagina: obj.url, userAgent: ua,
    referer: new URL(obj.url).origin + '/',
    clases: plan, pdfs: pdfs ?? [],
  }, null, 2), 'utf8');

  const faltan = clases.length - plan.length;
  console.log('\n' + '─'.repeat(70));
  console.log(`  ${plan.length}/${clases.length} clases con video${faltan ? ` · ⚠ ${faltan} sin resolver` : ''}`);
  console.log(`  ${(pdfs ?? []).length} PDF(s) de resumen`);
  console.log(`  Plataforma: ${[...new Set(plan.map((p) => p.plataforma))].join(', ') || '—'}`);
  console.log(`  → ${salida}`);
  console.log('─'.repeat(70));
  if (salida !== destino) console.log(`\n  ⚠ Ya había un plan.json: lo dejé como plan.nuevo.json para que compares.`);
  console.log(`\n  Siguiente:  node <abs>\\scripts\\curso-bajar.mjs --plan "${destino}"\n`);
  ws.close();
  process.exit(faltan ? 3 : 0);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
