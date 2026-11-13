// =============================================================================
// Web Generator — la portada de outliers de landings (11/11/2026)
// =============================================================================
// Martín (por el Cerebro): «lo mismo que venimos haciendo con el resto de tabs, de outliers… empezar por la competencia… por las
// páginas de todos los gurús». Y a la noche, con la captura: «¿Dónde está el chat de MaKo para ir a trabajar las páginas
// anteriores…? Además de los outliers, también deberían estar los templates. La tarjeta de una web tiene que ser mucho más grande,
// y si paso el cursor por arriba poder scrollearla, sin romper la eficiencia de la página. Me parece muy poco 22 páginas». Se fija:
//   1. las reglas puras (lib/landing-outliers.ts): link en la bio afuera, sin parámetros de campaña, Spy primero y sin repetir;
//   2. una landing de Spy entra SÓLO con su captura larga, y la portada no pide ninguna página afuera en cada visita;
//   3. las capturas largas: cada una existe en public/, con id único, https, titular, por qué en neutro y tipo conocido;
//   4. la portada copia la de Video: el encabezado, «+ Seguir cuentas», «Crear desde cero» al Panel, «Replicar» a Replicar con
//      esa página, las clases de Image y Video, y lo que dice cuando una fuente se cae;
//   5. la tarjeta grande que se scrollea al pasar el cursor, con la imagen que carga recién al acercarse a la pantalla;
//   6. el teléfono: la portada primero, de a una, y «Tus landings»;
//   7. el armazón de Create: el chat de MaKo a la izquierda, tus landings a un toque y las plantillas al lado de los outliers.
//
// Correr: node --import tsx --test tests/web-generator-outliers.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOMBRE_TIPO, esLinkEnBio, hostDeLanding, unirOutliers, urlLimpia, type OutlierLanding } from '../lib/landing-outliers';
import { CAPTURAS, RELEVO_LANDINGS, capturaDe, imagenLarga } from '../lib/landing-outliers-datos';

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
  // En Spy viralidad.com está como «http://www.…» y su captura como «https://…»: la misma página (11/11/2026).
  assert.deepEqual(unirOutliers([una('spy:2', 'http://www.viralidad.com/', 'spy')], [una('relevo:v', 'https://viralidad.com', 'relevo')]).map((x) => x.id), ['spy:2']);
});

test('2. una landing de Spy entra sólo con su captura larga, y la portada no pide páginas afuera en cada visita', () => {
  const src = sinComentarios(leer('lib/landing-outliers-servidor.ts'));
  assert.match(src, /\.filter\(\(f\) => f\.landing_url && \/\^https\?:\\\/\\\/\/i\.test\(f\.landing_url\) && !esLinkEnBio\(f\.landing_url\)\)/);
  assert.match(src, /const c = capturaDe\(url\);\s*if \(!c\) \{ sinCaptura\+\+; continue; \}/, 'sin captura no entra («viralidad.com, un recuadro negro con un logo»)');
  assert.doesNotMatch(src, /htmlDePagina|og:image|unstable_cache/, 'ya no se baja ninguna página en cada visita');
  // capturaDe encuentra la página aunque el link traiga parámetros de campaña o la barra final.
  const c = CAPTURAS[0];
  if (c) {
    assert.equal(capturaDe(`${c.url.replace(/\/$/, '')}/?utm_source=ig`)?.id ?? capturaDe(`${c.url}?utm_source=ig`)?.id, c.id);
  }
  assert.equal(capturaDe('https://no-existe.test/x'), null);
  const p = sinComentarios(leer('app/web-generator/OutliersLandings.tsx'));
  // 13/11/2026: sin la frase de totales («N páginas que venden · … esperan su captura»): texto que explica la pantalla (Martín, 12/11).
  assert.doesNotMatch(p, /esperan su captura|páginas que venden|de tu competencia primero/, 'sin la frase que explica');
  // Y la tarjeta nunca gris vacía: el color de su tipo y el dominio, debajo de la captura mientras carga.
  assert.match(p, /<span className=\{l\.espera\} data-tipo=\{x\.tipo\} aria-hidden><b>\{hostDeLanding\(x\.url\)\}<\/b><\/span>/);
});

test('3. las capturas largas: cada una en public/, con id único, https, titular, por qué en neutro y tipo conocido', () => {
  assert.ok(CAPTURAS.length >= 40, `hay ${CAPTURAS.length}: Martín pidió «muchas más que 22»`);
  const ids = new Set<string>();
  for (const c of CAPTURAS) {
    assert.match(c.id, /^[a-z0-9-]{3,48}$/, c.id);
    assert.ok(!ids.has(c.id), `id repetido: ${c.id}`);
    ids.add(c.id);
    assert.match(c.url, /^https:\/\//, `${c.id}: https`);
    assert.equal(esLinkEnBio(c.url), false, `${c.id}: no es una landing`);
    assert.ok(c.titulo.trim().length >= 4, `${c.id}: titular`);
    assert.ok(c.porque.trim().length >= 20, `${c.id}: por qué funciona`);
    assert.doesNotMatch(c.porque, /\b(tenés|querés|podés|sos|vos)\b/i, `${c.id}: español neutro (tú)`);
    assert.ok(c.tipo in NOMBRE_TIPO, `${c.id}: tipo`);
    assert.ok(c.alto > 400, `${c.id}: una captura LARGA (alto ${c.alto})`);
    assert.ok(existsSync(join(RAIZ, 'public', imagenLarga(c.id))), `${c.id}: falta public${imagenLarga(c.id)}`);
  }
  assert.equal(RELEVO_LANDINGS.length, CAPTURAS.length);
  assert.ok(RELEVO_LANDINGS.every((x) => x.imagen?.startsWith('/web-generator/outliers/largas/') && (x.alto ?? 0) > 0));
  const primeraEn = RELEVO_LANDINGS.findIndex((x) => x.idioma === 'en');
  assert.ok(primeraEn < 0 || RELEVO_LANDINGS.slice(primeraEn).every((x) => x.idioma === 'en'), 'en español primero');
  // Las carpetas de public/ que no pasan por el proxy (tests/proxy-matcher-completo.test.ts): las capturas son públicas.
  assert.match(leer('proxy.ts'), /web-generator\/outliers/);
  // El manifiesto no viaja en el JavaScript de la portada: lo liviano (lo que importa la pantalla) no lo importa.
  assert.doesNotMatch(leer('lib/landing-outliers.ts'), /landing-outliers-capturas\.json/);
  assert.doesNotMatch(sinComentarios(leer('app/web-generator/OutliersLandings.tsx')) + sinComentarios(leer('app/web-generator/portada-reglas.ts')), /landing-outliers-datos/);
});

test('4. la portada copia la de Video: encabezado, botones, tarjeta y lo que dice si una fuente se cae', () => {
  const p = sinComentarios(leer('app/web-generator/OutliersLandings.tsx'));
  assert.match(p, /<h1>Encuentra tu siguiente <mark>OUTLIER<\/mark><\/h1>/);
  assert.match(p, /import s from '@\/app\/image-editor\/carruseles\/explorar\.module\.css';/, 'las clases de Image: una portada, un diseño');
  assert.match(p, /import o from '@\/app\/video-editor\/outliers\.module\.css';/, 'y las de Video');
  assert.match(p, /<Link href="\/competitor-spy" className=\{s\.pastilla\}>\+ Seguir cuentas<\/Link>/);
  const r = leer('app/web-generator/portada-reglas.ts');
  assert.match(r, /export const RUTA_PANEL = '\/web-generator\?panel=1';/);
  // 12/11/2026 (el Cerebro): de un outlier sale la ADAPTADA, directo (`&adaptar=1`); «Copiar su sitio» de Spy sigue sin él.
  assert.match(r, /export const rutaReplicarLanding = \(url: string\): string => `\/web-generator\?replicar=\$\{encodeURIComponent\(url\)\}&adaptar=1`;/,
    'Replicar arrancando con esa página, adaptada al negocio');
  assert.match(p, /\{!telefono && <Link href=\{rutaReplicarLanding\(x\.url\)\} className=\{o\.replicar\}>Replicar<\/Link>\}/);
  assert.match(p, /<a href=\{x\.url\} target="_blank" rel="noopener noreferrer" className=\{s\.pastilla\}>Ver el original<\/a>/);
  assert.match(p, /<span>No pude leer \{c\.nombre\}: \{c\.motivo\}<\/span>\s*<ReportarASoporte \/>/, '«no pude leer» no es «no hay»');
});

test('5. la tarjeta grande que se scrollea al pasar el cursor, sin romper la eficiencia', async () => {
  const p = sinComentarios(leer('app/web-generator/OutliersLandings.tsx'));
  assert.match(p, /<img src=\{x\.imagen\} alt="" className=\{l\.larga\} width=\{640\} height=\{x\.alto \?\? undefined\} loading="lazy" decoding="async" onError=\{\(\) => setRota\(true\)\} \/>/,
    'la captura larga carga recién cuando la tarjeta se acerca a la pantalla');
  const css = leer('app/web-generator/outliers-landings.module.css');
  assert.match(css, /\.grilla \{ grid-template-columns: repeat\(auto-fill, minmax\(420px, 1fr\)\);/, 'mucho más grande: 420px como mínimo');
  assert.match(css, /\.mini \{ aspect-ratio: 3 \/ 4; display: block; container-type: size;/);
  assert.match(css, /\.mini:hover \.larga, \.mini:focus-visible \.larga \{\s*transform: translateY\(min\(0px, calc\(-100% \+ 100cqh\)\)\);\s*transition: transform var\(--dur, 8s\) linear;/,
    'al pasar el cursor baja con un transform (no vuelve a dibujar la página)');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.larga, \.mini:hover \.larga, \.mini:focus-visible \.larga \{ transition: none; transform: none; \} \}/);
  const { duracionDelScroll } = await import('../app/web-generator/portada-reglas');
  assert.equal(duracionDelScroll(700), 4, 'una corta no pasa volando');
  assert.equal(duracionDelScroll(4500), 6);
  assert.equal(duracionDelScroll(40_000), 16, 'una larga no aburre');
});

test('6. en el teléfono, la portada primero (como Video); la lista con ?ver=lista, y una landing vuelve a la lista', () => {
  const m = sinComentarios(leer('app/m/landing/page.tsx'));
  assert.match(m, /<OutliersLandings portada=\{await leerOutliersLandings\(\)\} telefono rutaCrear=\{RUTA_LISTA_M\} \/>/);
  assert.match(m, /const RUTA_LISTA_M = '\/m\/landing\?ver=lista';/);
  assert.match(leer('app/m/landing/[id]/page.tsx'), /const VOLVER = \{ rotulo: 'Volver a las landings', href: '\/m\/landing\?ver=lista' \};/);
  const p = sinComentarios(leer('app/web-generator/OutliersLandings.tsx'));
  // 12/11/2026: crear es el botón principal de la portada («＋ Nueva landing»), que va sin el chat.
  assert.match(p, /<Link href=\{rutaCrear\} className=\{telefono \? s\.pastilla : s\.nuevo\}>\{telefono \? 'Tus landings' : <><span aria-hidden>＋<\/span> Nueva landing<\/>\}<\/Link>/,
    'en el teléfono no se crea: el botón lleva a tus landings y lo dice');
  // Mirado en producción el 11/11/2026: en dos columnas una página apaisada medía 180px. De a una, con la grilla ancha de Image.
  assert.match(p, /<ul className=\{`\$\{s\.grilla\} \$\{l\.grilla\}\$\{telefono \? ` \$\{s\.grillaAncha\}` : ''\}`\}>/);
  assert.match(leer('app/image-editor/carruseles/explorar.module.css'), /\.raiz\[data-telefono='si'\] \.grillaAncha \{ grid-template-columns: minmax\(0, 1fr\);/);
});

test('7. el armazón de Create: el chat de MaKo a la izquierda, tus landings a un toque y las plantillas al lado de los outliers', async () => {
  const pag = sinComentarios(leer('app/web-generator/page.tsx'));
  assert.match(pag, /<PortadaWeb docs=\{rDocs\.ok \? rDocs\.docs : \[\]\} errorLista=\{rDocs\.ok \? null : rDocs\.error\}>\s*<OutliersLandings portada=\{portada\} plantillas=\{<PlantillasPortada \/>\} \/>\s*<\/PortadaWeb>/,
    'la portada va ADENTRO del armazón de Create, con las plantillas');
  const w = sinComentarios(leer('app/web-generator/PortadaWeb.tsx'));
  assert.match(w, /import \{ PantallaCrear \} from '@\/app\/_crear\/PantallaCrear';/, 'el MISMO armazón de las otras tabs, no uno propio');
  assert.match(w, /<PantallaCrear\s+tab="Web Generator"\s+nuevo="Nueva landing"\s+proyectos=\{proyectos\}/);
  assert.match(w, /alNuevo=\{\(\) => router\.push\(RUTA_PANEL\)\}/, '«Nueva landing» lleva al Panel, con sus modos y todas las plantillas');
  const { proyectosDeLandings } = await import('../app/web-generator/portada-reglas');
  const d = (id: number, actualizado: string, papelera = false) => ({ id, titulo: `L${id}`, actualizado, papelera }) as never;
  assert.deepEqual(proyectosDeLandings([d(1, '2026-11-01T00:00:00Z'), d(2, '2026-11-10T00:00:00Z'), d(3, '2026-11-11T00:00:00Z', true)]).map((p) => `${p.id}:${p.href}`),
    ['2:/web-generator/2', '1:/web-generator/1'], 'la última tocada primero, sin la papelera, cada una abre su editor');
  const pl = sinComentarios(leer('app/web-generator/PlantillasPortada.tsx'));
  assert.match(pl, /const DISENOS = plantillasDe\('landing'\);/, 'los MISMOS diseños de la galería del Panel');
  assert.match(pl, /<Link href=\{rutaDiseno\(p\.id\)\}/);
  const { rutaDiseno } = await import('../app/web-generator/portada-reglas');
  assert.equal(rutaDiseno('mako'), '/web-generator?vista=plantillas&diseno=mako');
  const ini = sinComentarios(leer('app/web-generator/Inicio.tsx'));
  assert.match(ini, /const d = props\.disenoInicial \? plantillasDe\('landing'\)\.find\(\(p\) => p\.id === props\.disenoInicial\) : null;\s*return d \? \{ tipo: 'diseno', plantilla: d \} : null;/,
    'el Panel abre con la pregunta del objetivo de ese diseño: el mismo paso que tocarlo en la galería');
  assert.match(pag, /disenoInicial=\{typeof sp\.diseno === 'string' \? sp\.diseno\.slice\(0, 40\) : null\}/);
});

test('8. buscar: por titular, marca, nicho o dominio, sin acentos; por tipo; y un link pegado se ofrece para replicar', async () => {
  const { filtrarOutliers, linkEscrito } = await import('../app/web-generator/portada-reglas');
  const x = (id: string, titulo: string, nombre: string, nicho: string, tipo: OutlierLanding['tipo'], url: string): OutlierLanding => ({
    id, fuente: 'relevo', url, titulo, quien: { nombre, nicho }, tipo, porque: null, imagen: null, idioma: 'es',
  });
  const lista = [
    x('a', 'Haz videos que sí venden', 'Juan Lombana (Mercatitlán)', 'Video con IA', 'webinar', 'https://ia.mercatitlan.com/registro'),
    x('b', 'Genera una nueva línea de ingresos', 'Programa Momentum', 'Eventos presenciales', 'vsl', 'https://programa.formacionmomentum.com/video'),
  ];
  assert.deepEqual(filtrarOutliers(lista, 'mercatitlan', null).map((y) => y.id), ['a'], 'sin acentos ni mayúsculas');
  assert.deepEqual(filtrarOutliers(lista, 'formacionmomentum', null).map((y) => y.id), ['b'], 'por el dominio');
  assert.deepEqual(filtrarOutliers(lista, 'video ia', null).map((y) => y.id), ['a'], 'todas las palabras');
  assert.deepEqual(filtrarOutliers(lista, '', 'vsl').map((y) => y.id), ['b'], 'por tipo');
  assert.equal(filtrarOutliers(lista, '', null).length, 2);
  assert.equal(linkEscrito('clase.highticketclarity.com'), 'https://clase.highticketclarity.com/');
  assert.equal(linkEscrito('https://www.acquisition.com/books'), 'https://www.acquisition.com/books');
  assert.equal(linkEscrito('coaches high ticket'), null, 'una búsqueda no es un link');
  const p = sinComentarios(leer('app/web-generator/OutliersLandings.tsx'));
  assert.match(p, /<Link href=\{rutaReplicarLanding\(link\)\} className=\{o\.replicar\}>Replicar esta página<\/Link>/);
});
