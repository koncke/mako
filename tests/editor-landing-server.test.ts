// =============================================================================
// editor-landing-server — las decisiones del server del editor de landings (paquete D)
// =============================================================================
// Ejecuta lib/editor-landing/server-reglas.ts (puro: slug y sugerencia, versión automática, guarda
// de borrar, URLs que se miden, subidas, magic bytes, la foto publicada, temas propios) y lee como
// TEXTO lo que no se puede ejecutar sin base ni sesión: la migración 0246, los tres registros del
// inquilino y los dos lugares de server.ts donde un compare-and-set es lo único que protege. Todo lo
// que lee fuente normaliza CRLF y pregunta sobre el texto SIN comentarios (AGENTS.md).
//
// PROBADO ROMPIÉNDOLO (11/10/2026): 19 roturas, una por vez sobre el archivo real, restaurado desde
// la copia en memoria y verificado por hash. Con todo en su lugar: 25 pass / 0 fail. Las 18 primeras
// se corrieron con 24 tests (dieron 23 / 1) y la última con 25 (dio 24 / 1); en todas cayó SU test.
// Tanda 4 (14/10/2026, hola-mako.site), base 25 / 0, con el arnés de editor-landing-origen:
// `prefiltroVisitas` con `%/l/…%` (deja afuera hola-mako.site) → 24 / 1 «analítica: las URLs medidas…»;
// `urlsAMedir` con una sola base → 24 / 1 (el mismo). Las de 11/10:
//   · `tocaVersionAutomatica` con `>` en vez de `>=`              → versión automática (los 10 min justos)
//   · `puedeBorrarse` en NEGATIVO (`papelera_at !== null`)        → borrar: SÓLO lo de la papelera
//   · el `delete` de `borrar` sin `.not('papelera_at', …)`        → borrar: lo exige EN LA CONSULTA
//   · `candidatosSlug` recortando a 60 y no a 57                  → slug (los títulos largos se quedaban sin sugerencia)
//   · `cambiosSinPublicar` sin mirar `publicado_at`               → «cambios sin publicar»
//   · `paginasParaPublicar` sin sacar las secciones ocultas      → la foto
//   · `esUrlMedida` por prefijo en vez de igualdad (`/l/oferta-2`) → analítica: las URLs medidas
//   · `visitasPorDia` por día UTC                                 → analítica: día LOCAL
//   · `mezclarConfig` superficial                                 → la config en profundidad
//   · `subidaDelWs` sin comparar el workspace                     → subidas: la ruta es del workspace
//   · `sniffMedia` aceptando MOV                                  → magic bytes
//   · `leerFoto` sin exigir la config congelada                   → la foto guardada
//   · `sanearTemasPropios` sin deduplicar                         → temas propios
//   · `image/svg+xml` sumado al bucket de la 0246                 → 0246: el bucket
//   · TENANT_TABLES sin `landing_doc_comentarios`                 → el registro del inquilino
//   · `guardar` sin `.eq('version', …)` (sin compare-and-set)     → guardar y publicar exigen la versión
//   · `leerVistaPrevia` leyendo con `getTenantDb`                 → las lecturas públicas
//   · la analítica devolviendo `alcancePorSeccion: []`            → el alcance null, NUNCA 0
//   · `RUTAS_DE_L` vacío (una landing podía llamarse «vista»)     → ninguna carpeta fija de app/l es un slug

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  tocaVersionAutomatica, MINUTOS_VERSION_AUTO, puedeBorrarse, candidatosSlug, primeraLibre, motivoSlugInvalido,
  slugPedido, slugPublicable, cambiosSinPublicar, urlsAMedir, esUrlMedida, prefiltroVisitas, visitasPorDia, mezclarConfig,
  sanearTitulo, idValido, vistaTokenValido, tarjetaIdValido, validarSubida, pathDeSubida, subidaDelWs,
  archivoDeBiblioteca, EXT_DE_TIPO, sniffImagen, sniffMedia, paginasParaPublicar, metaDePagina, leerFoto,
  sanearTemasPropios, TOPE_TEMAS,
} from '../lib/editor-landing/server-reglas';
import { CONFIG_DEFAULT, TIPOS_IMAGEN, TIPOS_VIDEO, TOPE_IMAGEN_BYTES, TOPE_VIDEO_BYTES } from '../lib/editor-landing/api-tipos';
import { slugValido, tarjeta, titulo, parrafo, docPagina, type LandingContenido } from '../lib/editor-landing/doc';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';
import { urlVistaEn } from '../lib/editor-landing/origen-landings';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios de línea (primero) ni de bloque (después): un guard de «esto no está» se acusaría a sí mismo. */
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Versión automática ───────────────────────────────────────────────────────

test('versión automática: sin ninguna, o con la última de más de 10 minutos; una fecha rota cuenta como «no hay»', () => {
  const ahora = Date.parse('2026-10-11T12:00:00Z');
  const hace = (min: number) => new Date(ahora - min * 60_000).toISOString();
  assert.equal(MINUTOS_VERSION_AUTO, 10);
  assert.equal(tocaVersionAutomatica(null, ahora), true);
  assert.equal(tocaVersionAutomatica(undefined, ahora), true);
  assert.equal(tocaVersionAutomatica(hace(9), ahora), false, 'a los 9 minutos todavía no');
  assert.equal(tocaVersionAutomatica(hace(10), ahora), true, 'a los 10 sí');
  assert.equal(tocaVersionAutomatica(hace(240), ahora), true);
  assert.equal(tocaVersionAutomatica('no-es-fecha', ahora), true);
});

// ── Borrar ───────────────────────────────────────────────────────────────────

test('borrar: SÓLO lo que tiene fecha de papelera (en positivo)', () => {
  assert.equal(puedeBorrarse({ papelera_at: '2026-10-11T10:00:00Z' }), true);
  assert.equal(puedeBorrarse({ papelera_at: null }), false);
  assert.equal(puedeBorrarse({ papelera_at: undefined }), false);
  assert.equal(puedeBorrarse({ papelera_at: '' }), false);
});

test('borrar: el delete de server.ts vuelve a exigir la papelera EN LA CONSULTA (si salió en el medio, no se va)', () => {
  const src = sinComentarios(leer('lib/editor-landing/server.ts'));
  const cuerpo = src.slice(src.indexOf('export async function borrar('), src.indexOf('export async function versiones('));
  assert.ok(cuerpo.length > 200 && cuerpo.length < 2500, `el recorte de borrar mide ${cuerpo.length}`);
  assert.match(cuerpo, /if \(!puedeBorrarse\(f\)\)/);
  assert.match(cuerpo, /\.delete\(\)[\s\S]{0,120}\.not\('papelera_at', 'is', null\)/);
});

// ── Slug ─────────────────────────────────────────────────────────────────────

test('slug: los candidatos salen del texto, válidos, con sufijo, y caben en 60 aun con un título largo', () => {
  assert.deepEqual(candidatosSlug('Mi Landing Genial').slice(0, 3), ['mi-landing-genial', 'mi-landing-genial-2', 'mi-landing-genial-3']);
  const largo = candidatosSlug('Una oferta irresistible para dueños de negocio que quieren vender más este año ya');
  assert.equal(largo.length, 9);
  assert.ok(largo.every((c) => slugValido(c) && c.length <= 60), largo.join(' · '));
  assert.ok(!candidatosSlug('admin').includes('admin'), 'un reservado no se sugiere');
  assert.equal(candidatosSlug('admin')[0], 'admin-2');
  assert.equal(candidatosSlug('ab')[0], 'ab-2', 'dos letras no alcanzan: va con sufijo');
  assert.equal(candidatosSlug('')[0], 'landing');
  assert.equal(primeraLibre(['a-1', 'a-2', 'a-3'], new Set(['a-1', 'a-2'])), 'a-3');
  assert.equal(primeraLibre(['a-1'], new Set(['a-1'])), null);
  assert.equal(slugPedido('  Mi-Oferta '), 'mi-oferta');
});

test('slug: el motivo de una dirección que no se puede usar', () => {
  assert.equal(motivoSlugInvalido('mi-oferta'), null);
  assert.equal(motivoSlugInvalido('ab'), 'Muy corta');
  assert.equal(motivoSlugInvalido('a'.repeat(61)), 'Muy larga');
  assert.equal(motivoSlugInvalido('mi oferta'), 'Solo minúsculas, números y guiones');
  assert.equal(motivoSlugInvalido('api'), 'Reservada');
  assert.equal(motivoSlugInvalido('-oferta'), 'Sin guion al principio ni al final');
});

test('slug: ninguna carpeta fija de app/l puede ser el slug de una landing (taparía sus páginas)', () => {
  // app/l/vista/[token] le gana a app/l/[slug]/[ruta]: una landing con slug «vista» tendría sus
  // páginas internas leídas como tokens. Se barre la carpeta para que la próxima ruta fija nazca
  // reservada o este test lo diga.
  const fijas = readdirSync(resolve(ROOT, 'app/l')).filter((n) => !n.startsWith('[') && !n.includes('.'));
  assert.ok(fijas.includes('vista'), 'app/l/vista existe');
  for (const n of fijas) {
    assert.equal(slugPublicable(n), false, `«${n}» es una ruta de /l y no puede ser un slug`);
    assert.equal(motivoSlugInvalido(n), 'Reservada');
    assert.ok(!candidatosSlug(n).includes(n), `no se sugiere «${n}»`);
  }
  // Tanda 4: el link privado se arma con la base de las landings (`<app>/l` en local, hola-mako.site en producción).
  assert.equal(urlVistaEn('https://hola-mako.com/l/', 'A'.repeat(43)), `https://hola-mako.com/l/vista/${'A'.repeat(43)}`);
  assert.equal(urlVistaEn('https://hola-mako.site', 'A'.repeat(43), 'gracias'), `https://hola-mako.site/vista/${'A'.repeat(43)}/gracias`);
});

// ── Publicado ────────────────────────────────────────────────────────────────

test('«cambios sin publicar» compara la VERSIÓN publicada con la guardada (favorito/carpeta no la mueven)', () => {
  assert.equal(cambiosSinPublicar({ publicado_at: null, publicado_version: null, version: 4 }), false, 'sin publicar no hay «cambios que publicar»');
  assert.equal(cambiosSinPublicar({ publicado_at: '2026-10-11T10:00:00Z', publicado_version: 4, version: 4 }), false);
  assert.equal(cambiosSinPublicar({ publicado_at: '2026-10-11T10:00:00Z', publicado_version: 4, version: 5 }), true);
});

test('la foto: sin secciones ocultas, sin rutas repetidas, y siempre con una página de inicio', () => {
  const visible = tarjeta([titulo('Hola', 1)], { id: 'tvis' });
  const oculta = tarjeta([parrafo('secreto')], { id: 'toc', oculta: true });
  const c: LandingContenido = {
    v: 1,
    paginas: [
      { id: 'p1', titulo: 'Gracias', ruta: 'gracias', doc: docPagina([visible, oculta]) },
      { id: 'p2', titulo: 'Repetida', ruta: 'gracias', doc: docPagina([visible]) },
      { id: 'p3', titulo: 'Mala', ruta: 'No Vale', doc: docPagina([visible]) },
    ],
  };
  const ps = paginasParaPublicar(c);
  assert.deepEqual(ps.map((p) => p.ruta), [''], 'la repetida y la inválida no salen; la primera pasa a ser el inicio');
  assert.deepEqual(ps[0].doc.content.map((t) => t.attrs?.id), ['tvis'], 'la oculta no llega a la foto');
  const conInicio = paginasParaPublicar({ v: 1, paginas: [{ id: 'a', titulo: 'Inicio', ruta: '', doc: docPagina([visible]) }, { id: 'b', titulo: 'Gracias', ruta: 'gracias', doc: docPagina([visible]) }] });
  assert.deepEqual(conInicio.map((p) => p.ruta), ['', 'gracias']);
});

test('la foto: título y descripción de cada página (la página manda, después el sitio, después la landing)', () => {
  const sitio = { ...CONFIG_DEFAULT.sitio, seoTitulo: 'Sitio', seoDescripcion: 'Desc sitio' };
  const inicio = { id: 'a', titulo: 'Inicio', ruta: '', doc: docPagina([]) };
  assert.deepEqual(metaDePagina(inicio, sitio, 'Landing'), { titulo: 'Sitio', descripcion: 'Desc sitio' });
  assert.deepEqual(metaDePagina({ ...inicio, seoTitulo: 'Propio' }, sitio, 'Landing').titulo, 'Propio');
  assert.equal(metaDePagina(inicio, CONFIG_DEFAULT.sitio, 'Landing').titulo, 'Landing');
  assert.equal(metaDePagina({ ...inicio, ruta: 'gracias', titulo: 'Gracias' }, sitio, 'Landing').titulo, 'Gracias');
});

test('la foto guardada: se lee entera o no se sirve', () => {
  const buena = { v: 1, paginas: [{ ruta: '', titulo: 'T', descripcion: 'D', html: '<section></section>' }], css: '.gm-doc{}', fuentes: 'f', config: CONFIG_DEFAULT, version: 3, publicadoAt: '2026-10-11T10:00:00Z' };
  assert.equal(leerFoto(buena)?.paginas[0].html, '<section></section>');
  assert.equal(leerFoto(buena)?.css, '.gm-doc{}', 'la hoja congelada vuelve con la foto');
  assert.equal(leerFoto(null), null);
  assert.equal(leerFoto({ ...buena, paginas: [] }), null, 'sin páginas no hay nada que servir');
  assert.equal(leerFoto({ ...buena, paginas: [{ ruta: '' }] }), null, 'una página sin html no se sirve a medias');
  assert.equal(leerFoto({ ...buena, config: undefined }), null, 'sin la configuración congelada no hay <head> que armar');
});

// ── Analítica ────────────────────────────────────────────────────────────────

test('analítica: las URLs medidas son las publicadas, normalizadas como las normaliza el Landing Analyst', () => {
  // Tanda 4: una por página Y por base — hola-mako.site (la vigente) y hola-mako.com/l (lo medido antes).
  const urls = urlsAMedir(['https://hola-mako.site', 'https://www.hola-mako.com/l/'], 'oferta', ['', 'gracias', 'No Vale', 'gracias']);
  assert.deepEqual(urls, [
    'https://hola-mako.site/oferta', 'https://hola-mako.site/oferta/gracias',
    'https://hola-mako.com/l/oferta', 'https://hola-mako.com/l/oferta/gracias',
  ]);
  assert.deepEqual(urlsAMedir(['https://hola-mako.site'], null, ['']), []);
  const medidas = new Set(urls);
  assert.equal(esUrlMedida('https://hola-mako.site/oferta?utm_source=fb&fbclid=xyz', medidas), true, 'el Pixel guarda la URL que ve el visitante, con sus utm');
  assert.equal(esUrlMedida('https://hola-mako.com/l/oferta?utm_source=fb&fbclid=xyz', medidas), true, 'lo medido antes de la mudanza sigue siendo de la landing');
  assert.equal(esUrlMedida('https://www.hola-mako.com/l/oferta/gracias/', medidas), true);
  // El prefiltro trae CANDIDATOS que no son: la decisión es la igualdad exacta.
  assert.equal(esUrlMedida('https://hola-mako.site/oferta-2', medidas), false);
  assert.equal(esUrlMedida('https://hola-mako.com/l/ofertas', medidas), false);
  assert.equal(esUrlMedida('https://otra.com/oferta', medidas), false, 'el mismo camino en otro host no es esta landing');
  assert.equal(esUrlMedida(null, medidas), false);
  assert.equal(esUrlMedida('::no es url::', medidas), false);
  // `%/<slug>%`: trae las dos formas (con y sin `/l`); `ilike` lo compara igual que este LIKE.
  assert.equal(prefiltroVisitas('oferta'), '%/oferta%');
  assert.equal(prefiltroVisitas('a_b%'), '%/a\\_b\\%%', 'un comodín en el slug no se vuelve comodín');
  const like = (patron: string, s: string) => new RegExp('^' + patron.replace(/[.*+?^${}()|[\]]/g, '\\$&').replace(/%/g, '.*') + '$', 'i').test(s);
  for (const u of urls) assert.ok(like(prefiltroVisitas('oferta'), u), `el prefiltro deja afuera ${u}`);
});

test('analítica: visitas por DÍA LOCAL del negocio, 30 días con los vacíos en 0', () => {
  // 05:00 UTC del 11/10 son las 22:00 del 10/10 en Tijuana.
  const serie = visitasPorDia(['2026-10-11T05:00:00Z', '2026-10-11T20:00:00Z', 'basura'], '2026-10-11', 30, 'America/Tijuana');
  assert.equal(serie.length, 30);
  assert.equal(serie[29].dia, '2026-10-11');
  assert.equal(serie[0].dia, '2026-09-12');
  assert.equal(serie.find((d) => d.dia === '2026-10-10')?.visitas, 1, 'la de las 22:00 locales es del 10');
  assert.equal(serie[29].visitas, 1);
  assert.equal(serie.reduce((a, d) => a + d.visitas, 0), 2, 'la fecha rota no cuenta');
});

test('analítica: el alcance por sección se devuelve null (no medido), NUNCA 0', () => {
  const src = sinComentarios(leer('lib/editor-landing/server.ts'));
  const cuerpo = src.slice(src.indexOf('export async function analitica('), src.indexOf('export async function temasPropiosDe('));
  assert.ok(!/alcancePorSeccion:\s*\[/.test(cuerpo) && !/pct:\s*0\b/.test(cuerpo), 'no se fabrica un alcance');
  assert.equal((cuerpo.match(/alcancePorSeccion: null/g) ?? []).length, 2);
});

// ── Configuración y textos ───────────────────────────────────────────────────

test('la config se mezcla en profundidad sobre CONFIG_DEFAULT, sin tocar el default', () => {
  const antes = JSON.stringify(CONFIG_DEFAULT);
  const c = mezclarConfig({ sitio: { nombre: 'Mi negocio', nav: { mostrar: true } }, tema: 'ws:mio' });
  assert.equal(c.sitio.nombre, 'Mi negocio');
  assert.equal(c.sitio.nav.mostrar, true);
  assert.deepEqual(c.sitio.nav.enlaces, [], 'lo que no vino del nav queda del default');
  assert.equal(c.sitio.pie.mostrar, false);
  assert.equal(c.sitio.marcaMako, true);
  assert.equal(c.tema, 'ws:mio');
  assert.equal(JSON.stringify(CONFIG_DEFAULT), antes, 'CONFIG_DEFAULT no se muta');
  assert.deepEqual(mezclarConfig(undefined), CONFIG_DEFAULT);
});

test('textos e ids que guarda el server', () => {
  assert.equal(sanearTitulo('  Mi   landing \n nueva '), 'Mi landing nueva');
  assert.equal(sanearTitulo(''), 'Sin título');
  assert.equal(sanearTitulo('x'.repeat(500)).length, 200);
  assert.equal(idValido(7), 7);
  assert.equal(idValido('12'), 12);
  assert.equal(idValido(0), null);
  assert.equal(idValido(-3), null);
  assert.equal(idValido(1.5), null);
  assert.equal(idValido('1 or 1=1'), null);
  assert.equal(vistaTokenValido('A'.repeat(43)), true);
  assert.equal(vistaTokenValido('A'.repeat(42)), false);
  assert.equal(vistaTokenValido('A'.repeat(42) + '/'), false);
  assert.equal(tarjetaIdValido('tabc123'), true);
  assert.equal(tarjetaIdValido('t; drop'), false);
});

// ── Subidas ──────────────────────────────────────────────────────────────────

test('subidas: tipos y topes de api-tipos, nunca svg', () => {
  assert.deepEqual(Object.keys(EXT_DE_TIPO).sort(), [...TIPOS_IMAGEN, ...TIPOS_VIDEO].sort());
  assert.deepEqual(validarSubida('image/png', 1000), { ok: true, tipo: 'image/png', ext: 'png' });
  assert.equal(validarSubida('image/svg+xml', 1000).ok, false);
  assert.equal(validarSubida('text/html', 1000).ok, false);
  assert.equal(validarSubida('image/jpeg', 0).ok, false);
  assert.equal(validarSubida('image/jpeg', TOPE_IMAGEN_BYTES).ok, true);
  assert.equal(validarSubida('image/jpeg', TOPE_IMAGEN_BYTES + 1).ok, false, 'una imagen de 16 MB no');
  assert.equal(validarSubida('video/mp4', TOPE_IMAGEN_BYTES + 1).ok, true, 'un video de 16 MB sí');
  assert.equal(validarSubida('video/mp4', TOPE_VIDEO_BYTES + 1).ok, false);
});

test('subidas: la ruta de subida es del workspace, y sólo ella se registra (y se muda a la raíz)', () => {
  const uuid = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const p = pathDeSubida(9, uuid.toUpperCase(), 'png');
  assert.equal(p, `9/subidas/${uuid}.png`);
  assert.deepEqual(subidaDelWs(p, 9), { tipo: 'image/png', final: `9/${uuid}.png` });
  assert.equal(subidaDelWs(p, 3), null, 'la subida de otro negocio no se registra');
  assert.equal(subidaDelWs(`9/${uuid}.png`, 9), null, 'una ruta FINAL no se vuelve a registrar');
  assert.equal(subidaDelWs(`9/subidas/../3/${uuid}.png`, 9), null);
  assert.equal(subidaDelWs(`9/subidas/${uuid}.svg`, 9), null);
  assert.equal(archivoDeBiblioteca(`${uuid}.webm`), 'video');
  assert.equal(archivoDeBiblioteca(`${uuid}.jpg`), 'imagen');
  assert.equal(archivoDeBiblioteca('subidas'), null, 'la carpeta de subidas no es un archivo de la biblioteca');
  assert.equal(archivoDeBiblioteca('foto.html'), null);
});

test('magic bytes: el tipo sale de los bytes, nunca del nombre (y nunca svg ni mov)', () => {
  const b = (...xs: number[]) => Uint8Array.from(xs);
  const txt = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
  assert.equal(sniffImagen(b(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(sniffImagen(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  assert.equal(sniffImagen(txt('GIF89a')), 'image/gif');
  assert.equal(sniffImagen(txt('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImagen(txt('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(sniffImagen(txt('<html><script>')), null);
  assert.equal(sniffMedia(txt('\0\0\0\x20ftypisom\0\0')), 'video/mp4');
  assert.equal(sniffMedia(b(0x1a, 0x45, 0xdf, 0xa3, 0x01)), 'video/webm');
  assert.equal(sniffMedia(txt('\0\0\0\x14ftypqt  \0\0')), null, 'un MOV no');
  assert.equal(sniffMedia(b(0xff, 0xd8, 0xff)), 'image/jpeg');
  assert.equal(sniffMedia(b()), null);
});

// ── Temas propios ────────────────────────────────────────────────────────────

test('temas propios: la lista guardada se sanea (ids únicos, tope, JSON o basura)', () => {
  const t = (id: string) => ({ id, nombre: `Tema ${id}`, base: 'pewter', cambios: {} });
  assert.deepEqual(sanearTemasPropios(null), []);
  assert.deepEqual(sanearTemasPropios('{no es json'), []);
  assert.deepEqual(sanearTemasPropios({ id: 'a' }), [], 'un objeto suelto no es una lista');
  const dos = sanearTemasPropios(JSON.stringify([t('a'), t('a'), t('b')]));
  assert.deepEqual(dos.map((x) => x.id), ['a', 'b'], 'el id repetido se queda con el primero');
  assert.equal(sanearTemasPropios(Array.from({ length: 40 }, (_, i) => t(`t${i}`))).length, TOPE_TEMAS);
  assert.deepEqual(sanearTemasPropios([{ id: 'mal id con espacios', nombre: 'x', base: 'pewter' }]), []);
});

// ── La migración 0246 y los tres registros ───────────────────────────────────

const MIG = 'supabase/migrations/0246_editor_landing.sql';

test('0246: antes del deploy, las tres tablas con workspace, RLS y revoke, y los índices únicos parciales', () => {
  const crudo = leer(MIG);
  assert.match(crudo, /ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy/);
  const sql = crudo.replace(/^\s*--.*$/gm, '');
  for (const t of ['landing_docs', 'landing_doc_versiones', 'landing_doc_comentarios']) {
    const def = sql.slice(sql.indexOf(`create table if not exists ${t} (`), sql.indexOf(');', sql.indexOf(`create table if not exists ${t} (`)));
    assert.ok(def.length > 50, `falta la tabla ${t}`);
    assert.match(def, /workspace_id\s+bigint not null references workspaces\(id\) on delete cascade/, `${t}: workspace_id sin default y con cascade`);
    assert.match(sql, new RegExp(`alter table ${t} enable row level security;`), `${t}: RLS`);
    assert.match(sql, new RegExp(`revoke all on ${t} from anon, authenticated;`), `${t}: revoke`);
  }
  assert.match(sql, /create unique index if not exists landing_docs_slug_uk on landing_docs \(slug\) where slug is not null;/);
  assert.match(sql, /create unique index if not exists landing_docs_vista_token_uk on landing_docs \(vista_token\) where vista_token is not null;/);
  assert.match(sql, /doc_id\s+bigint not null references landing_docs\(id\) on delete cascade/);
});

test('0246: el bucket es PÚBLICO, con el tope del video y la lista de tipos de api-tipos (sin svg)', () => {
  const sql = leer(MIG).replace(/^\s*--.*$/gm, '');
  const ins = sql.slice(sql.indexOf('insert into storage.buckets'));
  const m = /values \('landing-imagenes', 'landing-imagenes', true, (\d+), array\[/.exec(ins);
  assert.ok(m, 'el bucket landing-imagenes, público');
  assert.equal(Number(m![1]), TOPE_VIDEO_BYTES, 'el tope del bucket y TOPE_VIDEO_BYTES se separaron');
  const lista = ins.slice(ins.indexOf('array['), ins.indexOf(']'));
  const mimes = [...lista.matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(mimes, [...TIPOS_IMAGEN, ...TIPOS_VIDEO].sort(), 'la lista del bucket y TIPOS_IMAGEN + TIPOS_VIDEO se separaron');
  assert.ok(!mimes.some((x) => /svg|html|javascript|xml/.test(x)), 'nada que pueda llevar código');
  assert.match(ins, /on conflict \(id\) do update set public = true/);
});

test('el registro del inquilino: las tres tablas en TENANT_TABLES y en TABLAS_DE_INQUILINO, el bucket en el reset', () => {
  const ws = sinComentarios(leer('lib/workspace.ts'));
  const tenant = ws.slice(ws.indexOf('const TENANT_TABLES'), ws.indexOf(']);', ws.indexOf('const TENANT_TABLES')));
  for (const t of ['landing_docs', 'landing_doc_versiones', 'landing_doc_comentarios']) {
    assert.match(tenant, new RegExp(`'${t}'`), `sin ${t} en TENANT_TABLES, getTenantDb() es PASSTHROUGH`);
    assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes(t), `falta ${t} en TABLAS_DE_INQUILINO: el reset la dejaría con filas`);
  }
  const reset = sinComentarios(leer('lib/reset-workspace.ts'));
  const buckets = reset.split('\n').find((l) => l.includes('const BUCKETS'));
  assert.ok(buckets && buckets.includes("'landing-imagenes'"), 'falta el bucket en el reset: vaciar un workspace dejaría sus imágenes');
});

// ── Los compare-and-set de server.ts y publicar.ts ───────────────────────────

test('guardar y publicar exigen la versión EN EL WHERE (compare-and-set), y publicar lee la fila, no el body', () => {
  const srv = sinComentarios(leer('lib/editor-landing/server.ts'));
  const guardar = srv.slice(srv.indexOf('export async function guardar('), srv.indexOf('export async function duplicar('));
  assert.match(guardar, /\.update\(patch\)[\s\S]{0,140}\.eq\('version', abierta\)/, 'guardar sin compare-and-set pisa a la otra pestaña');
  const pub = sinComentarios(leer('lib/editor-landing/publicar.ts'));
  const publicar = pub.slice(pub.indexOf('export async function publicar('), pub.indexOf('export async function despublicar('));
  assert.match(publicar, /if \(f\.version !== version\)/, 'publicar tiene que comparar la versión de LA FILA');
  assert.match(publicar, /\.update\(\{ publicado: foto[\s\S]{0,200}\.eq\('version', version\)/, 'el update de publicar sin compare-and-set');
  assert.ok(!/contenido:\s*p\.|body\.contenido/.test(publicar), 'publicar no renderiza lo que manda la pantalla');
});

test('las lecturas públicas no usan getTenantDb (sin cookie caería al ws1) y leen estricto', () => {
  const pub = sinComentarios(leer('lib/editor-landing/publicar.ts'));
  for (const fn of ['leerPublicado', 'leerVistaPrevia']) {
    const ini = pub.indexOf(`export async function ${fn}(`);
    const fin = pub.indexOf('\n}\n', ini);
    const cuerpo = pub.slice(ini, fin);
    assert.ok(cuerpo.length > 100, `falta ${fn}`);
    assert.ok(!/getTenantDb|getSetting\(|getWorkspaceActual/.test(cuerpo), `${fn} no puede resolver el workspace por la cookie`);
    assert.match(cuerpo, /getSupabaseServer\(\)/);
    assert.match(cuerpo, /if \(error\) throw/, `${fn}: un error de base tiene que tirar (no es «no existe»)`);
  }
});

test('las portadas usan la lib de stock (una sola implementación del sniff y de la búsqueda)', () => {
  const ruta = sinComentarios(leer('app/api/portadas/route.ts'));
  assert.match(ruta, /from '@\/lib\/imagenes-stock'/);
  assert.ok(!/function sniffImagen|api\.openverse\.org|mymemory/.test(ruta), 'la ruta de portadas volvió a tener su propia copia');
});
