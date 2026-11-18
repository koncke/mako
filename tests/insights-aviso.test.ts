// =============================================================================
// «Insights» del lead: qué le falta para generarse, dicho como lo pidió Martín (18/11/2026)
// =============================================================================
// Martín, 03/07/2026: «Que la sección se llame sólo "Insights", con Generar/Regenerar; si faltan datos, "No es posible
// generar hasta que…" y pedirlos con el wizard». La fila de docs/feedback-diseno-pendiente.md (re-medida el 18/11) decía:
// el rótulo seguía «Insights del lead», a un lead sin llamada nunca le aparecía el aviso (AnalystDelLead lo escondía) y
// el texto no existía. La regla es pura (app/crm/lead-view/insights-aviso.ts) y se EJECUTA; el cableado (la tarjeta la
// dibuja, la sección ya no se esconde) se mira en el fuente.
//
// Correr: node --import tsx --test tests/insights-aviso.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026, base 3/0), cada rotura restaurada antes de la siguiente:
//   · `avisoDeInsights` mirando la llamada antes que los datos (el wizard queda tapado)   → 2 / 1 («lo que frena»)
//   · el aviso de la llamada sólo sin un análisis previo (`!o.hayInsight &&`)            → 2 / 1 («lo que frena»)
//   · el error de la tarjeta sin «Reportar a Soporte»                                    → 2 / 1 («el cableado»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avisoDeInsights, TITULO_INSIGHTS } from '../app/crm/lead-view/insights-aviso';
import { marcasDeVoseo } from '../lib/voseo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (x: string) => x.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('el nombre de la sección es «Insights», a secas', () => {
  assert.equal(TITULO_INSIGHTS, 'Insights');
});

test('lo que frena: primero los datos, después la llamada; «generar» o «regenerar» según haya uno', () => {
  const base = { hayInsight: false, llamadas: 0, faltantes: 0, tieneFathom: false };
  // Un lead sin llamada (el caso que nunca veía el aviso): qué falta y qué hacer.
  const sin = avisoDeInsights(base);
  assert.equal(sin?.tipo, 'sin-llamada');
  assert.equal(sin?.texto, 'No es posible generar hasta que haya una llamada analizada.');
  assert.equal(sin?.tipo === 'sin-llamada' && sin.cargarFathom, true, 'sin el link de Fathom se ofrece cargarlo');
  const conLink = avisoDeInsights({ ...base, tieneFathom: true });
  assert.equal(conLink?.tipo === 'sin-llamada' && conLink.cargarFathom, false, 'con el link, no se ofrece cargarlo otra vez');
  // Datos que faltan: van PRIMERO (el wizard los completa), aunque tampoco haya llamada.
  assert.deepEqual(avisoDeInsights({ ...base, faltantes: 2 }), { tipo: 'faltan-datos', texto: 'No es posible generar hasta que completes los 2 datos que faltan.' });
  assert.equal(avisoDeInsights({ ...base, faltantes: 1, llamadas: 3 })?.texto, 'No es posible generar hasta que completes el dato que falta.');
  assert.equal(avisoDeInsights({ ...base, hayInsight: true, faltantes: 1, llamadas: 3 })?.texto, 'No es posible regenerar hasta que completes el dato que falta.');
  // Con un análisis de antes y la llamada desvinculada, también dice qué falta para regenerar.
  assert.equal(avisoDeInsights({ ...base, hayInsight: true })?.texto, 'No es posible regenerar hasta que haya una llamada analizada.');
  // Con llamada y sin datos que falten: nada frena (sale «Generar»).
  assert.equal(avisoDeInsights({ ...base, llamadas: 1 }), null);
  // Los textos, en español neutro con «tú» (la guarda del repo, ejecutada sobre lo que sale).
  for (const a of [sin, conLink, avisoDeInsights({ ...base, faltantes: 2 })]) {
    if (!a) continue;
    assert.deepEqual(marcasDeVoseo(a.texto), [], a.texto);
    if (a.tipo === 'sin-llamada') assert.deepEqual(marcasDeVoseo(a.detalle), [], a.detalle);
  }
});

test('el cableado: la tarjeta dibuja el aviso, la sección no se esconde y el error lleva «Reportar a Soporte»', () => {
  const tarjeta = sinComentarios(leer('app/crm/lead-view/GeneratedInsightCard.tsx'));
  assert.match(tarjeta, /const aviso = avisoDeInsights\(\{ hayInsight: !!insight, llamadas: llamadas\.length, faltantes: faltantes\.length, tieneFathom \}\);/);
  assert.match(tarjeta, /\{aviso\?\.tipo === 'faltan-datos' && \(/);
  assert.match(tarjeta, /\{aviso\?\.tipo === 'sin-llamada' && !fase && \(/);
  assert.match(tarjeta, /<span style=\{sectLabel\}>\{TITULO_INSIGHTS\}<\/span>/);
  assert.doesNotMatch(tarjeta, /Insights del lead/);
  assert.match(tarjeta, /<p role="alert"[^>]*>\{error\}<ReportarASoporte \/><\/p>/, 'un error de la tarjeta lleva «Reportar a Soporte» de último');
  const pieza = sinComentarios(leer('app/crm/lead-view/AnalystDelLead.tsx'));
  assert.doesNotMatch(pieza, /hayAnalisis|&& \(\s*<details/, 'la sección volvió a esconderse a un lead sin llamada');
});
