// =============================================================================
// La IA lee sola las piezas de un competidor, de a tandas y sólo lo que falta (4/11/2026)
// =============================================================================
// Martín: «"Con qué abre" no se entiende… la IA ya debería analizar por sí sola todo, sin pedirlo. Obvio, jamás que el
// usuario tenga que esperar… y de última que en el detail de cada reel aparezca "Analizando"».
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada:
//   · `faltaAnalisis` que cuenta un análisis vacío como pendiente   → 1 y 3
//   · `pendientesDeAnalisis` sin ordenar por vistas                 → 2
//   · `refsSinRespuesta` sin ignorar mayúsculas                     → 4
//   · `ofertaQueQueda` que pisa con una vacía                       → 5
//   · el análisis volviendo a `chatClaude` (la IA de la plataforma) → 6
//   · `opcionesDeContenido` sin «Agregar su Instagram»              → 7
//   · `faltaAnalisis` sin pedir el formato a lo ya leído            → 1 y 2   (el detalle, 4/11)
//   · `pendientesDeAnalisis` que no pone primero lo nunca leído    → 2
// Y el 18/11/2026 (pendiente T12, la refutación del 17/11), base 10 pasan:
//   · `cierreDeLasQueNoVolvieron` que manda todo a `sinDatos` (lo de antes) → 8
//   · `PUEDEN_SER_UNO_NUEVO` sólo con 'otro' (lo de antes)                 → 9
//   · `faltaAnalisis` sin `hayAlgoQueLeer`                                  → 10
//   · el filtro de la escritura como `formatosV is null` (la revisión)      → 11
//   · `hayAlgoQueLeer` que poda también los anuncios                       → 10
//   Cada una sola: 10 pasan, 1 falla (base: 11 pasan).
// Y la segunda revisión del 18/11 (base 12 pasan; el 11 de antes comparaba la constante con su propio texto):
//   · `texto_leido_en: ahora` de vuelta en lo que la IA devolvió            → 12
//   · `texto_leido_en: ahora` de vuelta en `sinDatos`                       → 12
//   · el filtro como `formatosV.is.null` solo                               → 8 y 11
//   · el filtro como `formatosV.neq.N` solo (sin el `is.null`)              → 8 y 11
// Correr: node --import tsx --test tests/spy-analisis.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ANALISIS_SIN_DATOS, FILTRO_SIN_LA_VERSION_DE_HOY, PIEZAS_POR_ANALISIS, cierreDeLasQueNoVolvieron, cuantasFaltan, faltaAnalisis, hayAlgoQueLeer,
  ofertaQueQueda, pendientesDeAnalisis, refsSinRespuesta, type PiezaParaAnalisis,
} from '../lib/spy-analisis-reglas';
import { VERSION_FORMATOS } from '../lib/spy-detalle';
import { opcionesDeContenido } from '../lib/spy-vista';

const RAIZ = resolve(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const pieza = (ref: string, vistas: number | null, analisis: unknown = null, canal = 'instagram', publicada_en: string | null = null) =>
  ({ ref, canal, vistas, analisis, publicada_en });

test('1. falta el análisis sólo si nunca se leyó; uno vacío ya cuenta como leído', () => {
  assert.equal(faltaAnalisis(pieza('a', 10)), true);
  assert.equal(faltaAnalisis(pieza('a', 10, ANALISIS_SIN_DATOS)), false);
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'pov' })), false);
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'otro', formatosV: VERSION_FORMATOS })), false, 'la IA no vio el formato: no se vuelve a pedir');
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x' })), true, 'lo analizado antes del formato se lee una vez más');

  // ⚠️ LO MARCADO `otro` CON LOS ONCE FORMATOS VIEJOS SE LEE UNA VEZ MÁS (6/11/2026). Hasta hoy no: la línea de arriba
  // decía que un `otro` ya estaba listo, y así lo analizado antes del catálogo de 19 se quedaba en el formato viejo para
  // siempre, con los dos criterios conviviendo sin que nada lo avisara. De los 19 de hoy, OCHO entraron después de los
  // 11 primeros, así que un `otro` de entonces puede ser un `promo` o un `mito` de ahora.
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'otro' })), true, 'sin la marca del catálogo, un `otro` es de los 11 viejos');
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'otro', formatosV: 1 })), true);
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'Otro', formatosV: 1 })), true, 'el nombre y el id son lo mismo (`formatoDe`)');
  // Pero SÓLO los `otro`: los ids del catálogo nuevo son un superconjunto de los viejos, así que releer un `tutorial`
  // no cambiaría nada y lo pagaría el negocio.
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'tutorial' })), false, 'un tutorial sigue siendo un tutorial');
  assert.equal(faltaAnalisis(pieza('a', 10, { gancho: 'x', formato: 'pov', formatosV: 1 })), false);
  // Y es UNA vez: lo que se guarda desde ahora lleva la marca, también lo que la IA no devolvió.
  assert.equal(ANALISIS_SIN_DATOS.formatosV, VERSION_FORMATOS, 'sin esto, una pieza que la IA no devuelve pide lectura para siempre');
  assert.equal(faltaAnalisis(pieza('a', 10, ANALISIS_SIN_DATOS)), false);
  // La web se lee aparte (su funnel): no es una pieza que lea esta IA.
  assert.equal(faltaAnalisis(pieza('https://x.com', null, null, 'landing')), false);
});

test('2. primero lo más visto, lo que no publica sus vistas al final, y de a una tanda', () => {
  const ps = [pieza('chico', 5), pieza('sin', null), pieza('grande', 900), pieza('medio', 50), pieza('leido', 5000, { gancho: 'g', formato: 'pov' })];
  assert.deepEqual(pendientesDeAnalisis(ps).map((p) => p.ref), ['grande', 'medio', 'chico', 'sin']);
  // Lo leído antes del formato va DESPUÉS de lo que nunca se leyó, aunque tenga más vistas.
  assert.deepEqual(pendientesDeAnalisis([pieza('sinFormato', 9000, { gancho: 'g' }), pieza('nueva', 3)]).map((p) => p.ref), ['nueva', 'sinFormato']);
  const muchas = Array.from({ length: 70 }, (_, i) => pieza(`p${i}`, i));
  assert.equal(pendientesDeAnalisis(muchas).length, PIEZAS_POR_ANALISIS);
  assert.equal(pendientesDeAnalisis(muchas)[0].ref, 'p69');
  // A igual vistas, lo más nuevo.
  assert.deepEqual(pendientesDeAnalisis([pieza('vieja', 1, null, 'youtube', '2026-01-01'), pieza('nueva', 1, null, 'youtube', '2026-10-01')]).map((p) => p.ref), ['nueva', 'vieja']);
});

test('3. cuántas faltan: con eso la pantalla dibuja «Analizando…» y deja de preguntar en cero', () => {
  assert.equal(cuantasFaltan([pieza('a', 1), pieza('b', 2, ANALISIS_SIN_DATOS), pieza('c', 3, { gancho: 'x', formato: 'lista' })]), 1);
  assert.equal(cuantasFaltan([]), 0);
});

test('4. lo que se mandó y la IA no devolvió se marca leído, aunque lo devuelva en minúsculas', () => {
  assert.deepEqual(refsSinRespuesta(['AbC123', 'xyz', 'Q9'], ['abc123', ' q9 ']), ['xyz']);
  assert.deepEqual(refsSinRespuesta(['a'], []), ['a']);
});

test('5. una tanda que no dice qué promete no borra la oferta que ya estaba', () => {
  const antes = { promete: 'Vender más con reels', aQuien: '', precio: null, objecion: '', huecos: [] };
  assert.equal(ofertaQueQueda({ ...antes, promete: '  ' }, antes), antes);
  assert.equal(ofertaQueQueda({ ...antes, promete: 'Otra' }, antes)?.promete, 'Otra');
  assert.equal(ofertaQueQueda({ ...antes, promete: '' }, null), null);
});

test('6. la IA es la del negocio: el análisis no llama a la de la plataforma', () => {
  const spy = sinComentarios(readFileSync(resolve(RAIZ, 'lib/spy.ts'), 'utf8'));
  const cuerpo = spy.slice(spy.indexOf('export async function analizarCompetidor('), spy.indexOf('async function guardarAnalisis('));
  assert.ok(cuerpo.length > 500, 'encontré la función');
  assert.match(cuerpo, /chatCheapCascade\(\{/);
  assert.doesNotMatch(cuerpo, /chatClaude\(/);
  assert.match(cuerpo, /soloPendientes \? pendientesDeAnalisis\(todas\)/);
  // Y la ruta que lo dispara solo contesta en el acto: el trabajo sigue en un `after()`.
  const ruta = sinComentarios(readFileSync(resolve(RAIZ, 'app/api/competitor-spy/analizar/route.ts'), 'utf8'));
  assert.match(ruta, /after\(trabajo\)/);
  assert.match(ruta, /sinIA: true/);
});

test('7. el desplegable de tipos: sólo los que tiene, con cuántas, y la red que le falta al final', () => {
  const ps = [
    { canal: 'instagram' as const, tipo: 'reel' as const, duracion: null },
    { canal: 'instagram' as const, tipo: 'reel' as const, duracion: null },
    { canal: 'youtube' as const, tipo: 'video' as const, duracion: 'PT40S' },
  ];
  assert.deepEqual(opcionesDeContenido(ps, { instagram: 'x', youtube_id: null }).map((o) => [o.value, o.label]), [
    ['todo', 'Todo lo que publica · 3'], ['reels', 'Reels · 2'], ['shorts', 'Shorts · 1'], ['agregar-youtube', 'Agregar su YouTube'],
  ]);
  assert.deepEqual(opcionesDeContenido([], { instagram: null, youtube_id: 'UC1' }).map((o) => o.value), ['todo', 'agregar-instagram']);
});

// ── Pendiente T12 (18/11/2026): la relectura de los formatos se hace UNA vez, de verdad ──────────────────────────────

const DIA = 86_400_000;
const hace = (ms: number) => new Date(Date.now() - ms).toISOString();

/** Evalúa un filtro `.or()` de PostgREST sobre UNA fila, con la semántica de SQL: `col->>clave` es TEXTO (o NULL si la clave
 *  falta o vale null), `is.null` pregunta por NULL, y `neq.N` contra un NULL da NULL, o sea NO cumple. Cubre sólo la forma que
 *  usa `FILTRO_SIN_LA_VERSION_DE_HOY`; otra forma TIRA, para que un filtro reescrito no pase por un evaluador que no lo entiende. */
function cumpleOr(filtro: string, fila: { analisis: unknown }): boolean {
  return filtro.split(',').some((cond) => {
    const m = /^analisis->>(\w+)\.(is\.null|neq\.(.+))$/.exec(cond);
    if (!m) throw new Error(`el evaluador del test no entiende «${cond}»`);
    const a = fila.analisis;
    const v = a && typeof a === 'object' ? (a as Record<string, unknown>)[m[1]!] : undefined;
    const texto = v == null ? null : String(v);
    if (m[2] === 'is.null') return texto === null;
    return texto !== null && texto !== m[3];
  });
}

/** Una tanda como la corre `analizarCompetidor` + `guardarAnalisis`, sobre las piezas en memoria: manda lo pendiente, la
 *  «IA» devuelve sólo `devuelve`, y lo demás se cierra con `cierreDeLasQueNoVolvieron`. La escritura en la base filtra
 *  `analisis is null` para `sinDatos` y `FILTRO_SIN_LA_VERSION_DE_HOY` para `yaRevisadas`: acá se aplica ESE filtro, con
 *  `cumpleOr`, así que el test 8 también cae si el filtro deja afuera una versión vieja. */
function tanda(piezas: PiezaParaAnalisis[], devuelve: ReadonlySet<string>): string[] {
  const enviadas = pendientesDeAnalisis(piezas);
  for (const p of enviadas) {
    if (devuelve.has(p.ref)) p.analisis = { gancho: 'nuevo', formato: 'caso-de-exito', formatosV: VERSION_FORMATOS };
  }
  const { sinDatos, yaRevisadas } = cierreDeLasQueNoVolvieron(enviadas, [...devuelve]);
  for (const p of piezas) {
    if (sinDatos.includes(p.ref) && p.analisis == null) p.analisis = { ...ANALISIS_SIN_DATOS };
    const r = yaRevisadas.find((x) => x.ref === p.ref);
    if (r && cumpleOr(FILTRO_SIN_LA_VERSION_DE_HOY, p)) p.analisis = r.analisis;
  }
  return enviadas.map((p) => p.ref);
}

test('8. una pieza VIEJA que la IA no devuelve se cierra igual: no se vuelve a mandar ni a pagar', () => {
  const piezas: PiezaParaAnalisis[] = [
    pieza('viejo-otro', 900, { gancho: 'x', formato: 'otro' }),
    pieza('viejo-con-marca', 850, { gancho: 'z', formato: 'otro', formatosV: 1 }),
    pieza('antes-del-formato', 800, { gancho: 'y' }),
    pieza('nunca', 10),
  ];
  const primera = tanda(piezas, new Set());           // la IA no devuelve ninguna
  assert.deepEqual(primera.sort(), ['antes-del-formato', 'nunca', 'viejo-con-marca', 'viejo-otro']);
  assert.equal(cuantasFaltan(piezas), 0, 'lo que no volvió quedó pidiendo lectura: la próxima tanda lo vuelve a pagar');
  assert.deepEqual(tanda(piezas, new Set()), [], 'la segunda tanda no tiene nada que mandar');
  // Y lo de antes queda: cerrar no es borrar lo que la IA vieja había leído.
  assert.equal((piezas[0]!.analisis as { gancho: string }).gancho, 'x');
  assert.equal((piezas[2]!.analisis as { formato: string }).formato, 'otro');
  assert.deepEqual(piezas[3]!.analisis, ANALISIS_SIN_DATOS);
});

test('9. se relee lo que con once formatos pudo caer en el lugar de uno de los nuevos, y nada más', () => {
  for (const f of ['otro', 'testimonio', 'opinion', 'detras', 'entrevista']) {
    assert.equal(faltaAnalisis(pieza('a', 1, { gancho: 'x', formato: f })), true, `un «${f}» del catálogo de once puede ser uno de los nuevos`);
    assert.equal(faltaAnalisis(pieza('a', 1, { gancho: 'x', formato: f, formatosV: VERSION_FORMATOS })), false, `un «${f}» de hoy no se relee`);
  }
  for (const f of ['tutorial', 'lista', 'storytime', 'pov', 'antes-despues', 'resena']) {
    assert.equal(faltaAnalisis(pieza('a', 1, { gancho: 'x', formato: f })), false, `un «${f}» no se relee: lo decide Martín (gasto de la IA del negocio)`);
  }
});

test('10. una pieza de texto vencido no se manda a la IA; una sana sin texto sí, como siempre', () => {
  // `podarVencido` le tacha título, texto y análisis a los 30 días: llega con `analisis: null`.
  const vencida = { ...pieza('yt-vieja', 5000, null, 'youtube'), texto_leido_en: hace(40 * DIA) };
  assert.equal(hayAlgoQueLeer(vencida), false);
  assert.equal(faltaAnalisis(vencida), false, 'mandarla cobra una lectura de nada y renueva el reloj del texto');
  assert.deepEqual(tanda([vencida], new Set()), []);
  // La revisión del 18/11: un post sano sin descripción no es «nada que leer».
  const sinTexto = { ...pieza('ig-sin-caption', 50, null, 'instagram'), texto_leido_en: hace(DIA) };
  assert.equal(faltaAnalisis(sinTexto), true);
  // Los anuncios no se podan: nunca vencen acá.
  assert.equal(hayAlgoQueLeer({ ...pieza('ad', null, null, 'anuncios'), texto_leido_en: hace(400 * DIA) }), true);
  assert.equal(faltaAnalisis(pieza('sin-fecha', 5000)), true, 'quien no pasa la fecha sigue como antes');
});

test('11. la escritura que cierra lo viejo agarra toda versión que no es la de hoy, y nunca la de hoy', () => {
  // La revisión del 18/11: con `formatosV is null`, el día que VERSION_FORMATOS suba, una pieza con la versión anterior que la
  // IA no devuelve no se cierra y se vuelve a pagar en cada tanda. Se juzga lo que el filtro HACE sobre filas, no su texto.
  const fila = (formatosV: unknown) => ({ analisis: formatosV === 'falta' ? { gancho: 'x' } : { gancho: 'x', formatosV } });
  assert.equal(cumpleOr(FILTRO_SIN_LA_VERSION_DE_HOY, fila('falta')), true, 'sin la marca (el catálogo de once): se cierra');
  assert.equal(cumpleOr(FILTRO_SIN_LA_VERSION_DE_HOY, fila(null)), true, 'con la marca en null: se cierra');
  assert.equal(cumpleOr(FILTRO_SIN_LA_VERSION_DE_HOY, fila(VERSION_FORMATOS - 1)), true, 'la versión de ayer: se cierra (lo que se trababa)');
  assert.equal(cumpleOr(FILTRO_SIN_LA_VERSION_DE_HOY, fila(1)), true);
  assert.equal(cumpleOr(FILTRO_SIN_LA_VERSION_DE_HOY, fila(VERSION_FORMATOS)), false, 'otra tanda ya la clasificó con el catálogo de hoy: no se pisa');
  assert.equal(cumpleOr(FILTRO_SIN_LA_VERSION_DE_HOY, { analisis: null }), true, 'NULL entero: la cubre el `is.null`');
  // Y el filtro de antes, por el mismo evaluador, cae justo en la versión de ayer: la medida de que el evaluador distingue.
  assert.equal(cumpleOr('analisis->>formatosV.is.null', fila(VERSION_FORMATOS - 1)), false);
  // Cableado: la escritura de yaRevisadas usa ESE filtro.
  const src = sinComentarios(readFileSync(resolve(RAIZ, 'lib', 'spy.ts'), 'utf8'));
  const g = src.slice(src.indexOf('async function guardarAnalisis('), src.indexOf('export const leerSystemDelSpy'));
  assert.ok(g.length > 500, 'encontré guardarAnalisis');
  assert.match(g, /for \(const r of yaRevisadas\)[\s\S]{0,300}\.or\(FILTRO_SIN_LA_VERSION_DE_HOY\)/, 'la escritura de yaRevisadas no usa el filtro');
});

test('12. analizar NO renueva el reloj del texto de una pieza: sólo leer el texto lo renueva', () => {
  // La revisión del 18/11: cada pieza analizada quedaba con `texto_leido_en: ahora`, y un texto bajado hace 29 días quedaba a
  // la vista 30 días más sin haberse vuelto a leer (la retención de YouTube, `podarVencido`). Con la relectura de los
  // formatos viejos, eso pasaba a tandas. Lo que se mira: cada escritura a `spy_piezas` adentro de guardarAnalisis.
  const src = sinComentarios(readFileSync(resolve(RAIZ, 'lib', 'spy.ts'), 'utf8'));
  const g = src.slice(src.indexOf('async function guardarAnalisis('), src.indexOf('export const leerSystemDelSpy'));
  const escrituras = [...g.matchAll(/from\('spy_piezas'\)[\s\S]*?;/g)].map((m) => m[0]);
  assert.equal(escrituras.length, 3, `las tres escrituras de piezas (lo devuelto, sinDatos, yaRevisadas); encontré ${escrituras.length}`);
  for (const e of escrituras) assert.doesNotMatch(e, /texto_leido_en/, `una escritura del análisis renueva el reloj del texto:\n${e.slice(0, 200)}`);
});
