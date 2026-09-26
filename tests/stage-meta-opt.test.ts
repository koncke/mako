import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageMeta, stageMetaOpt, type Stage } from '../lib/pipeline';

// El historial guardaba la ETIQUETA de la etapa en vez de la KEY, y stageMeta ante
// un valor desconocido cae a la 1ª etapa. Resultado: todo el recorrido de un lead se
// pintaba "Lead (Instant form) → Lead (Instant form)". La ficha usa stageMetaOpt,
// que NO inventa: si no reconoce el valor devuelve undefined y se muestra crudo.

const FUNNEL: Stage[] = [
  { key: 'lead', label: 'Lead (Instant form)', dot: '#2F6DDB', tone: 'info', band: 'pipeline', kind: 'entrada', col: 0 },
  { key: 'agenda', label: 'Agenda R1', dot: '#E08A12', tone: 'accent', band: 'pipeline', kind: 'reunion', col: 1 },
] as unknown as Stage[];

test('stageMetaOpt resuelve una key del funnel del workspace', () => {
  assert.equal(stageMetaOpt(FUNNEL, 'agenda')?.label, 'Agenda R1');
});

test('stageMetaOpt resuelve keys de nutrición que el funnel no lista', () => {
  // noshow_r1 no está en funnels.data.pipeline: vive en las libs.
  assert.equal(stageMetaOpt(FUNNEL, 'noshow_r1')?.label, 'Nutrición No Show R1');
});

test('stageMetaOpt NO inventa una etapa cuando el valor es desconocido', () => {
  assert.equal(stageMetaOpt(FUNNEL, 'Agenda R1'), undefined); // etiqueta, no key
  assert.equal(stageMetaOpt(FUNNEL, 'basura'), undefined);
});

test('stageMeta sigue dando un default para los chips del tablero', () => {
  assert.equal(stageMeta(FUNNEL, 'basura').key, 'lead');
});
