// =============================================================================
// Editor de landings — la integración de la tanda 2 (12/10/2026) y el feedback de una prueba real
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, diez puntos: docs/diseno-editor-landing.md → «Tanda 2») y su
// feedback del 12/10/2026 sobre una prueba con un cliente, textual en fragmentos: «pidieron una landing
// page… y te lo creó tipo presentación diapositiva, no te lo creó como si fuera una landing» y «se buguea
// cuando estoy en la vista de editar… en el sidebar de secciones, principalmente en la vista que dice
// tira de imágenes... en la vista de lista no».
//
// Lo que este archivo fija (lo que cada paquete dejó como PEDIDO y cerró la integración):
//   1. Una LANDING es una página continua: secciones a sangre, sin radio ni sombra, pegadas (css.ts,
//      15c), también en el celular; las tarjetas con aire son sólo de una presentación. Los controles de
//      la sección (estilos-nodos.ts) van adentro, como en una sección de ancho completo.
//   2. La tira de miniaturas no se realimenta: `scrollbar-gutter: stable`, el alto se conserva mientras
//      una imagen se decodifica, y la miniatura de una presentación lleva el formato en el padre.
//   3. El formato viaja en cada pedido de edición a la IA (Panel del agente y Ask Agent).
//   4. /l/html en el dominio de un cliente sirve sólo los bloques de SU landing, nunca el borrador.
//   5. El dominio propio se suelta de Vercel al borrar una landing y al vaciar un workspace.
//   6. Leer y borrar los diagnósticos de /api/landing-analyst/view es sólo de un admin.
//
// La hoja es un STRING (se sirve dentro de un <style>): se pregunta sobre lo EMITIDO, CSS_CONTENIDO.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://proyecto.supabase.co';

import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { CSS_NODOS } from '../app/web-generator/editor/extensiones/estilos-nodos';
import { altoDeMiniatura, hayImagenSinCargar } from '../app/web-generator/editor/TiraSecciones';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO (un `/*` adentro de un `//` abre un bloque falso)
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** Las declaraciones de la regla cuyo selector es EXACTAMENTE `sel` (la primera), o null. */
function decl(css: string, sel: string): string | null {
  const i = css.indexOf(sel + ' { ');
  if (i < 0) return null;
  const ini = i + sel.length + 3;
  return css.slice(ini, css.indexOf(' }', ini));
}

const PAG = ':not([data-formato="presentacion"]) > .gm-doc:not([data-formato="presentacion"])';

// ── 1 · Una landing es una página continua ───────────────────────────────────────────────────

test('página: las secciones van a sangre (100%, sin margen, radio ni sombra) y sólo fuera de una presentación', () => {
  const tarjeta = decl(CSS_CONTENIDO, PAG + ' .gm-pagina > .gm-tarjeta');
  assert.ok(tarjeta, 'falta la regla de la sección a sangre');
  assert.match(tarjeta!, /width: 100%; margin: 0;/);
  assert.match(tarjeta!, /--gm-radio-tarjeta: 0px;/);
  assert.match(tarjeta!, /--gm-tarjeta-sombra: 0 0 #0000;/);
  assert.match(decl(CSS_CONTENIDO, PAG + ' .gm-pagina') ?? '', /padding-bottom: 0;/);
  // El ancho de la sección se vuelve el ancho del CONTENIDO (padding), con los tres anchos de la hoja.
  assert.match(decl(CSS_CONTENIDO, PAG + ' .gm-pagina > .gm-tarjeta:not([data-ancho="completo"])') ?? '', /padding-inline: max\(0px, calc\(\(100% - 64\.5em\) \/ 2\)\);/);
  assert.match(decl(CSS_CONTENIDO, PAG + ' .gm-pagina > .gm-tarjeta[data-ancho="angosto"]') ?? '', /100% - 48em/);
  assert.match(decl(CSS_CONTENIDO, PAG + ' .gm-pagina > .gm-tarjeta[data-ancho="amplio"]') ?? '', /100% - 84em/);
  // Pesa igual que `:not(completo) + completo` del bloque 2 (que vuelve a poner 3.5em de aire): gana por ir DESPUÉS.
  const aire = CSS_CONTENIDO.indexOf('.gm-doc .gm-tarjeta:not([data-ancho="completo"]) + .gm-tarjeta[data-ancho="completo"] {');
  assert.ok(aire >= 0 && CSS_CONTENIDO.indexOf(PAG + ' .gm-pagina > .gm-tarjeta {') > aire, 'la regla de la página tiene que ir después de la del aire');
  // Y una presentación conserva su diapositiva: la regla de 15b sigue con su aire y su proporción.
  assert.match(CSS_CONTENIDO, /\.gm-doc\[data-formato="presentacion"\]:not\(\[data-proporcion="fluido"\]\) \.gm-tarjeta,\n\[data-formato="presentacion"\]:not\(\[data-proporcion="fluido"\]\) > \.gm-doc \.gm-tarjeta \{ width: min\(64\.5em, calc\(100% - 4em\)\); min-height: auto; margin-top: 3\.5em; aspect-ratio: 16 \/ 9;/);
});

test('página: también a sangre en el celular, con el prefijo de la vista previa y el de la media query', () => {
  for (const p of ['.gm-doc', '.gm-doc[data-dispositivo="movil"]']) {
    const pag = ':not([data-formato="presentacion"]) > ' + p + ':not([data-formato="presentacion"])';
    const aire = CSS_CONTENIDO.lastIndexOf(p + ' .gm-tarjeta:not([data-ancho="completo"]) + .gm-tarjeta[data-ancho="completo"] {');
    const propia = CSS_CONTENIDO.lastIndexOf(pag + ' .gm-pagina > .gm-tarjeta {');
    assert.ok(aire >= 0, `falta la regla de celular de ${p}`);
    assert.ok(propia > aire, `${p}: la sección a sangre tiene que ir DESPUÉS del aire de celular`);
    assert.match(decl(CSS_CONTENIDO.slice(propia), pag + ' .gm-pagina > .gm-tarjeta') ?? '', /width: 100%; margin: 0;/);
  }
});

test('miniatura: sin esmerilado (una capa de GPU por miniatura adentro de un scale)', () => {
  assert.match(CSS_CONTENIDO, /\.gm-doc\[data-modo="miniatura"\] \.gm-tarjeta-fondo,\n\.gm-doc\[data-modo="miniatura"\] \.gm-acento::after \{ -webkit-backdrop-filter: none; backdrop-filter: none; \}/);
});

test('editor: en una landing los controles de la sección van ADENTRO (como en una de ancho completo)', () => {
  const lado = CSS_NODOS.split('\n').find((l) => l.includes('> .gmc-lado, [data-dispositivo="movil"]'));
  assert.ok(lado && lado.includes('.gm-doc:not([data-formato="presentacion"]) .gm-tarjeta > .gmc-lado') && /left: 12px; top: 12px;/.test(lado));
  const entre = CSS_NODOS.split('\n').find((l) => l.includes('> .gmc-entre { height: 1.6em'));
  assert.ok(entre && entre.includes('.gm-doc:not([data-formato="presentacion"]) .gm-tarjeta > .gmc-entre'));
  // La barra de la sección activa va ADENTRO, pegada abajo: centrada sobre el borde, su mitad de abajo
  // quedaba tapada por la sección siguiente (cada sección lleva `isolation: isolate`, así que su
  // z-index no le gana a la vecina). Y la activa sube de capa (12/10/2026, «Se oculta y no se ven
  // los botones»).
  const mini = CSS_NODOS.split('\n').find((l) => l.includes('> .gmc-mini { top: auto; bottom: 0.75em; transform: translate(-50%, 0)'));
  assert.ok(mini && mini.includes('.gm-doc:not([data-formato="presentacion"]) .gm-tarjeta > .gmc-mini'));
  assert.ok(CSS_NODOS.includes('.gm-doc:not([data-formato="presentacion"]) .gm-tarjeta[data-activa="si"] { z-index: 3; }'), 'la activa sube de capa');
  assert.ok(!CSS_NODOS.includes('> .gmc-mini { transform: translate(-50%, -50%)'), 'la barra no vuelve al borde');
});

// ── 2 · La tira de miniaturas ────────────────────────────────────────────────────────────────

test('tira: el lugar de la barra de scroll va reservado (el ancho no depende de si hay barra)', () => {
  const css = leer('app/web-generator/gamma.css');
  const i = css.indexOf('.gma-tira-lista {');
  assert.ok(i >= 0);
  assert.match(sinComentarios(css.slice(i, css.indexOf('}', i))), /scrollbar-gutter: stable;/);
});

test('tira: con una imagen sin cargar no se mide (conserva el alto) y el load/error vuelve a medir', () => {
  assert.equal(hayImagenSinCargar({ querySelectorAll: () => [{ complete: true }, { complete: false }] }), true);
  assert.equal(hayImagenSinCargar({ querySelectorAll: () => [{ complete: true }] }), false);
  assert.equal(hayImagenSinCargar({ querySelectorAll: () => [] }), false);
  assert.equal(altoDeMiniatura(1000, 0.17), 170);
  assert.equal(altoDeMiniatura(5000, 0.17), 180, 'tope');
  assert.equal(altoDeMiniatura(10, 0.17), 24, 'piso');
  const src = sinComentarios(leer('app/web-generator/editor/TiraSecciones.tsx'));
  const medir = src.slice(src.indexOf('const medir = () => {'), src.indexOf('medir();'));
  assert.ok(medir.indexOf('hayImagenSinCargar(escala)') >= 0 && medir.indexOf('hayImagenSinCargar(escala)') < medir.indexOf('altoDeMiniatura(escala.offsetHeight, k)'),
    'se pregunta por las imágenes ANTES de medir');
  assert.match(medir, /if \(hayImagenSinCargar\(escala\)\) \{\s*setMedida\(\(m\) => \(Math\.abs\(m\.k - k\) < 0\.0005 \? m : \{ k, alto: m\.alto \}\)\);\s*return;/);
  assert.match(src, /escala\.addEventListener\('load', medir, true\);/);
  assert.match(src, /escala\.addEventListener\('error', medir, true\);/);
});

test('tira: la miniatura de una presentación lleva el formato en el padre del .gm-doc, y dice «diapositiva»', () => {
  const src = sinComentarios(leer('app/web-generator/editor/TiraSecciones.tsx'));
  assert.match(src, /className="gma-mini-escala"\s*data-formato=\{formato\}\s*data-proporcion=\{formato \? proporcion : undefined\}/);
  assert.match(src, /<Miniatura html=\{it\.html\} formato=\{formatoMini\} proporcion=\{proporcionMini\} \/>/);
  assert.match(src, /const formatoMini = esPresentacion\(config\) \? 'presentacion' as const : undefined;/);
  assert.doesNotMatch(src, /'Sección (movida|eliminada|copiada|visible|oculta)'|Agregar sección|tira de diapositivas"/, 'la palabra sale de terminoTarjeta');
});

// ── 3 · El formato en los pedidos de edición a la IA ─────────────────────────────────────────

test('IA: el Panel del agente y el Ask Agent mandan params.formato al editar', () => {
  const panel = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(panel, /pedirIA\(\{ accion: 'editar', [^}]*params: \{ formato: formatoDe\(ctx\.config\) \} \}/);
  const ask = sinComentarios(leer('app/web-generator/editor/AskAgent.tsx'));
  assert.match(ask, /pedirIA\(\{ accion: 'editar', [^}]*params: \{ formato: formatoDe\(ctxRef\.current\.config\) \} \}/);
});

// ── 4 · /l/html en el dominio de un cliente ──────────────────────────────────────────────────

test('/l/html: en un dominio de cliente sólo los bloques de SU landing, y nunca el borrador', () => {
  const src = sinComentarios(leer('app/l/html/[docId]/[bloque]/route.ts'));
  assert.match(src, /import \{ landingDeDominio \} from '@\/lib\/editor-landing\/dominios';/);
  const esDel = src.slice(src.indexOf('async function esDelDominio'), src.indexOf('export async function GET'));
  assert.match(esDel, /if \(crudo == null\) return true;/);
  assert.match(esDel, /return !!landing && String\(landing\.docId\) === docId;/);
  const get = src.slice(src.indexOf('export async function GET'));
  assert.match(get, /const vista = enDominio \? null : req\.nextUrl\.searchParams\.get\('vista'\);/);
  assert.match(get, /if \(!RE_DOC_ID\.test\(docId\) \|\| !\(await esDelDominio\(req, docId\)\)\) return null;/);
});

// ── 5 · El dominio propio se suelta de Vercel ────────────────────────────────────────────────

// Revisión de la tanda 2 (12/10/2026, BAJA): ANTES se soltaba DESPUÉS de borrar la fila, y en el hueco
// otra cuenta podía reclamarlo y el DELETE se lo sacaba del proyecto. Ahora va ANTES, como en
// `quitarDominio`, con la marca de la fila, y si Vercel falla la landing no se borra. La lectura sólo
// tolera la columna que falta (42703): «no pude leer» no es «no tiene dominio». Probado rompiéndolo
// (restauración de memoria, base 11 / 0): borrar sigue aunque Vercel falle → 10 / 1; vaciarTablas
// calla el error de lectura → 10 / 1.
test('dominio: se suelta de Vercel ANTES de borrar la landing y ANTES de vaciar las tablas de un workspace', () => {
  const srv = sinComentarios(leer('lib/editor-landing/server.ts'));
  const borrar = srv.slice(srv.indexOf('export async function borrar('), srv.indexOf('export async function versiones('));
  const del = borrar.indexOf('.delete()');
  const soltar = borrar.indexOf('await soltarDominioDeVercel(fd.dominio, fd.dominio_agregado_por_mako);');
  assert.ok(soltar > 0 && del > soltar, 'el dominio se suelta antes del delete');
  assert.match(borrar, /catch \(e\) \{[\s\S]{0,200}?return falla\('No pude soltar el dominio propio de esta landing\. Vuelve a intentar\.', 502\);/, 'si Vercel falla, no se borra');
  assert.match(borrar, /if \(eDominio && \(eDominio as \{ code\?: string \}\)\.code !== '42703'\) return falla\(/);
  const reset = sinComentarios(leer('lib/reset-workspace.ts'));
  const vaciar = reset.slice(reset.indexOf('export async function vaciarTablas'));
  const sv = vaciar.indexOf('soltarDominioDeVercel(f.dominio, f.dominio_agregado_por_mako)');
  assert.ok(sv > 0 && sv < vaciar.indexOf('for (let pasada = 0;'), 'antes de borrar las filas');
  assert.match(vaciar, /if \(error && \(error as \{ code\?: string \}\)\.code !== '42703'\) \{\s*avisos\.push\(/, 'un error de lectura se avisa');
});

// ── 6 · Los diagnósticos de afuera son de un admin ───────────────────────────────────────────

test('/api/landing-analyst/view: leer y borrar los diagnósticos es sólo de un admin', () => {
  const src = sinComentarios(leer('app/api/landing-analyst/view/route.ts'));
  assert.match(src, /async function soloAdmin\(\): Promise<Response \| null> \{\s*if \(\(await getSesionAdmin\(\)\) == null && \(await getRolWsEfectivo\(\)\) !== 'admin'\)/);
  for (const m of ['GET()', 'DELETE(req: NextRequest)']) {
    const i = src.indexOf(`export async function ${m} {`);
    assert.ok(i >= 0, m);
    assert.match(src.slice(i, i + 160), /const cerrada = await soloAdmin\(\);\s*if \(cerrada\) return cerrada;/, `${m} sin puerta`);
  }
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (12/10/2026), una rotura por vez contra la base en verde de este archivo
// (11 pass / 0 fail), con un arnés que restaura DE MEMORIA y compara el sha256 (pass / fail):
//   · css: la sección de la página sin width:100%                         → 10 / 1
//   · css: la página aplica también a presentaciones (sin el :not)        →  9 / 2
//   · css: el bloque de la página ANTES del bloque 2 (pierde con el aire) → 10 / 1
//   · css: sin la regla de celular de la página                           → 10 / 1
//   · css: la miniatura con esmerilado                                    → 10 / 1
//   · controles: la columna de la sección afuera en una landing           → 10 / 1
//   · tira: sin scrollbar-gutter                                          → 10 / 1
//   · tira: mide aunque haya una imagen sin cargar                        → 10 / 1
//   · tira: hayImagenSinCargar mira sólo la primera imagen                → 10 / 1
//   · tira: sin el `load` en captura                                      → 10 / 1
//   · tira: la miniatura sin el formato en el padre                       → 10 / 1
//   · tira: vuelve «Agregar sección» fijo                                 → 10 / 1
//   · IA: el Panel del agente sin params.formato                          → 10 / 1
//   · IA: el Ask Agent sin params.formato                                 → 10 / 1
//   · /l/html: sin el corte del dominio                                   → 10 / 1
//   · /l/html: el borrador también en el dominio                          → 10 / 1
//   · /l/html: cualquier landing del dominio sirve (sin comparar el id)   → 10 / 1
//   · borrar: suelta el dominio ANTES del delete                          → 10 / 1
//   · reset: sin soltar los dominios                                      → 10 / 1
//   · view: el DELETE sin puerta                                          → 10 / 1
// Restaurado: 11 / 0. (Y la landing sin REGLAS_PAGINA en las secciones → 16 / 1 en
// tests/editor-landing-presentaciones.test.ts, que fija dónde viaja.)
// =============================================================================
