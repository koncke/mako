// =============================================================================
// .github/workflows/despues-del-deploy.yml: cuándo corre, y que los pasos hagan lo que dicen.
// =============================================================================
// Se EVALÚA la condición del job contra eventos de ejemplo (tests/_workflow.ts) y se CORRE el script de cada paso en bash, con un
// `gh` de mentira que contesta como la API.
// 6/11/2026 (los minutos de Actions, docs/hallazgos-infra.md): ya no escucha los eventos de Vercel (`deployment_status`,
// `repository_dispatch`): eran 623 corridas en seis días, casi todas sin nada que hacer. El deploy fallido lo lee por la API.
// PROBADO ROMPIÉNDOLO (6/11/2026; base 6 / 0). Pasan / fallan:
//   · volver a poner `deployment_status:` en el `on:`                                   → 5 / 1
//   · `failure|error)` cambiado por `failure)` (un deploy en «error» no da rojo)         → 5 / 1
//   · el `exit 1` de «¿Producción se actualiza?» cambiado por `exit 0`                     → 5 / 1
//   · el paso de los minutos sin `--alarma 80`                                            → 5 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corre, correrPaso, evaluar, leerWorkflow, scriptDelPaso } from './_workflow';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const YML = leerWorkflow(RAIZ, 'despues-del-deploy.yml');
const hayBash = !spawnSync('bash', ['-c', 'exit 0']).error;
const env = { GH_TOKEN: 'x', REPO: 'koncke/mako' };

/** Los disparadores del `on:` (las claves a 2 espacios, sin los comentarios). */
const disparadores = (yml: string) => {
  const l = yml.replace(/\r\n/g, '\n').split('\n').filter((x) => !/^\s*#/.test(x));
  const i = l.indexOf('on:');
  const fin = l.findIndex((x, k) => k > i && /^\S/.test(x));
  return l.slice(i + 1, fin).map((x) => /^ {2}([a-z_]+):/.exec(x)?.[1]).filter(Boolean);
};

test('el evaluador de condiciones entiende lo que usa el workflow (y tira con lo que no)', () => {
  assert.equal(evaluar("contains(github.x, 'production')", { github: { x: 'Production – mako' } }), true, 'contains no distingue mayúsculas, como GitHub');
  assert.equal(evaluar("contains(github.x, 'production')", { github: {} }), false, 'lo que falta es null');
  assert.equal(evaluar("github.a == 'b' || (github.c && !github.d)", { github: { a: 'z', c: 1, d: 0 } }), true);
  assert.throws(() => evaluar('fromJSON(github.x)', { github: {} }), /no conoce/);
});

test('corre sólo por horario o a mano: ningún evento de Vercel gasta una corrida', () => {
  assert.deepEqual(disparadores(YML), ['schedule', 'workflow_dispatch']);
  assert.match(YML, /cron: '37 11 \* \* \*'/, 'media hora después del despliegue diario de las 11:05 UTC');
  assert.equal(corre(YML, 'vigia', { event_name: 'schedule', event: {} }), true);
  assert.equal(corre(YML, 'vigia', { event_name: 'workflow_dispatch', event: {} }), true);
  assert.equal(corre(YML, 'vigia', { event_name: 'deployment_status', event: {} }), false);
  assert.match(scriptDelPaso(YML, '¿Cuántos minutos de Actions van este mes?'), /node scripts\/minutos-actions\.mjs .*--alarma 80/);
});

/** `gh` de mentira para el último deploy: la lista de deployments ya filtrada por el --jq, y su último estado. */
const ghDeploy = (dep: string, estado: string) => `gh() { case "$*" in *statuses*) echo "${estado}";; *deployments*) echo "${dep}";; esac; }`;
const ultimo = (dep: string, estado: string) => correrPaso(YML, 'El último deploy de producción', { antes: ghDeploy(dep, estado), env });

test('el último deploy de producción: failure o error dan una corrida ROJA con el commit; success o en curso, verde', { skip: !hayBash && 'sin bash' }, () => {
  for (const st of ['failure', 'error']) {
    const r = ultimo('7 abc123 2026-11-06T11:05:00Z', `${st} https://vercel.com/x`);
    assert.equal(r.codigo, 1, r.salida);
    assert.match(r.salida, /::error::El deploy de producción del commit abc123 falló/);
    assert.match(r.resumen, /abc123/);
  }
  for (const st of ['success https://vercel.com/x', 'in_progress', 'pending']) assert.equal(ultimo('7 abc123 2026-11-06T11:05:00Z', st).codigo, 0, st);
  assert.equal(ultimo('', '').codigo, 0, 'sin deploys en GitHub no hay nada que leer: lo mira el paso siguiente');
});

/** `gh` de mentira para «¿Producción se actualiza?»: commits viejos de main, deploys de producción, y si existe ci-rojo/main. */
const ghActualiza = (commits: number, deploys: number, rojo: boolean) =>
  `gh() { case "$*" in *ci-rojo*) ${rojo ? 'echo abc' : 'return 1'};; *commits*) echo ${commits};; *deployments*) echo ${deploys};; esac; }`;
const actualiza = (commits: number, deploys: number, rojo = false) => correrPaso(YML, '¿Producción se actualiza?', { antes: ghActualiza(commits, deploys, rojo), env });

test('¿producción se actualiza?: commits de hace más de un día y ningún deploy en 72 h es rojo, y dice si es por main rojo', { skip: !hayBash && 'sin bash' }, () => {
  const ciego = actualiza(3, 0);
  assert.equal(ciego.codigo, 1, ciego.salida);
  assert.match(ciego.salida, /Vercel dejó de escribirle los deploys a GitHub/);
  const frenado = actualiza(3, 0, true);
  assert.equal(frenado.codigo, 1, frenado.salida);
  assert.match(frenado.salida, /main está ROJO \(ci-rojo\/main\) y el despliegue diario está frenado/);
  assert.equal(actualiza(3, 1).codigo, 0);
  assert.equal(actualiza(0, 0).codigo, 0, 'sin commits no había nada que desplegar');
});

// ── La alarma de las redes de cada noche (4/11/2026) ─────────────────────────────────────────────────────────────────────
// `gh` de mentira: el último veredicto de cada red (una fecha, o nada) y los commits de main desde esa fecha.
// Probado rompiéndolo: con el `-ge "$limite"` cambiado por `-le`, un veredicto de hace 2 h da alarma; con `alarma=1` sacado, el
// rojo de 40 h no da rojo. Los dos casos caen.
const hace = (h: number) => new Date(Date.now() - h * 3600_000).toISOString().replace(/\.\d+Z$/, 'Z');
const ghRedes = (semanal: string, respaldo: string, commits: number) =>
  `gh() { case "$*" in *semanal-tests.yml*) echo "${semanal}";; *tipos-respaldo.yml*) echo "${respaldo}";; *commits*) echo ${commits};; esac; }`;
const redes = (semanal: string, respaldo: string, commits: number) =>
  correrPaso(YML, '¿Las redes de cada noche dan veredicto?', { antes: ghRedes(semanal, respaldo, commits), env: { GH_TOKEN: 'x', REPO: 'koncke/mako' } });

test('las redes: veredicto en las últimas 36 h, verde; 40 h sin veredicto con commits nuevos, rojo y dice cuál', { skip: !hayBash && 'sin bash' }, () => {
  assert.equal(redes(hace(2), hace(3), 5).codigo, 0, 'las dos dieron veredicto hace poco');
  const muda = redes(hace(40), hace(3), 5);
  assert.equal(muda.codigo, 1, muda.salida);
  assert.match(muda.salida, /::error::semanal-tests\.yml no da veredicto/);
  assert.doesNotMatch(muda.salida, /::error::tipos-respaldo/);
  const nunca = redes(hace(1), '', 2);
  assert.equal(nunca.codigo, 1, 'nunca dio veredicto y main se movió: también es muda');
});

test('las redes: 40 h sin veredicto pero main no se movió, no es alarma (no había nada que juzgar)', { skip: !hayBash && 'sin bash' }, () => {
  const r = redes(hace(40), hace(40), 0);
  assert.equal(r.codigo, 0, r.salida);
});
