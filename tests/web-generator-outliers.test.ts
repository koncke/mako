// =============================================================================
// Web Generator — la portada de outliers de landings (11/11/2026)
// =============================================================================
// Martín (por el Cerebro): «lo mismo que venimos haciendo con el resto de tabs, de outliers… empezar por la competencia… por las
// páginas de todos los gurús». Lo que se fija:
//   1. las reglas puras (lib/landing-outliers.ts): link en la bio afuera, sin parámetros de campaña, Spy primero y sin repetir;
//   2. la imagen de una página de Spy es su `og:image` (https, absoluta), por el pedido con barandas (lib/landing-fetch.ts);
//   3. el relevo: cada landing es https, con id único, titular, por qué, tipo conocido, en neutro (tú) y CON su captura en public/;
//   4. la portada copia la de Video: el encabezado, «+ Seguir cuentas», «Crear desde cero» al Panel, «Replicar» a Replicar con
//      esa página, las clases de Image y Video, y lo que dice cuando una fuente se cae.
//
// Correr: node --import tsx --test tests/web-generator-outliers.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NOMBRE_TIPO, RELEVO, RELEVO_LANDINGS, cabeceraDePagina, esLinkEnBio, hostDeLanding, imagenDelRelevo, ogImagenDe, unirOutliers, urlLimpia, type OutlierLanding,
} from '../lib/landing-outliers';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const una = (id: string, url: string, fuente: OutlierLanding['fuente']): OutlierLanding => ({
  id, fuente, url, titulo: 't', quien: { nombre: 'x', nicho: null }, tipo: 'sitio', porque: null, imagen: null, idioma: 'es',
});

test('1. las reglas: link en la bio afuera, sin parámetros de campaña, Spy primero y sin repetir', () => {
  // Medido el 11/11/2026 en producción: 4 de los 9 competidores con landing en Spy apuntan a esto.
  for (const u of ['https://beacons.page/denborg', 'https://linktw.in/pywydg', 'https://www.bastidafarina.com/linktree-bf/', 'https://linktr.ee/x']) {
    assert.equal(esLinkEnBio(u), true, u);
  }
  for (const u of ['https://www.acquisition.com/', 'https://julioiero.com/', 'https://tittogalvez.online']) assert.equal(esLinkEnBio(u), false, u);
  assert.equal(urlLimpia('https://lp.acquisition.com/leila-frameworks?el=ig&htrafficsource=instagram&utm_source=instagram#x'), 'https://lp.acquisition.com/leila-frameworks');
  assert.equal(hostDeLanding('https://www.acquisition.com/books'), 'acquisition.com');
  const u = unirOutliers([una('spy:1', 'https://www.acquisition.com/?utm_source=ig', 'spy')], [una('relevo:a', 'https://www.acquisition.com', 'relevo'), una('relevo:b', 'https://b.test', 'relevo')]);
  assert.deepEqual(u.map((x) => x.id), ['spy:1', 'relevo:b'], 'la de tu competencia primero; la misma página del relevo no se repite');
});

test('2. la imagen de una página de Spy: su og:image, absoluta y https, por el pedido con barandas', async () => {
  const src = sinComentarios(leer('lib/landing-outliers-servidor.ts'));
  assert.match(src, /import \{ htmlDePagina \} from '\.\/landing-fetch';/, 'la URL la escribió una persona: el pedido con las barandas de SSRF');
  assert.match(src, /\.filter\(\(f\) => f\.landing_url && \/\^https\?:\\\/\\\/\/i\.test\(f\.landing_url\) && !esLinkEnBio\(f\.landing_url\)\)/);
  assert.match(src, /new Promise<Cabecera>\(\(r\) => setTimeout\(\(\) => r\(SIN_CABECERA\), PLAZO_IMAGEN_MS\)\)/, 'una página lenta no frena la portada');
  assert.match(src, /titulo: c\.titulo \?\? hostDeLanding\(url\)/, 'el titular de la página, no su dominio (11/11: la tarjeta decía «lp.acquisition.com»)');
  assert.equal(ogImagenDe('<meta property="og:image" content="/img/og.png">', 'https://x.test/a'), 'https://x.test/img/og.png');
  assert.equal(ogImagenDe('<meta content="https://cdn.x.test/o.jpg?a=1&amp;b=2" property="og:image">', 'https://x.test'), 'https://cdn.x.test/o.jpg?a=1&b=2', 'en cualquier orden');
  assert.equal(ogImagenDe('<meta name="twitter:image" content="https://cdn.x.test/t.jpg">', 'https://x.test'), 'https://cdn.x.test/t.jpg');
  assert.equal(ogImagenDe('<meta property="og:image" content="http://x.test/o.jpg">', 'https://x.test'), null, 'sólo https');
  assert.equal(ogImagenDe('<title>sin imagen</title>', 'https://x.test'), null);
});

test('3. el relevo: cada landing con su captura, su titular, por qué funciona y en neutro', () => {
  assert.ok(RELEVO.length >= 15, `el relevo tiene ${RELEVO.length}: el pedido es un relevo de verdad`);
  const ids = new Set<string>();
  for (const r of RELEVO) {
    assert.match(r.id, /^[a-z0-9-]{3,40}$/, r.id);
    assert.ok(!ids.has(r.id), `id repetido: ${r.id}`);
    ids.add(r.id);
    assert.match(r.url, /^https:\/\//, `${r.id}: https`);
    assert.equal(esLinkEnBio(r.url), false, `${r.id}: no es una landing`);
    assert.ok(r.titulo.trim().length >= 4, `${r.id}: titular`);
    assert.ok((r.porque ?? '').trim().length >= 20, `${r.id}: por qué funciona`);
    assert.doesNotMatch(r.porque ?? '', /\b(tenés|querés|podés|sos|vos)\b/i, `${r.id}: español neutro (tú)`);
    assert.ok(r.tipo in NOMBRE_TIPO, `${r.id}: tipo`);
    assert.ok(existsSync(join(RAIZ, 'public', imagenDelRelevo(r.id))), `${r.id}: falta la captura (node --import tsx scripts/capturas-outliers-landings.mjs)`);
  }
  assert.equal(RELEVO_LANDINGS.length, RELEVO.length);
  assert.ok(RELEVO_LANDINGS.every((x) => x.fuente === 'relevo' && x.id.startsWith('relevo:') && x.imagen?.startsWith('/web-generator/outliers/')));
  const doc = leer('docs/web-generator/outliers-landings.md');
  for (const r of RELEVO) assert.ok(doc.includes(r.url), `${r.id}: falta en docs/web-generator/outliers-landings.md`);
});

test('4. la portada copia la de Video: encabezado, botones, tarjeta y lo que dice si una fuente se cae', () => {
  const p = sinComentarios(leer('app/web-generator/OutliersLandings.tsx'));
  assert.match(p, /<h1>Encuentra tu siguiente <mark>OUTLIER<\/mark><\/h1>/);
  assert.match(p, /import s from '@\/app\/image-editor\/carruseles\/explorar\.module\.css';/, 'las clases de Image: una portada, un diseño');
  assert.match(p, /import o from '@\/app\/video-editor\/outliers\.module\.css';/, 'y las de Video');
  assert.match(p, /<Link href="\/competitor-spy" className=\{s\.pastilla\}>\+ Seguir cuentas<\/Link>/);
  assert.match(p, /export const RUTA_CREAR_LANDING = '\/web-generator\?panel=1';/);
  assert.match(p, /export const rutaReplicarLanding = \(url: string\): string => `\/web-generator\?replicar=\$\{encodeURIComponent\(url\)\}`;/,
    'el mismo link que «Copiar su sitio» de Spy: Replicar arrancando con esa página');
  assert.match(p, /\{!telefono && <Link href=\{rutaReplicarLanding\(x\.url\)\} className=\{o\.replicar\}>Replicar<\/Link>\}/);
  assert.match(p, /<a href=\{x\.url\} target="_blank" rel="noopener noreferrer" className=\{s\.pastilla\}>Ver el original<\/a>/);
  assert.match(p, /<span>No pude leer \{c\.nombre\}: \{c\.motivo\}<\/span>\s*<ReportarASoporte \/>/, '«no pude leer» no es «no hay»');
  assert.match(p, /className=\{`\$\{s\.miniImagen\} \$\{x\.fuente === 'relevo' \? l\.arriba : l\.entera\}`\}/,
    'la captura del relevo desde arriba; la imagen para compartir de Spy entera (el logo cuadrado de acquisition.com salía cortado)');
  assert.match(p, /<span className=\{l\.pagina\} aria-hidden>[\s\S]*<b className=\{l\.titular\}>\{x\.titulo\}<\/b>/, 'sin imagen: la página con SU titular');
  const css = leer('app/web-generator/outliers-landings.module.css');
  assert.match(css, /\.mini \{ aspect-ratio: 16 \/ 10;/);
  assert.match(css, /\.entera \{ object-fit: contain;/);
  assert.match(css, /\.pagina \{[^}]*background: var\(--surface\);/);
  assert.doesNotMatch(css, /var\(--primary-bg\)/, '--primary-bg es un gris en el tema por defecto: el «cuadro gris» del 11/11');
});

test('5. lo que la página dice de sí misma: su titular y su bajada, en texto plano', () => {
  // lp.acquisition.com, medido el 11/11/2026: sin og:image, con og:title y og:description (el content ANTES del property).
  const html = '<title>No</title><meta content="Acquisition.com Scaling Workshop · 2 Days · In Person · Las Vegas" property="og:title"/>'
    + '<meta content="Most founders think they have a hundred problems. They usually have one: the single constraint capping their growth." property="og:description"/>';
  assert.deepEqual(cabeceraDePagina(html), {
    titulo: 'Acquisition.com Scaling Workshop · 2 Days · In Person · Las Vegas',
    bajada: 'Most founders think they have a hundred problems. They usually have one: the single constraint capping their growth.',
  });
  assert.deepEqual(cabeceraDePagina('<title>\n  Clase &amp; m&aacute;s &#8212; gratis\n</title><meta name="description" content="It\'s free">'),
    { titulo: 'Clase & m&aacute;s — gratis', bajada: "It's free" }, 'sin og: el <title>; las entidades conocidas se decodifican y las otras quedan');
  assert.deepEqual(cabeceraDePagina('<p>nada</p>'), { titulo: null, bajada: null });
  assert.equal(cabeceraDePagina(`<meta property="og:title" content="${'x'.repeat(300)}">`).titulo?.length, 140, 'con tope');
});

test('6. en el teléfono, la portada primero (como Video); la lista con ?ver=lista, y una landing vuelve a la lista', () => {
  const m = sinComentarios(leer('app/m/landing/page.tsx'));
  assert.match(m, /<OutliersLandings portada=\{await leerOutliersLandings\(\)\} telefono rutaCrear=\{RUTA_LISTA_M\} \/>/);
  assert.match(m, /const RUTA_LISTA_M = '\/m\/landing\?ver=lista';/);
  assert.match(leer('app/m/landing/[id]/page.tsx'), /const VOLVER = \{ rotulo: 'Volver a las landings', href: '\/m\/landing\?ver=lista' \};/);
  assert.match(sinComentarios(leer('app/web-generator/OutliersLandings.tsx')), /<Link href=\{rutaCrear\} className=\{s\.crear\}>/);
});
