// =============================================================================
// «El AI Analyst termina un análisis»: el Evento de MaKo del Dashboard en Automations (13/10/2026)
// =============================================================================
// Pedido de Martín reenviado por Graphics: «mandale tarea al chat de chatbot para que se pueda configurar en
// automations y consumir esto». Lo emite el Dashboard (`analizarHoja`, lib/graficos-analisis-server.ts) con los datos
// de `valoresDelAnalisis`; sale SÓLO por la automatización que el negocio agrega de la galería («El AI Analyst Terminó»).
//
// PROBADO ROMPIÉNDOLO (13/10/2026), cada rotura de a una y restaurada de memoria. Pasan / fallan:
//   R1 los hallazgos sin tope (salen todos)                                         → 2 / 1
//   R2 un link que no es http(s) entra igual                                        → 2 / 1
//   R3 el evento trae el lead (`trae: ['lead', 'analisis']`)                        → 2 / 1
//
// Correr: node --import tsx --test tests/automations-analisis-dashboard.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valoresDelAnalisis, TOPE_HALLAZGOS_ANALISIS } from '../lib/variables-del-lead';
import { datosDelEvento } from '../lib/aviso-evento';
import { PLANTILLAS } from '../lib/plantillas-automatizaciones';

test('los datos del análisis: cada uno en su clave, sin valor no entra, los hallazgos con viñeta y con tope', () => {
  const v = valoresDelAnalisis({ hoja: ' Ventas ', resumen: 'Subieron.', hallazgos: ['a', '', 'b', 'c', 'd', 'e', 'f'], link: 'https://hola-mako.com/dashboard?hoja=1&ws=3' });
  assert.equal(v.analisis_hoja, 'Ventas');
  assert.equal(v.analisis_resumen, 'Subieron.');
  assert.equal(v.analisis_hallazgos.split('\n').length, TOPE_HALLAZGOS_ANALISIS);
  assert.ok(v.analisis_hallazgos.startsWith('• a\n• b'));
  assert.equal(v.analisis_link, 'https://hola-mako.com/dashboard?hoja=1&ws=3');
  assert.deepEqual(valoresDelAnalisis({ hoja: '', resumen: null, hallazgos: [], link: 'javascript:alert(1)' }), {}, 'un dato vacío o un link que no es web entró');
});

test('el evento no trae lead (el análisis es del negocio) y sí el análisis; su plantilla avisa al grupo con el link', () => {
  const ctx = datosDelEvento('analisis_listo');
  assert.equal(ctx.conLead, false);
  assert.equal(ctx.conAnalisis, true);
  const p = PLANTILLAS.find((x) => x.id === 'mako-analisis');
  assert.ok(p);
  assert.equal(p!.cron.evento, 'analisis_listo');
});

test('la plantilla cita los cuatro datos del análisis', () => {
  const p = PLANTILLAS.find((x) => x.id === 'mako-analisis')!;
  const texto = JSON.stringify(p.pasos);
  for (const k of ['analisis_hoja', 'analisis_resumen', 'analisis_hallazgos', 'analisis_link']) assert.ok(texto.includes(`{{${k}}}`), `falta {{${k}}}`);
});
