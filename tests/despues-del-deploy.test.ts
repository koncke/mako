// =============================================================================
// .github/workflows/despues-del-deploy.yml: qué job corre con cada evento de Vercel, y que los pasos hagan lo que dicen.
// =============================================================================
// Se EVALÚA la condición de cada job contra eventos de ejemplo (tests/_workflow.ts) y se CORRE el script de cada paso en bash.
// Probado rompiéndolo (4/11/2026): sacando el `contains(..., 'production')` del camino de deployment_status, «un deploy de
// preview que falla no da rojo» cae; cambiando el `exit 1` de «El deploy de producción falló» por `exit 0`, cae «queda una
// corrida ROJA»; con `[ "$eventos" = "0" ]` invertido en el vigía, caen los dos casos del vigía.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corre, correrPaso, evaluar, leerWorkflow } from './_workflow';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const YML = leerWorkflow(RAIZ, 'despues-del-deploy.yml');
const hayBash = !spawnSync('bash', ['-c', 'exit 0']).error;

const despacho = (action: string, environment: string) => ({ event_name: 'repository_dispatch', event: { action, client_payload: { environment, url: 'https://mako-x.vercel.app', git: { sha: 'abc123' } } } });
const estado = (state: string, environment: string) => ({ event_name: 'deployment_status', event: { deployment_status: { state, target_url: 'https://vercel.com/x' }, deployment: { environment, sha: 'abc123' } } });

test('el evaluador de condiciones entiende lo que usa el workflow (y tira con lo que no)', () => {
  assert.equal(evaluar("contains(github.x, 'production')", { github: { x: 'Production – mako' } }), true, 'contains no distingue mayúsculas, como GitHub');
  assert.equal(evaluar("contains(github.x, 'production')", { github: {} }), false, 'lo que falta es null');
  assert.equal(evaluar("github.a == 'b' || (github.c && !github.d)", { github: { a: 'z', c: 1, d: 0 } }), true);
  assert.throws(() => evaluar('fromJSON(github.x)', { github: {} }), /no conoce/);
});

test('un deploy de PRODUCCIÓN que falla, por cualquiera de los dos caminos, corre deploy-fallido y no el humo', () => {
  for (const ev of [despacho('vercel.deployment.error', 'production'), despacho('vercel.deployment.failed', 'production'), estado('failure', 'Production'), estado('error', 'Production – mako')]) {
    assert.equal(corre(YML, 'deploy-fallido', ev), true, JSON.stringify(ev));
    assert.equal(corre(YML, 'humo', ev), false);
    assert.equal(corre(YML, 'vigia', ev), false);
  }
});

test('un deploy de preview que falla no da rojo (no es producción)', () => {
  for (const ev of [despacho('vercel.deployment.error', 'preview'), estado('failure', 'Preview')]) assert.equal(corre(YML, 'deploy-fallido', ev), false, JSON.stringify(ev));
});

test('un deploy de producción que sale bien corre el humo; uno pendiente o de preview, nada', () => {
  for (const ev of [despacho('vercel.deployment.success', 'production'), despacho('vercel.deployment.promoted', 'production'), estado('success', 'Production')]) {
    assert.equal(corre(YML, 'humo', ev), true, JSON.stringify(ev));
    assert.equal(corre(YML, 'deploy-fallido', ev), false);
  }
  for (const ev of [estado('pending', 'Production'), estado('in_progress', 'Production'), estado('success', 'Preview'), despacho('vercel.deployment.success', 'preview'), despacho('vercel.deployment.canceled', 'production')]) {
    assert.equal(corre(YML, 'humo', ev) || corre(YML, 'deploy-fallido', ev), false, JSON.stringify(ev));
  }
});

test('el horario corre el humo y el vigía; nunca el aviso de deploy fallido', () => {
  const ev = { event_name: 'schedule', event: {} };
  assert.equal(corre(YML, 'humo', ev), true);
  assert.equal(corre(YML, 'vigia', ev), true);
  assert.equal(corre(YML, 'deploy-fallido', ev), false);
});

test('el paso del deploy fallido deja una corrida ROJA, con el commit en el resumen', { skip: !hayBash && 'sin bash' }, () => {
  const r = correrPaso(YML, 'El deploy de producción falló', { env: { EVENTO: 'repository_dispatch', ACCION: 'vercel.deployment.error', SHA: 'abc123', URL_DEPLOY: 'https://mako-x.vercel.app', PAYLOAD: '{}' } });
  assert.equal(r.codigo, 1, r.salida);
  assert.match(r.salida, /::error::El deploy de producción del commit abc123 falló/);
  assert.match(r.resumen, /abc123/);
});

/** `gh` de mentira: commits en main y corridas por evento, como los contesta la API. */
const ghQue = (commits: number, porEvento: number) => `gh() { case "$*" in *commits*) echo ${commits};; *) echo ${porEvento};; esac; }`;

test('el vigía da rojo si main recibió commits y no llegó ni un evento de Vercel; si llegan, o no hubo commits, verde', { skip: !hayBash && 'sin bash' }, () => {
  const env = { GH_TOKEN: 'x', REPO: 'koncke/mako' };
  const ciego = correrPaso(YML, '¿Llegan los eventos de Vercel?', { antes: ghQue(3, 0), env });
  assert.equal(ciego.codigo, 1, ciego.salida);
  assert.match(ciego.salida, /el aviso de deploy fallido está ciego/);
  assert.equal(correrPaso(YML, '¿Llegan los eventos de Vercel?', { antes: ghQue(3, 2), env }).codigo, 0);
  assert.equal(correrPaso(YML, '¿Llegan los eventos de Vercel?', { antes: ghQue(0, 0), env }).codigo, 0);
});
