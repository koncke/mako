// Baja la MINIATURA del curso y la deja en public/cono-portadas/<slug>.<ext>.
//
// El portal la muestra en la tarjeta de la grilla de cursos y arriba del título al
// entrar. Va como archivo estático del repo y no como id de Drive porque se pinta en
// la grilla de TODOS los cursos: una miniatura de Drive por tarjeta son N requests a
// un dominio externo, y encima exige que cada archivo esté compartido.
//
// De dónde sale, EN ESTE ORDEN:
//
//   1. La columna `cover_image` de la tabla `courses` de la plataforma. Es la tapa de
//      verdad —1200-1672 px de ancho—, la URL es de storage PÚBLICO y está poblada en
//      las 130 filas. No hace falta ni navegador ni sesión: es una sola request.
//   2. Y solo si eso no da nada, la tarjeta del catálogo, con el navegador.
//
// ⚠️ EL ORDEN ES EL ARREGLO, y estuvo al revés desde el primer día. El camino 2 era el
// único, y lo que raspa de la tarjeta es la MINIATURA DE LA GRILLA: 456x256. Medido el
// 24/08/2026 sobre los 21 cursos publicados que existen en la plataforma, DIECIOCHO
// tenían esa miniatura de 456x256 como portada, contra los 1536x1024 que la API
// entregaba gratis al lado — **13,5 veces menos píxeles**. En la tarjeta chica pasa
// desapercibido; arriba del título, estirada a 1200 px de ancho, se ve el pixelado.
//
// Lo que más cuesta ver acá es que el camino equivocado estaba BIEN ARGUMENTADO. El
// comentario que estaba en este lugar decía, con razón, que «la imagen más grande de la
// landing» sería una heurística que agarra cualquier cosa — y concluía que el <img> de
// la tarjeta era «un dato». No lo es: es otra heurística, con tres capas de desempate
// encima (frecuencia, proporción, área) para no traer el logo del sitio ni el avatar del
// autor. Todo ese andamiaje existe porque la fuente estaba mal elegida. Un dato es una
// columna con la URL adentro; si hay que desempatar, todavía estás adivinando.
//
//   node <abs>\scripts\curso-portada.mjs --plan C:\cursos\<slug>\plan.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  // ⚠️ El slug de la PLATAFORMA sale del ÚLTIMO segmento útil, no del penúltimo.
  // Con `slice(-2,-1)` funcionaba de casualidad para `/vip/course/<slug>/watch` y
  // devolvía literalmente «curso» para `/curso/<slug>` — que matchea TODAS las
  // tarjetas del catálogo. Resultado: la portada del curso de Claude terminó siendo
  // la de otro curso cualquiera.
  const segmentos = String(plan.pagina ?? '').replace(/[?#].*$/, '').split('/').filter(Boolean);
  const utiles = segmentos.filter((s) => !/^(https?:|watch|www\.|[^.]+\.[a-z]{2,})$/i.test(s) && !/^(curso|course|vip)$/i.test(s));
  slugPlataforma = utiles[utiles.length - 1] ?? plan.slug;
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

// ── Camino 1: la columna `cover_image` de la plataforma ──────────────────────
//
// La anon key es la publishable de cursoselite: la misma que el navegador manda en el
// header `apikey` en cada request de la página. Da lectura sobre `courses`, que es
// justamente el catálogo público.
const API = arg('api', 'https://wzdewdxwwkhtivichomf.supabase.co');
const API_KEY = arg('apikey', 'sb_publishable_NNcx3usV32_QHC9hS3SAOA_diZD9aUR');

const desdeLaApi = async () => {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '').toLowerCase();
  let filas;
  try {
    const r = await fetch(`${API}/rest/v1/courses?select=slug,title,cover_image&limit=1000`,
      { headers: { apikey: API_KEY, authorization: `Bearer ${API_KEY}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    filas = await r.json();
  } catch (e) {
    console.log(`  la API no contestó (${e.message}) — voy por el catálogo`);
    return null;
  }
  // Por slug primero (exacto), y si no, por título: varios cursos se renombraron al
  // publicarlos y el slug del portal ya no coincide con el de allá.
  const hit = filas.find((c) => c.slug === slugPlataforma)
    ?? filas.find((c) => c.slug === slugPortal)
    ?? filas.find((c) => norm(c.title) === norm(nombreCurso))
    ?? filas.find((c) => norm(c.title) === norm(String(nombreCurso).split(' - ')[0]));
  if (!hit) { console.log(`  la API tiene ${filas.length} cursos y ninguno es éste — voy por el catálogo`); return null; }
  if (!hit.cover_image) { console.log(`  «${String(hit.title).trim()}» existe pero sin cover_image — voy por el catálogo`); return null; }
  console.log(`  ✓ cover_image de «${String(hit.title).trim()}»`);
  return hit.cover_image;
};

// ── Camino 2: la tarjeta del catálogo, con el navegador ──────────────────────
const desdeElCatalogo = async () => {
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
          // La PROPORCIÓN, para distinguir la tapa del avatar del autor. Ver el
          // criterio de orden más abajo.
          ratio: (im.naturalHeight || im.height || 0) > 0
            ? (im.naturalWidth || im.width || 0) / (im.naturalHeight || im.height || 0)
            : 0,
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

    // ⚠️ El orden NO puede ser por área. La tarjeta de un curso trae DOS imágenes: la
    // tapa (16:9) y el avatar del autor (cuadrado), y el avatar suele ganar por área
    // — el de Alex Hormozi es 450×450 = 202.500 px contra 456×256 = 116.736 de la
    // tapa. Así se instaló su foto de perfil como portada del curso.
    //
    // Una tapa de curso es APAISADA y un avatar es cuadrado o vertical, así que la
    // proporción separa las dos cosas mucho mejor que el tamaño. El área queda de
    // último desempate, entre imágenes que ya son apaisadas.
    const apaisada = (x) => (x.ratio ?? 0) >= 1.4;
    mias.sort((a, b) =>
      (veces.get(a.src) - veces.get(b.src))
      || (Number(apaisada(b)) - Number(apaisada(a)))
      || (b.area - a.area));
    const elegida = mias[0];

    // ⚠️ VERIFICACIÓN, y existe porque acá se instaló la portada de OTRO curso: el
    // texto de la tarjeta elegida tiene que contener palabras del título del curso.
    // Emparejar por href y no comprobar nada más deja pasar cualquier bug del slug en
    // silencio, y una portada equivocada no se nota hasta que alguien la mira.
    const distintivas = norm(nombreCurso).split(/\s+/)
      .filter((t) => t.length > 3 && !['curso','clase','online','vivo','para','como','todo'].includes(t));
    const textoTarjeta = norm(`${elegida.texto ?? ''} ${elegida.href}`);
    const aciertos = distintivas.filter((t) => textoTarjeta.includes(t));
    if (distintivas.length && aciertos.length === 0) {
      console.log(`no coincide: la tarjeta no menciona nada de «${nombreCurso}»`);
      console.log(`      texto de la tarjeta: ${(elegida.texto ?? '').slice(0, 80)}`);
      continue;
    }
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
  return url;
};

const main = async () => {
  console.log(`\n  Curso     : ${nombreCurso}`);
  console.log(`  Plataforma: ${slugPlataforma}`);
  console.log(`  Portal    : ${slugPortal}\n`);

  let url = await desdeLaApi();
  if (!url) url = await desdeElCatalogo();

  if (!url) {
    console.error(`\n  ✖ No encontré la miniatura de este curso ni en la API ni en el catálogo.`);
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

  // ⚠️ La tapa NO va cruda. La grilla de /conocimientos pide la portada de TODOS los
  // cursos de una: 31 tapas al peso de origen son 16 MB en una sola pantalla, y las de
  // la plataforma llegan a 2,2 MB cada una. Se reescalan a 1200 px de ancho y se pasan
  // a webp, que las deja en 35-145 KB sin perder nitidez a la vista.
  //
  // `min(1200,iw)` NUNCA agranda: una tapa que ya viene chica se queda como está, en vez
  // de estirarse a 1200 y verse peor que el original.
  const ANCHO = 1200;
  const crudo = join(dir, `.tmp-${slugPortal}.${ext}`);
  writeFileSync(crudo, buf);
  const salida = join(dir, `${slugPortal}.webp`);
  let convertida = false;
  try {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', crudo,
      '-vf', `scale='min(${ANCHO},iw)':-2:flags=lanczos`,
      '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6', salida]);
    convertida = existsSync(salida);
  } catch (e) {
    console.log(`  ⚠ no pude convertir (${e.message.slice(0, 60)}) — la dejo tal cual`);
  }
  unlinkSync(crudo);

  // Si ffmpeg no está o falló, la tapa cruda es mejor que ninguna tapa.
  const final = convertida ? salida : join(dir, `${slugPortal}.${ext}`);
  if (!convertida) writeFileSync(final, buf);

  // Una sola portada por curso: si había otra con distinta extensión, se reemplaza. Va
  // DESPUÉS de escribir, y con el nombre final ya resuelto: `curso-a-portal.mjs` elige
  // la portada con readdirSync().find(), o sea el PRIMER archivo cuyo nombre coincida —
  // con dos extensiones conviviendo, cuál gana depende del orden del directorio.
  for (const f of readdirSync(dir)) {
    if (f.replace(/\.[^.]+$/, '') === slugPortal && join(dir, f) !== final) unlinkSync(join(dir, f));
  }

  const kb = (readFileSync(final).length / 1024).toFixed(0);
  let dim = '';
  try {
    dim = ' · ' + execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', final], { encoding: 'utf8' })
      .trim().replace(',', 'x');
  } catch { /* ffprobe es informativo: sin él la portada igual quedó escrita */ }

  console.log(`\n  ✓ ${kb} KB${dim}  (venían ${(buf.length / 1024).toFixed(0)} KB de origen)`);
  console.log(`  → ${final}`);
  console.log(`\n  Volvé a correr curso-a-portal.mjs para que la ficha la declare.\n`);
};

main().catch((e) => { console.error(`\n  ✖ ${e.message}\n`); process.exit(1); });
