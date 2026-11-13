// =============================================================================
// El retargeting corre en el negocio que se le pide, no en el de quien mira (13/11/2026)
// =============================================================================
// El CoPilot llama `verRetargeting(ws)` y `configurarRetargeting(ws, …)` con la ws de `wsDeAdsManager()`, que puede ser el super
// admin mirando a un cliente. La base y los ajustes se resuelven por el contexto, así que cada función se envuelve sola en
// `runWithWorkspace(ws, …)`: sin eso, prender los públicos de Leila los prendía en el negocio de MaKo.
//
// Correr: node --import tsx --test tests/retargeting-negocio.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
let corrida: Record<string, any> | null = null;
function R(): Record<string, any> {
  if (corrida) return corrida;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_retargeting-negocio-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  corrida = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  return corrida;
}

test('⛔ el super admin mirando a un cliente prende los públicos del CLIENTE, no los suyos', () => {
  assert.deepEqual(R().filas, [{ ws: 11, value: '{"publicosMeta":true}' }], 'el interruptor quedó en el negocio de quien mira');
  assert.equal(R().prender.publicosMeta.prendido, true);
  assert.equal(R().ver11.publicosMeta.prendido, true);
  assert.equal(R().ver9.publicosMeta.prendido, false, 'el negocio de quien mira no se tocó');
  assert.equal(R().ver11.publicosMeta.via, 'ninguna', 'sin conexión de Meta, lo dice y no rompe');
  assert.equal(R().ver11.ultimaRevision, null);
});
