// El lead 2371 de Mauricio (27/10/2026): «ganado» con la tarjeta en «Perdido», y Customer Success lo contaba como
// cliente. El tablero lee la columna guardada (`pipeline_stage`) y Customer Success, Revenue y las métricas leen
// `estado_lead`: un camino que gana sin mover la tarjeta (el plan de pagos, el alta de un alumno con «usar ese», un
// `updateLead` con el estado) los dejaba diciendo dos cosas. La regla: el estado que cambia sin elegir columna vuelve la
// tarjeta a la derivación, que sale del estado (docs/hallazgos-crm.md, «Ganado con la tarjeta en Perdido»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveStageKey, etapaContradiceElEstado } from '../lib/pipeline';

const raiz = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const fuente = (p: string) => sinComentarios(readFileSync(join(raiz, p), 'utf8'));

test('ganado con la columna de Perdido contradice (el 2371)', () => {
  assert.equal(etapaContradiceElEstado('perdido', 'ganado'), true);
});

test('una etapa abierta guardada con el lead cerrado contradice; con el lead abierto, no', () => {
  assert.equal(etapaContradiceElEstado('agenda', 'ganado'), true);
  assert.equal(etapaContradiceElEstado('facturando', 'perdido'), true);
  assert.equal(etapaContradiceElEstado('agenda', 'abierto'), false);
  assert.equal(etapaContradiceElEstado('st_propia_3', 'abierto'), false);
});

test('un cierre guardado con el lead reabierto contradice', () => {
  assert.equal(etapaContradiceElEstado('ganado', 'abierto'), true);
  assert.equal(etapaContradiceElEstado('noresp', 'abierto'), true);
});

test('la columna que coincide con el estado, o ninguna columna, no contradice', () => {
  assert.equal(etapaContradiceElEstado('ganado', 'ganado'), false);
  assert.equal(etapaContradiceElEstado('perdido', 'perdido'), false);
  assert.equal(etapaContradiceElEstado('descal', 'descalificado'), false);
  assert.equal(etapaContradiceElEstado(null, 'ganado'), false);
  assert.equal(etapaContradiceElEstado('  ', 'ganado'), false);
});

test('sin la columna, la tarjeta deriva del estado nuevo: un ganado cae en Ganado', () => {
  assert.equal(deriveStageKey({ estado_lead: 'ganado', pipeline_stage: null } as Parameters<typeof deriveStageKey>[0]), 'ganado');
});

test('updateLead vuelve la columna a la derivación cuando el estado cambia y la contradice', () => {
  const s = fuente('lib/leads.ts');
  const cuerpo = s.slice(s.indexOf('export async function updateLead('), s.indexOf('export async function completarLeadVacios') > 0 ? s.indexOf('export async function completarLeadVacios') : undefined);
  assert.match(cuerpo, /merged\.estado_lead !== actual\.estado_lead && etapaContradiceElEstado\(actual\.pipeline_stage, merged\.estado_lead\)/);
  assert.match(cuerpo, /\{ pipeline_stage: null \}/);
});

test('setPipelineStage escribe su columna él mismo: avisa con etapaAparte', () => {
  const s = fuente('lib/leads.ts');
  assert.match(s, /await updateLead\(id, sync, \{ etapaAparte: true \}\)/);
});

test('el Deshacer de un movimiento con su Etapa también la escribe aparte', () => {
  assert.match(fuente('app/crm/actions.ts'), /updateLead\(leadId, upd, \{ desenlaceExacto, etapaAparte: etapa\.set \}\)/);
});

test('el plan de pagos, que gana sin pasar por updateLead, también suelta la columna que lo contradice', () => {
  const s = fuente('lib/pagos.ts');
  assert.match(s, /select\('estado_lead, funnel_id, fecha_cierre, pipeline_stage'\)/);
  assert.match(s, /previa\.estado_lead !== 'ganado' && etapaContradiceElEstado\(previa\.pipeline_stage, 'ganado'\)\) leadUpdate\.pipeline_stage = null/);
});
