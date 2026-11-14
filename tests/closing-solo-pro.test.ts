// =============================================================================
// El análisis de las llamadas de venta (la hoja «Closing» del Dashboard) es SÓLO de MaKo Pro (14/11/2026)
// =============================================================================
// La tabla de planes lo vendía como de Pro desde el 23/10 (`TABS_SOLO_PRO`, 'closing-analyst') y NINGÚN código lo frenaba:
// el Esencial veía la hoja entera (el candado «va en el Dashboard», decía lib/plan-esencial-reglas.ts, y nadie lo puso).
// Martín (14/11/2026): «seas más limitado en el de 47». Lo que se fija acá (la regla y el porqué: lib/closing-solo-pro.ts):
//   1. el texto, en el molde de `textoSoloPro`; en el teléfono, sin vender;
//   2. la hoja del Dashboard: el candado EN LUGAR de los gráficos, sin leer sus datos (ni en el server ni en el navegador);
//   3. la hoja en el teléfono;
//   4. las rutas HTTP de la hoja (la puerta de /api/closing) y «Analizar llamadas» de la ficha del CRM;
//   5. la API de MaKo: el área `closing`, menos las grabaciones del CRM.
//
// PROBADO ROMPIÉNDOLO (14/11/2026): ver el pie del archivo.
// Correr: node --import tsx --test tests/closing-solo-pro.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABS_SOLO_PRO, textoSoloPro } from '../lib/topes-plan';
import { NOMBRE_TAB_PRO, filasDeComparacion } from '../lib/planes-comparacion';
import {
  OPERACIONES_CLOSING_ABIERTAS, QUE_ES_CLOSING, TEXTO_CLOSING_SOLO_PRO, TEXTO_CLOSING_SOLO_PRO_TELEFONO,
} from '../lib/closing-solo-pro';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('1. es de Pro en la tabla, y el candado lo dice con el molde de textoSoloPro (el teléfono, sin vender)', () => {
  assert.ok((TABS_SOLO_PRO as readonly string[]).includes('closing-analyst'));
  const fila = filasDeComparacion().find((f) => f.que === NOMBRE_TAB_PRO['closing-analyst']);
  assert.ok(fila, 'la tabla de /planes vende el análisis de llamadas');
  assert.equal(fila!.esencial, false, 'y no lo incluye en Esencial: el código tiene que cumplirlo');
  assert.equal(TEXTO_CLOSING_SOLO_PRO, 'Qué mejorar en cada llamada de venta es de MaKo Pro. Pasa a Pro para usarlo.');
  // El MISMO molde que `textoSoloPro` (lib/topes-plan.ts): «X es de MaKo Pro. Pasa a Pro para usarlo.».
  assert.equal(TEXTO_CLOSING_SOLO_PRO.replace(QUE_ES_CLOSING, 'X'), textoSoloPro('comunidad').replace('La comunidad de tus alumnos', 'X'));
  assert.ok(TEXTO_CLOSING_SOLO_PRO.startsWith(TEXTO_CLOSING_SOLO_PRO_TELEFONO));
  assert.doesNotMatch(TEXTO_CLOSING_SOLO_PRO_TELEFONO, /Pasa a Pro/, 'el teléfono no vende (T5)');
});

test('2. la hoja del Dashboard: el plan del negocio decide, y sus datos no se leen en el server', () => {
  const p = fuente('app/dashboard/page.tsx');
  assert.match(p, /const esencial = await esEsencialDeLaSesion\(\);\n[^\n]*\n {2}const graficos = sinPaginas \|\| \(esencial && esHojaClosing\(hoja\)\) \? \[\] : pedidos0\.graficos;/,
    'la hoja Closing con candado no lee sus gráficos (no viajan en el HTML)');
  assert.match(p, /const hayHojaClosing = !sinPaginas && !esencial && /, 'ni el aviso de «Conecta tu Claude»: no hay qué analizar');
  assert.match(p, /candadoClosing=\{esencial \? TEXTO_CLOSING_SOLO_PRO : null\}/);
});

test('3. el editor: en la hoja Closing, el candado EN LUGAR de los gráficos, y el navegador no pide sus datos', () => {
  const e = fuente('app/dashboard/EditorInforme.tsx');
  assert.match(e, /const cerradaPorPlan = !!candadoClosing && esHojaClosing\(hoja\);/, 'sólo la hoja Closing: las demás no cambian');
  assert.match(e, /useEffect\(\(\) => \{\n {4}if \(enBlanco \|\| cerradaPorPlan\) return;\n {4}const firmas = firmaPedida\.current!;/,
    'el efecto que pide los datos de la hoja no corre');
  assert.match(e, /\) : cerradaPorPlan && candadoClosing \? \(\n[\s\S]{0,400}<CartelSoloPro texto=\{candadoClosing\} \/>/, 'el cartel en lugar del lienzo');
  // El cartel va ANTES del diseño entero y de la grilla en la cadena de lo que se dibuja.
  const i = e.indexOf(') : cerradaPorPlan && candadoClosing ? (');
  assert.ok(i > 0 && i < e.indexOf(') : disenoEntero ? (') && i < e.indexOf('<ReactGridLayout'));
  assert.match(e, /\{avisoClosing && !closingConectado && esHojaClosing\(hoja\) && !cerradaPorPlan && /, 'sin «Conecta tu Claude» sobre el candado');
});

test('4. la hoja en el teléfono: de qué plan es, antes de leer sus datos', () => {
  const m = fuente('app/m/dashboard/[hoja]/page.tsx');
  const i = m.indexOf('if (esHojaClosing(h) && (await esEsencialDeLaSesion())) {');
  assert.ok(i > 0 && i < m.indexOf('hojaPropia(h, periodo'), 'antes de leer la hoja');
  assert.match(m, /<p className="m-dash-aviso" role="status">\{TEXTO_CLOSING_SOLO_PRO_TELEFONO\}<\/p>/);
  assert.doesNotMatch(m, /TEXTO_CLOSING_SOLO_PRO\b(?!_TELEFONO)/, 'nunca el texto que vende');
});

test('5. las rutas de la hoja (la puerta de /api/closing) y «Analizar llamadas» del CRM: 403 con el candado', () => {
  const puerta = fuente('app/api/closing/puerta.ts');
  assert.match(puerta, /const cerrada = cerrar\(reglaDePuerta\(rol, tabEnCapa\('graphics', capa\), fathom\)\);\n {2}if \(cerrada\) return cerrada;\n {2}return candadoDeProClosing\(\);/,
    'después de la regla de siempre (sin sesión sigue siendo 401)');
  assert.match(puerta, /if \(!\(await esEsencialDeLaSesion\(\)\)\) return null;\n {2}return Response\.json\(\n {4}\{ ok: false, error: TEXTO_CLOSING_SOLO_PRO, pasarAPro: await rutaConWs\(RUTA_CAMBIAR_PLAN\) \},\n {4}\{ status: 403/);
  // Las cinco rutas de la hoja pasan por la puerta.
  for (const r of ['llamada', 'sync', 'analyze', 'revise', 'transcript']) {
    assert.match(fuente(`app/api/closing/${r}/route.ts`), /const cerrada = await puertaClosing\(\{ fathom: (true|false) \}\);/, r);
  }
  const lead = fuente('app/api/closing/analizar-lead/route.ts');
  const post = lead.slice(lead.indexOf('export async function POST'));
  assert.match(post, /^export async function POST\(req: NextRequest\) \{\n[^\n]*\n {2}const pro = await candadoDeProClosing\(\);\n {2}if \(pro\) return pro;/,
    'lo primero, antes de gastar nada');
  assert.doesNotMatch(lead, /puertaClosing\(/, 'la puerta de la hoja NO (su regla de rol es otra: la del CRM)');
});

test('6. la API de MaKo: todo el área closing con el candado, menos las grabaciones del CRM', () => {
  const run = fuente('lib/api-mako/areas/closing.run.ts');
  assert.match(run, /export const RUNNERS: Runners = conCandadoDePro\(\{\n/);
  assert.match(run, /\n\}\);\n?$/, 'el objeto entero adentro del envoltorio');
  const env = run.slice(run.indexOf('function conCandadoDePro('), run.indexOf('export const RUNNERS'));
  assert.match(env, /const cerrado = async \(ctx: Ctx\): Promise<boolean> => esEsencialDe\(ctx\.ws\);/, 'el negocio del token (por la API no hay sesión)');
  assert.match(env, /if \(OPERACIONES_CLOSING_ABIERTAS\.has\(id\)\) \{ out\[id\] = r; continue; \}/);
  assert.match(env, /leer: async \(i, ctx\) => \(\(await cerrado\(ctx\)\) \? error\(TEXTO_CLOSING_SOLO_PRO\) : r\.leer\(i, ctx\)\)/);
  assert.match(env, /\? \{ error: TEXTO_CLOSING_SOLO_PRO \} : a\.preparar!\(i, ctx\)/, 'al proponer');
  assert.match(env, /ejecutar: async \(p, ctx\) => \(\(await cerrado\(ctx\)\) \? \{ ok: false, resumen: TEXTO_CLOSING_SOLO_PRO \} : a\.ejecutar\(p, ctx\)\)/, 'y al confirmar');
  // Las que quedan abiertas existen en el área (un nombre mal escrito dejaría abierta una que no es) y son las del CRM.
  const def = fuente('lib/api-mako/areas/closing.def.ts');
  const ids = [...def.matchAll(/id: '([a-z_]+)', area: 'closing'/g)].map((m) => m[1]);
  assert.ok(ids.length >= 15, `el área tiene sus operaciones (${ids.length})`);
  for (const id of OPERACIONES_CLOSING_ABIERTAS) assert.ok(ids.includes(id), `${id} es del área`);
  assert.deepEqual([...OPERACIONES_CLOSING_ABIERTAS].sort(), ['adjuntar_grabaciones_fathom', 'como_termino_grabacion', 'grabaciones_en_mako_de_un_lead']);
  // Lo que es el ANÁLISIS queda cerrado (las del panorama, una llamada, su transcript, analizar y corregir).
  for (const id of ['panorama_closing', 'detalle_llamada', 'transcript_llamada', 'analizar_llamadas_lead', 'corregir_puntajes_llamada', 'llamadas_lead']) {
    assert.ok(ids.includes(id) && !OPERACIONES_CLOSING_ABIERTAS.has(id), id);
  }
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (14/11/2026; una rotura por vez, restaurada con el archivo de antes y comparada; base 6/0, 6 de 6):
//   · la página sin `esencial && esHojaClosing(hoja)` (los datos viajan en el HTML)          → 2
//   · el efecto de datos sin `|| cerradaPorPlan`                                            → 3
//   · el lienzo sin la rama del candado                                                     → 3
//   · la puerta de /api/closing sin `candadoDeProClosing()`                                 → 5
//   · closing.run.ts sin el envoltorio (`export const RUNNERS: Runners = {`)                → 6
//   · `detalle_llamada` sumada a las abiertas                                               → 6
// =============================================================================
