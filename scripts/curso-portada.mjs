// Baja la MINIATURA del curso y la deja en public/cono-portadas/<slug>.<ext>.
//
// El portal la muestra en la tarjeta de la grilla de cursos y arriba del título al
// entrar. Va como archivo estático del repo y no como id de Drive porque se pinta en
// la grilla de TODOS los cursos: una miniatura de Drive por tarjeta son N requests a
// un dominio externo, y encima exige que cada archivo esté compartido.
//
// De dónde sale: de la tarjeta del catálogo, que es donde vive de forma determinista.
// Buscar «la imagen más grande de la landing» sería una heurística que agarra
// cualquier cosa; el <img> de la tarjeta cuyo <a> apunta a ESTE curso es un dato.
//
//   node <abs>\scripts\curso-portada.mjs --plan C:\cursos\<slug>\plan.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PLAN = arg('plan', '');
const PORT = Number(arg('port', 9333));
const REPO = arg('repo', 'C:\\Users\\marti\\OneDrive\\Escritorio\\dashboard-marketing-main\\dashboard-marketing');
const ORIGEN = arg('origen', 'https://cursoselite.com.mx');
const CATALOGOS = (arg('catalogos', '/Catalog,/vip/') || '').split(',').filter(Boolean);

// Dos modos:
//   --plan <plan.json>            para un curso del pipeline (saca slug y URL del plan)
//   --buscar "<texto>" --slug <s> para uno que NO tiene plan: los cursos viejos del
//                                 portal, que igual necesitan su miniatura.
const BUSCAR = arg('buscar', '');
const SLUG = arg('slug', '');

let slugPortal, slugPlataforma, nombreCurso;
if (PLAN && existsSync(PLAN)) {
  const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
  // El slug del PORTAL (el que usa curso-a-portal para nombrar el archivo del curso),
  // no el de la carpeta: si no coinciden, la portada queda huérfana y no se muestra.
  slugPortal = (plan.slug ?? '').replace(/^curso-(de-)?/, '');
  // El slug de la PLATAFORMA, para encontrar la tarjeta en el catálogo.
  slugPlataforma = String(plan.pagina ?? '').split('/').filter(Boolean).slice(-2, -1)[0] ?? plan.slug;
  nombreCurso = plan.curso;
} else if (BUSCAR && SLUG) {
  slugPortal = SLUG;
  slugPlataforma = null; // se busca por TEXTO de la tarjeta, no por href
  nombreCurso = BUSCAR;
} else {
  console.error('\n  ✖ Falta --plan <plan.json>, o --buscar "<nombre>" --slug <slug-del-portal>\n');
  process.exit(1);
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pend = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pend.has(m.id)) {
        const { ok, no } = this.pend.get(m.id); this.pend.delete(m.id);
        m.error ? no(new Error(m.error.message)) : ok(m.result);
      }
    });
  }
  enviar(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, no) => {
      this.pend.set(id, { ok, no });
      setTimeout(() => this.pend.has(id) && (this.pend.delete(id), no(new Error(`timeout ${method}`))), 25000);
    });
  }
}

const main = async () => {
  let lista;
  try { lista = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()); }
  catch { console.error(`\n  ✖ No hay CDP en ${PORT}. Corré curso-perfil.ps1.\n`); process.exit(1); }
  const t = lista.find((x) => x.type === 'page' && !x.url.startsWith('devtools://'));
  if (!t) { console.error('  ✖ No hay pestañas.\n'); process.exit(1); }

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => no(new Error('no pude conectar a CDP')), { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.enviar('Runtime.enable');
  await cdp.enviar('Page.enable');
  const ev = async (expr) => (await cdp.enviar('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

  console.log(`\n  Curso     : ${nombreCurso}`);
  console.log(`  Plataforma: ${slugPlataforma}`);
  console.log(`  Portal    : ${slugPortal}`);

  // ⚠️ Elegir «la primera imagen de la tarjeta» trae el LOGO del sitio: la primera
  // versión bajó la corona de Cursos Élite como portada del curso de Claude.
  //
  // La señal que los distingue es la FRECUENCIA: un logo, un ícono o un placeholder
  // aparecen en todas las tarjetas del catálogo; la portada aparece solo en la suya.
  // Así que se juntan las imágenes de TODAS las tarjetas, se cuenta cada src, y de la
  // tarjeta objetivo se toma la menos repetida — con desempate por área, porque una
  // portada es grande y un ícono no.
  const BUSCAR_IMGS = `(() => {
    const out = [];
    for (const a of document.querySelectorAll('a[href]')) {
      if (!/\\/(curso|course)\\//i.test(a.href)) continue;
      const cont = a.closest('article,li,div') || a;
      const imgs = [...new Set([...a.querySelectorAll('img'), ...cont.querySelectorAll('img')])];
      for (const im of imgs) {
        const src = im.currentSrc || im.src;
        if (!src || src.startsWith('data:')) continue;
        out.push({
          href: a.href, src,
          texto: ((cont.innerText || a.innerText || '') + ' ' + (im.alt || '')).replace(/\\s+/g, ' ').slice(0, 200),
          area: (im.naturalWidth || im.width || 0) * (im.naturalHeight || im.height || 0),
        });
      }
    }
    return out;
  })()`;

  let url = null;
  for (const ruta of CATALOGOS) {
    if (url) break;
    process.stdout.write(`  buscando en ${ORIGEN}${ruta} … `);
    await cdp.enviar('Page.navigate', { url: ORIGEN + ruta });
    let todas = [];
    for (let i = 0; i < 35; i++) {
      await new Promise((r) => setTimeout(r, 400));
      todas = (await ev(BUSCAR_IMGS)) ?? [];
      // Se espera a que el catálogo esté cargado de verdad: con 3 tarjetas la
      // frecuencia todavía no distingue un logo de una portada.
      if (todas.length > 12) break;
    }
    if (!todas.length) { console.log('sin tarjetas'); continue; }

    const veces = new Map();
    for (const x of todas) veces.set(x.src, (veces.get(x.src) ?? 0) + 1);
    // Con plan se matchea por href (exacto); sin plan, por el TEXTO de la tarjeta.
    const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const terminos = norm(nombreCurso).split(/\s+/).filter((t) => t.length > 2);
    const mias = slugPlataforma
      ? todas.filter((x) => x.href.includes(slugPlataforma))
      : todas.filter((x) => terminos.every((t) => norm(`${x.texto ?? ''} ${x.href}`).includes(t)));
    if (!mias.length) { console.log(`${todas.length} imágenes, ninguna de este curso`); continue; }

    mias.sort((a, b) => (veces.get(a.src) - veces.get(b.src)) || (b.area - a.area));
    const elegida = mias[0];
    // Si la menos repetida IGUAL aparece en varias tarjetas, es chrome del sitio:
    // mejor no poner portada que poner el logo en todos los cursos.
    if (veces.get(elegida.src) > 1) {
      console.log(`solo encontré imágenes compartidas (×${veces.get(elegida.src)}): es chrome, no portada`);
      continue;
    }
    url = elegida.src;
    console.log(`encontrada (única entre ${todas.length} imágenes)`);
  }
  ws.close();

  if (!url) {
    console.error(`\n  ✖ No encontré la miniatura de este curso en el catálogo.`);
    console.error(`    Sin portada el portal muestra la tarjeta sin imagen (no se rompe nada).\n`);
    process.exit(3);
  }
  console.log(`  imagen    : ${url.slice(0, 100)}`);

  const res = await fetch(url);
  if (!res.ok) { console.error(`\n  ✖ La imagen dio HTTP ${res.status}\n`); process.exit(1); }
  const buf = Buffer.from(await res.arrayBuffer());

  // La extensión sale de los BYTES, no de la URL: muchas CDN sirven webp desde una
  // ruta que dice .jpg, y un archivo con extensión mentida no lo pinta el navegador.
  const firma = buf.subarray(0, 12);
  const ext = firma.subarray(0, 3).toString('hex') === 'ffd8ff' ? 'jpg'
    : firma.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? 'png'
    : firma.subarray(8, 12).toString('latin1') === 'WEBP' ? 'webp'
    : firma.subarray(0, 6).toString('latin1').startsWith('GIF8') ? 'gif'
    : null;
  if (!ext) {
    console.error(`\n  ✖ Lo que bajó no es una imagen (empieza con ${JSON.stringify(firma.toString('latin1').slice(0, 12))}).\n`);
    process.exit(1);
  }

  const dir = join(REPO, 'public', 'cono-portadas');
  mkdirSync(dir, { recursive: true });
  // Una sola portada por curso: si había otra con distinta extensión, se reemplaza.
  for (const f of readdirSync(dir)) {
    if (f.replace(/\.[^.]+$/, '') === slugPortal && f !== `${slugPortal}.${ext}`) unlinkSync(join(dir, f));
  }
  const salida = join(dir, `${slugPortal}.${ext}`);
  writeFileSync(salida, buf);

  console.log(`\n  ✓ ${(buf.length / 1024).toFixed(0)} KB · ${ext}`);
  console.log(`  → ${salida}`);
  console.log(`\n  Volvé a correr curso-a-portal.mjs para que la ficha la declare.\n`);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
