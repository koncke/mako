// =============================================================================
// Landing Analyst analiza sola cada página que se declara en el Pixel (06/10/2026)
// =============================================================================
// «si yo pongo una nueva landing en el pixel, automáticamente la tiene que
// analizar la funcion de Landing Analyst. Que eso corra por detrás claro».
//
// Lo que se cuida:
//   · el cálculo de qué falta (las declaradas sin fila), con la normalización de
//     Landing Analyst y no la del Pixel;
//   · que un análisis cortado se reconozca y no quede «Revisando» para siempre;
//   · que los TRES caminos que declaran una página disparen el análisis;
//   · que el disparo sea por detrás y vuelva a entrar al workspace;
//   · el reclamo atómico (dos disparos no analizan dos veces);
//   · que NUNCA se analicen las URLs que vio el Pixel (las escribe un endpoint público);
//   · que un análisis automático no le cierre el onboarding a nadie.
//
// Probado rompiéndolo el 06/10/2026 (con todo puesto: 7 pasan / 0 fallan):
//   · faltanAnalizar compara sin normalizar                     -> 6 / 1
//   · analisisCortado acepta cualquier estado                   -> 6 / 1
//   · guardarLandingAction deja de llamar al disparo            -> 6 / 1
//   · el disparo corre sin after()                              -> 6 / 1
//   · el reclamo pierde el ignoreDuplicates                     -> 6 / 1
//   · el reconciliador lee landing_visits                       -> 6 / 1
//   · el análisis automático marca el onboarding                -> 6 / 1
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  analisisCortado, faltanAnalizar, claveDeLanding, MINUTOS_CORTE_ANALISIS,
  conQuitada, erroresParaReintentar, leerQuitadas, HORAS_REINTENTO_ERROR, REINTENTOS_POR_CORRIDA,
} from '../lib/landing-url';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('falta analizar lo declarado SIN fila, normalizado como Landing Analyst', () => {
  // www, barra final y query no hacen otra página.
  assert.deepEqual(
    faltanAnalizar(['https://www.x.com/', 'https://x.com/oferta?utm_source=fb', 'https://y.com'], ['https://x.com']),
    ['https://x.com/oferta', 'https://y.com'],
  );
  // Una página con fila —aunque esté en error— no entra acá (la que está en error la toma erroresParaReintentar).
  assert.deepEqual(faltanAnalizar(['https://x.com'], ['https://x.com']), []);
  // Y la fila también se normaliza: una guardada con www es la misma página.
  assert.deepEqual(faltanAnalizar(['https://x.com'], ['https://www.x.com/']), []);
  // Repetidas cuentan una vez, y una URL rota no voltea el resto.
  assert.deepEqual(faltanAnalizar(['https://z.com', 'z.com', 'http://[::1'], []), ['https://z.com']);
  assert.equal(claveDeLanding('HTTPS://WWW.Ejemplo.com/a/?b=1#c'), 'https://ejemplo.com/a');
});

test('un pendiente viejo es un análisis cortado; un pendiente nuevo o un error, no', () => {
  const ahora = Date.parse('2026-10-06T12:00:00Z');
  const hace = (min: number) => new Date(ahora - min * 60_000).toISOString();
  assert.equal(analisisCortado('pendiente', hace(MINUTOS_CORTE_ANALISIS + 1), ahora), true);
  assert.equal(analisisCortado('pendiente', hace(2), ahora), false);
  assert.equal(analisisCortado('error', hace(60), ahora), false);
  assert.equal(analisisCortado('analizada', hace(60), ahora), false);
  assert.equal(analisisCortado('pendiente', null, ahora), false);
});

test('los tres caminos que declaran una página disparan el análisis', () => {
  const config = sinComentarios(leer('app/integraciones/landing-config-actions.ts'));
  const i = config.indexOf('export async function guardarLandingAction');
  const cuerpo = config.slice(i, config.indexOf('\nexport ', i + 10));
  assert.match(cuerpo, /await programarAnalisisDeclaradas\(\);/, 'guardar una página en el Pixel no dispara el análisis');
  assert.match(sinComentarios(leer('app/integraciones/landing-actions.ts')), /await programarAnalisisDeclaradas\(\);/, 'el formato viejo tampoco');
  assert.match(sinComentarios(leer('lib/api-mako/areas/landing.helpers.ts')), /await programarAnalisisDeclaradas\(\);/, 'ni la API de MaKo');
});

test('el disparo es POR DETRÁS y vuelve a entrar al workspace', () => {
  const src = sinComentarios(leer('lib/landing-analyst-auto.ts'));
  const i = src.indexOf('export async function programarAnalisisDeclaradas');
  const cuerpo = src.slice(i);
  assert.match(cuerpo, /after\(trabajo\)/, 'sin after() la persona espera el análisis entero al guardar');
  assert.match(cuerpo, /runWithWorkspace\(quien/, 'after() corre fuera del contexto: sin re-entrar, getTenantDb cae a otro inquilino');
  assert.match(leer('app/integraciones/page.tsx'), /export const maxDuration = 300;/, 'el after() de una action vive en el maxDuration de la página');
});

test('reclamo atómico, y SÓLO las páginas declaradas', () => {
  const src = sinComentarios(leer('lib/landing-analyst-auto.ts'));
  assert.match(src, /ignoreDuplicates: true/, 'sin el reclamo, dos disparos analizan dos veces y gastan dos veces la cuota');
  assert.match(src, /if \(eReclamo \|\| !tomada\?\.length\) continue;/);
  assert.doesNotMatch(src, /landing_visits|urlsDescubiertas/, 'las URLs que vio el Pixel las escribe un endpoint público: no se analizan solas');
  assert.match(src, /landingsDelWorkspace\(\)/);
});

test('un análisis automático NO marca el onboarding de la tab', () => {
  const src = sinComentarios(leer('lib/landing-analyst.ts'));
  assert.match(src, /if \(opts\.origen !== 'auto'\) try \{\s*const \{ marcarPasoTab \}/, 'cerraría el onboarding de alguien que nunca abrió Landing Analyst');
});

test('el cron de red existe y está agendado', () => {
  const vercel = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string }> };
  assert.ok(vercel.crons.some((c) => c.path === '/api/cron/landing-analyst-auto'), 'sin el cron, lo que se cortó o entró por otro lado no se analiza nunca');
  assert.match(sinComentarios(leer('app/api/cron/landing-analyst-auto/route.ts')), /asegurarAnalisisDeDeclaradas\(\{ deadline \}\)/);
});

test('⚠️ «Buscar mis páginas» no vuelve a analizar una página que se está analizando', () => {
  // El análisis automático reclama la fila como 'pendiente' y tarda minutos; el sync la
  // tomaba como un fallo y la misma página se analizaba dos veces, pagando dos veces la IA
  // (revisión del 06/10/2026). Se reintenta sólo la que se cortó.
  //
  // PROBADO ROMPIÉNDOLO: con `enCurso` devolviendo siempre false → 7 pasan / 1 falla (éste).
  const src = sinComentarios(leer('lib/landing-analyst.ts'));
  const sync = src.slice(src.indexOf('export async function syncLandings'), src.indexOf('let analizadas = 0'));
  assert.ok(sync.length > 200 && sync.length < 2500, `el recorte quedó en ${sync.length}: está mirando otra cosa`);
  assert.match(sync, /f\.status === 'pendiente' && !analisisCortado\(f\.status, f\.updated_at, ahora\)/, 'un pendiente reciente volvió a contar como fallo');
  assert.match(sync, /filas\.filter\(\(f\) => !enCurso\(f\)\)/, 'refrescar todo vuelve a correr el que está corriendo');
  assert.match(sync, /\(f\.status === 'pendiente' && !enCurso\(f\)\)/, 'los reintentos toman un pendiente en curso');
});

// =============================================================================
// 17/10/2026: las páginas en ERROR se reintentan solas (una vez por día, con tope) y «quitar» dura.
// =============================================================================
// El caso (docs/relevo/pixel-clarity-landing.md §2, §4.2 y §4.4): la portada del ws1 quedó en error el 20/09 y la de
// Leila (ws11) el 06/10, y nada las volvía a mirar; y «quitar» una página borraba la fila, pero como seguía declarada
// el cron de cada hora la volvía a analizar. Decisiones con criterio, escritas en lib/landing-url.ts.
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés que restaura de memoria y compara el sha256). Base: 12 / 0.
//   A1  el reintento sin esperar las 24 h ......................................... 11 / 1
//   A2  el reintento sin tope por corrida ......................................... 11 / 1
//   A3  reintenta también las que NO están declaradas ............................. 11 / 1
//   A4  faltanAnalizar sin las quitadas ........................................... 11 / 1
//   A5  el auto sin reintentar los errores ........................................ 11 / 1
//   A6  el reclamo del reintento sin comparar updated_at .......................... 11 / 1
//   A7  borrarAnalisis sin anotarla como quitada .................................. 11 / 1
//   A8  analizarla a mano no la devuelve ......................................... 11 / 1
// Restaurado: 12 / 0.

test('una declarada en error se reintenta sola UNA vez por día, la más vieja primero, con tope por corrida', () => {
  const ahora = Date.parse('2026-10-17T12:00:00Z');
  const hace = (h: number) => new Date(ahora - h * 3_600_000).toISOString();
  const filas = [
    { url: 'https://leila.com', status: 'error', updated_at: hace(24 * 11) },          // la de Leila, 11 días
    { url: 'https://reciente.com', status: 'error', updated_at: hace(HORAS_REINTENTO_ERROR - 1) },
    { url: 'https://ok.com', status: 'analizada', updated_at: hace(500) },
    { url: 'https://suelta.com', status: 'error', updated_at: hace(500) },            // NO declarada
    { url: 'https://b.com', status: 'error', updated_at: hace(30) },
    { url: 'https://c.com', status: 'error', updated_at: hace(48) },
  ];
  const declaradas = ['https://www.leila.com/', 'https://reciente.com', 'https://ok.com', 'https://b.com', 'https://c.com'];
  const r = erroresParaReintentar(declaradas, filas, ahora).map((f) => f.url);
  assert.equal(REINTENTOS_POR_CORRIDA, 2);
  assert.deepEqual(r, ['https://leila.com', 'https://c.com'], 'la más vieja primero, con tope; ni la reciente ni la suelta');
  // La que falló hace menos de un día espera (sola, sin el tope de por medio).
  assert.deepEqual(erroresParaReintentar(['https://reciente.com'], filas, ahora), []);
  // Una quitada no se reintenta.
  assert.deepEqual(erroresParaReintentar(declaradas, filas, ahora, ['leila.com']).map((f) => f.url), ['https://c.com', 'https://b.com']);
});

test('«quitar» dura: la lista de quitadas, y faltanAnalizar no la vuelve a tomar', () => {
  assert.deepEqual(leerQuitadas(null), []);
  assert.deepEqual(leerQuitadas('no es json'), []);
  assert.deepEqual(leerQuitadas('{"a":1}'), []);
  const una = conQuitada(null, 'https://www.x.com/oferta/?utm=1', true);
  assert.deepEqual(leerQuitadas(una), ['https://x.com/oferta'], 'se guarda la LLAVE de Landing Analyst');
  assert.deepEqual(leerQuitadas(conQuitada(una, 'x.com/oferta', true)), ['https://x.com/oferta'], 'sin repetir');
  assert.deepEqual(leerQuitadas(conQuitada(una, 'https://x.com/oferta', false)), [], 'analizarla a mano la devuelve');
  assert.deepEqual(faltanAnalizar(['https://x.com/oferta', 'https://y.com'], [], leerQuitadas(una)), ['https://y.com']);
});

test('el auto reintenta los errores con un compare-and-set, y lee las quitadas', () => {
  const src = sinComentarios(leer('lib/landing-analyst-auto.ts'));
  assert.match(src, /leerQuitadas\(await getSetting\(QUITADAS_KEY\)\)/);
  assert.match(src, /faltanAnalizar\(declaradas, filas\.map\(\(f\) => f\.url\), quitadas\)/);
  const i = src.indexOf('erroresParaReintentar(declaradas, filas, ahora, quitadas)');
  assert.ok(i > 0, 'el auto no reintenta los errores');
  const bucle = src.slice(i, src.indexOf('return r;', i));
  assert.match(bucle, /\.eq\('status', 'error'\)\.eq\('updated_at', f\.updated_at as string\)/, 'dos corridas a la vez analizarían dos veces');
  assert.match(bucle, /analizarLanding\(f\.url, undefined, \{ origen: 'auto' \}\)/);
});

test('borrar un análisis la anota como quitada; analizarla a mano la saca', () => {
  const src = sinComentarios(leer('lib/landing-analyst.ts'));
  const borrar = src.slice(src.indexOf('export async function borrarAnalisis'), src.indexOf('async function marcarQuitada'));
  assert.match(borrar, /await marcarQuitada\(clave, true\)/);
  assert.match(src, /if \(opts\.origen !== 'auto'\) await marcarQuitada\(url, false\);/);
});
