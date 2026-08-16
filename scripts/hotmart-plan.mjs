// Arma el plan.json de un curso de HOTMART CLUB, con el mismo formato que
// curso-plan-vip.mjs, para que el resto del pipeline (audio, transcripción, Drive,
// ficha) funcione sin cambios.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
// «Creator Club» estaba en dos lados: Cursos Élite (31 clases, 16,3 h) y Hotmart,
// comprado por el dueño (64 contenidos, 31,6 h). Es el MISMO curso con la mitad
// recortada del lado del revendedor: Premiere/AE 8 contra 22, CapCut 15 contra 20,
// DaVinci 2 contra 9. La copia buena es la comprada, y encima es la fuente limpia.
//
// ── Cómo se llega al video (tres saltos, ninguno adivinado) ──────────────────
//   1. `/v1/navigation` en el gateway del club → módulos y lecciones con su `hash`.
//   2. `/v1/lesson/<hash>` → `mediasSrc[].mediaSrcUrl`, un embed de
//      `cf-embed.play.hotmart.com` firmado con un JWT.
//   3. El embed, cargado CON Referer de hotmart.com, pide el master `.m3u8` a
//      `vod-akm.play.hotmart.com`. Ese paso lo hace `hotmart-bajar.mjs`, no éste.
//
// ⚠️ yt-dlp NO tiene extractor de Hotmart: por eso hay que llegar al `.m3u8` a mano.
//    Una vez que se tiene, es HLS común y yt-dlp lo baja igual que cualquier otro.
//
// ⚠️ NO hay DRM, y eso está VERIFICADO, no supuesto: el payload del JWT del embed
//    dice `playDrm:false`, y la captura de red muestra `.m3u8` sin ningún `.mpd` ni
//    license server. Si algún día eso cambia, `hotmart-bajar.mjs` lo detecta y frena
//    (misma regla que ya estaba escrita para cualquier curso con DRM).
//
// ⚠️ Los headers de la app (Authorization, X-HOT-CLUB-HTTP, x-product-id) NO se
//    inventan ni se guardan: se leen de una request que la propia página hace, y se
//    usan dentro del navegador. El JWT del embed dura ~24 h y el token del master
//    ~500 s, así que este plan guarda el HASH de cada lección y nunca una URL firmada:
//    un plan con URLs firmadas nace vencido.
//
//   node <abs>\scripts\hotmart-plan.mjs --producto 3350123 --slug creator-area \
//        --autor "NXTGEN Academia"

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', 9333));
const PRODUCTO = arg('producto', '');
const SLUG = arg('slug', '');
const AUTOR = arg('autor', '');
const RAIZ = arg('raiz', 'C:\\cursos');
const SEG = Number(arg('segundos', 16));

if (!PRODUCTO || !SLUG) {
  console.error('\n  ✖ Faltan --producto <id> y --slug <slug-del-club>\n');
  process.exit(1);
}

const slugDe = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);
const limpio = (s) => String(s).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 110) || 'sin-titulo';

// ── CDP mínimo ───────────────────────────────────────────────────────────────
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const club = tabs.find((t) => t.type === 'page' && new RegExp(`club/${SLUG}`, 'i').test(t.url));
if (!club) {
  console.error(`\n  ✖ No hay una pestaña abierta en el club «${SLUG}».`);
  console.error('    Abrila en el Chrome dedicado (Hotmart → Mis compras → Acceder al contenido).\n');
  process.exit(1);
}
const sock = new WebSocket(club.webSocketDebuggerUrl);
await new Promise((res, rej) => { sock.onopen = res; sock.onerror = () => rej(new Error('no pude conectar a CDP')); });
let id = 0; const pend = new Map(); const headersVistos = [];
sock.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); return; }
  if (d.method === 'Network.requestWillBeSent' && /\/v1\/navigation/.test(d.params.request.url)) headersVistos.push(d.params.request.headers);
};
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;

console.log(`\n  Club   : ${SLUG}  ·  producto ${PRODUCTO}`);
console.log(`  Leyendo los headers de la app (${SEG}s)…`);
await cmd('Network.enable');
await cmd('Page.reload', { ignoreCache: true });
await new Promise((r) => setTimeout(r, SEG * 1000));

if (!headersVistos.length) {
  console.error('\n  ✖ No capturé la llamada a /v1/navigation.');
  console.error('    Probá con --segundos 30, o recargá la pestaña a mano y reintentá.\n');
  process.exit(1);
}
// Solo los headers que autentican; el resto los pone el navegador.
const H = Object.fromEntries(Object.entries(headersVistos[0]).filter(([k]) => /^(authorization|x-hot-club-http|x-product-id)$/i.test(k)));
console.log(`  Headers de la app: ${Object.keys(H).join(', ')}`);

const GW = 'https://api-club-course-consumption-gateway-ga.cb.hotmart.com';
const pedir = async (ruta) => ev(`(async () => {
  const r = await fetch(${JSON.stringify(GW)} + ${JSON.stringify(ruta)}, { headers: ${JSON.stringify(H)}, credentials: 'include' });
  if (!r.ok) return { __error: r.status };
  return await r.json();
})()`);

const nav = await pedir('/v1/navigation');
if (!nav || nav.__error || !Array.isArray(nav.modules)) {
  console.error(`\n  ✖ /v1/navigation devolvió ${nav?.__error ?? 'algo inesperado'}\n`);
  process.exit(1);
}

// El título sale de la API si está; si no, del flag. Nunca del slug a secas: el slug
// del club es interno («creator-area») y no es como se llama el curso («CREATOR CLUB»),
// así que caer a él deja mal el nombre de la carpeta en Drive y el del portal.
const basic = await pedir('/v2/product/basic');
const cursoTitulo = arg('titulo', '') || basic?.name || basic?.title || basic?.productName || SLUG;
if (cursoTitulo === SLUG) console.log('  ⚠ No pude leer el nombre del curso: usá --titulo "<Nombre>".');
console.log(`  Curso  : ${cursoTitulo}`);
console.log(`  Módulos: ${nav.modules.length}`);

// ── Recorrer lecciones ───────────────────────────────────────────────────────
const crudas = [];
for (const [i, m] of nav.modules.entries()) {
  for (const [j, p] of (m.pages ?? []).entries()) {
    crudas.push({ modOrden: i + 1, modNombre: m.name ?? m.title ?? `Módulo ${i + 1}`, orden: j + 1, page: p });
  }
}
console.log(`  Lecciones: ${crudas.length}\n`);

const clases = [];
const sinVideo = [];
const ancho = String(crudas.length).length;
for (const [k, c] of crudas.entries()) {
  const n = k + 1;
  const p = c.page;
  // Solo se consulta el detalle de lo que declara tener video: ahorra 1 request por
  // cada PDF/enlace, y son varios.
  let media = null;
  if (p.hasPlayerMedia) {
    const det = await pedir(`/v1/lesson/${p.hash}`);
    media = (det?.mediasSrc ?? []).find((x) => x.mediaType === 'VIDEO') ?? null;
  }
  const s = Number(media?.mediaDurationInSeconds ?? p.mediaDurationInSeconds ?? 0);
  if (!media) sinVideo.push(`${p.name} (${p.type ?? 'sin tipo'})`);
  clases.push({
    n,
    titulo: String(p.name ?? `Clase ${n}`).trim(),
    duracion: s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '',
    segundos: s,
    modulo: `${c.modOrden}. ${c.modNombre}`,
    submodulo: null,
    plataforma: 'hotmart',
    // El HASH, nunca una URL firmada: el JWT del embed dura ~24 h y el token del
    // master ~500 s. Un plan con URLs adentro nace vencido.
    hash: p.hash,
    mediaCode: media?.mediaCode ?? null,
    videoId: media?.mediaCode ?? null,
    sinFuente: !media,
    bytesEsperados: Number(media?.mediaSize ?? 0) || null,
    archivo: `${String(n).padStart(ancho, '0')} - ${limpio(p.name)}`,
  });
  process.stdout.write(`\r  resolviendo… ${n}/${crudas.length}`);
}
process.stdout.write('\n');

const horas = clases.reduce((t, c) => t + c.segundos, 0) / 3600;
const slug = slugDe(cursoTitulo);
const base = join(RAIZ, slug);
mkdirSync(base, { recursive: true });
const salida = join(base, existsSync(join(base, 'plan.json')) ? 'plan.nuevo.json' : 'plan.json');

writeFileSync(salida, JSON.stringify({
  curso: cursoTitulo,
  autor: AUTOR,
  slug,
  fuente: 'hotmart:club',
  club: { slug: SLUG, producto: PRODUCTO },
  // El Referer que exige el embed. Es lo mismo que la restricción por dominio de
  // Vimeo en cursoselite: sin él, el embed responde 401.
  referer: 'https://hotmart.com/',
  pagina: club.url,
  clases,
}, null, 2), 'utf8');

console.log(`\n  Curso   : ${cursoTitulo}`);
console.log(`  Clases  : ${clases.length}  (${clases.filter((c) => !c.sinFuente).length} con video)`);
console.log(`  Duración: ${horas.toFixed(1)} h`);
console.log(`  → ${salida}`);
if (sinVideo.length) {
  console.log(`\n  ${sinVideo.length} sin video (no son clases de video):`);
  for (const x of sinVideo.slice(0, 8)) console.log(`     · ${x.slice(0, 70)}`);
}
if (!AUTOR) console.log('\n  ⚠ SIN AUTOR: la convención en Drive es «<Curso> - <Autor>».');
if (salida.endsWith('plan.nuevo.json')) console.log('\n  ⚠ Ya había un plan.json: lo dejé como plan.nuevo.json.');
sock.close();
