// =============================================================================
// #886, la mitad del Web Generator: el análisis de una landing lee lo más tocado del mapa de calor (17/10/2026)
// =============================================================================
// Martín, revisión del 16/10 (1:29:51): «que lo que recién vimos en dashboard del template de landing se combine con
// esta funcionalidad del feedback de la estructura que te da Web Generator, que vivan ambos lugares». La mitad del
// Dashboard ya estaba (el mapa lleva «Analizar la estructura →»). Ésta: el análisis (el del Diagnóstico y el del Landing
// Analyst, `analizarCopy`) suma al comportamiento lo más tocado de la página, por aparato, y el Diagnóstico lleva a la
// hoja «Landing» del Dashboard («Ver el tráfico →»).
//
// PROBADO ROMPIÉNDOLO (17/10/2026): lineasMasTocado sin el tope → 1 fallo; el análisis sin lo más tocado → 1 fallo; lo
// tocado fuera del bloque no confiable → 1 fallo; el Diagnóstico sin el link → 1 fallo. Base: 3 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lineasMasTocado, type FilaRanking } from '../lib/landing-mapa';
import { rotuloDe } from '../lib/landing-mapa-rotulo';
import { HREF_TRAFICO_LANDING } from '../lib/landing-estructura-enlace';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fila = (etiqueta: string, personas: number, toques: number): FilaRanking => ({ clave: `et:click:${etiqueta}`, etiqueta, sel: null, toques, personas });

test('lo más tocado en una línea por aparato, con personas y toques, y con tope', () => {
  const rot = (f: FilaRanking) => rotuloDe({ tipo: 'click', etiqueta: f.etiqueta });
  const movil = [fila('boton: Agenda tu llamada', 12, 15), fila('boton: Ver precios', 1, 1), ...Array.from({ length: 6 }, (_, i) => fila(`boton: Otro ${i}`, 1, 1))];
  const l = lineasMasTocado({ movil, escritorio: [] }, rot, 2);
  assert.deepEqual(l, ['En el celular: «Agenda tu llamada» (12 personas, 15 toques) · «Ver precios» (1 persona, 1 toque)']);
  assert.deepEqual(lineasMasTocado({ movil: [], escritorio: [] }, rot), [], 'sin toques, nada');
  assert.equal(lineasMasTocado({ movil: [], escritorio: [fila('boton: Comprar', 3, 4)] }, rot)[0], 'En la computadora: «Comprar» (3 personas, 4 toques)');
});

test('el análisis suma lo más tocado al comportamiento, delimitado como no confiable, y sin frenarse', () => {
  const src = sinComentarios(leer('lib/landing-analyst.ts'));
  assert.match(src, /const tocado = comp\.hay_datos \? await masTocadoParaElAnalisis\(pagina\.url\) : \[\];/);
  assert.match(src, /buildUserPrompt\(pagina, comp, tocado\)/);
  assert.match(src, /comportamiento: comportamientoConToques\(comp, tocado\),/);
  assert.match(src, /contenidoNoConfiable\(tocado\.join\('\\n'\), 'mas_tocado'\)/, 'los textos de los botones son de la página: no confiables');
  assert.match(src, /setTimeout\(\(\) => ok\(null\), PLAZO_MAS_TOCADO_MS\)/, 'con plazo: es un plus, no frena el análisis');
  const mapa = sinComentarios(leer('lib/landing-mapa-server.ts'));
  assert.match(mapa, /if \(llaveDe\(url\) !== llave\) return;/, 'la página por la llave con que se analiza');
});

test('el Diagnóstico lleva al tráfico de la página (la hoja Landing del Dashboard)', () => {
  assert.equal(HREF_TRAFICO_LANDING, '/dashboard?hoja=landing');
  const panel = sinComentarios(leer('app/web-generator/diagnostico/PanelDiagnostico.tsx'));
  assert.match(panel, /<Link href=\{HREF_TRAFICO_LANDING\}[^>]*>Ver el tráfico →<\/Link>/);
});
