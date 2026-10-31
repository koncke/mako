// =============================================================================
// La clave de un negocio que es el crédito de Max de Martín, MARCADA (revisión del lote 2 de IA, 22/10/2026)
// =============================================================================
// Decisión del Cerebro, textual: «que no dependa del valor. Marcá la credencial del ws10 con una marca explícita… que se
// lee aunque la fila de la plataforma no exista. El tope de Haiku y el registro del costo salen de esa marca. La
// comparación por valor queda de respaldo. Test probado rompiéndolo: borrar la fila de la plataforma NO cambia lo que hace
// el ws10». Corre la puerta 2 real en tests/_credito-marca-hijo.ts.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_credito-marca-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@CREDITO@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@CREDITO@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}
const CREDITO_DEL_GASTO = /^⚠ crédito de Claude de la plataforma/;

test('reconocido por su valor, el crédito queda MARCADO (la huella, nunca la clave), va con Haiku y su gasto es del crédito', () => {
  const { A } = correr();
  assert.deepEqual(A.ws10.pedidos.map((p: { model: string }) => p.model), ['claude-haiku-4-5'], 'eligió Sonnet y es el crédito de Martín: Haiku');
  assert.match(A.gasto, CREDITO_DEL_GASTO, 'el gasto del crédito se anotó como del negocio (fuera del costo de MaKo, sin verse)');
  const marca = JSON.parse(A.marca ?? 'null');
  assert.equal(marca?.cuenta, 'ANTHROPIC_CREDITO_CUENTA2');
  assert.match(marca?.huella ?? '', /^[0-9a-f]{16}$/);
  assert.ok(!String(A.marca).includes('sk-ant'), 'la marca guarda la clave');
});

test('BORRADA la fila del crédito de la plataforma, el ws10 hace exactamente lo mismo', () => {
  const { A, B, claves } = correr();
  assert.deepEqual(B.ws10.pedidos, A.ws10.pedidos, 'sin la fila de la plataforma, el ws10 cambió de modelo o de clave');
  assert.equal(B.gasto, A.gasto, 'sin la fila de la plataforma, el gasto dejó de anotarse como del crédito');
  assert.deepEqual(B.plan.pedidos, [], 'su Plan pagó con el crédito de Martín');
  assert.deepEqual(B.planConSuClave, { suClave: false }, 'el Plan del ws10 cuenta el crédito como su clave');
  assert.equal(B.tarjeta, true, 'la tarjeta dejó de decir «sólo Haiku»');
  assert.equal(B.ws10.pedidos[0].clave, claves.CREDITO);
});

test('con la fila del crédito ILEGIBLE, la marca igual dice que es crédito; y la tarjeta ve que su Claude anduvo', () => {
  const { B2, tarjetaAnduvo } = correr();
  assert.deepEqual(B2.ws10.pedidos.map((p: { model: string }) => p.model), ['claude-haiku-4-5']);
  assert.match(B2.gasto, CREDITO_DEL_GASTO, 'con la fila de la plataforma ilegible, el gasto del crédito se anotó como del negocio');
  assert.ok(tarjetaAnduvo, 'la tarjeta del ws10 no ve los usos del crédito («anduvo»)');
});

test('el control y el borde: su clave de verdad elige Sonnet; si el ws10 cambia por una suya, la marca ya no vale', () => {
  const { C, D } = correr();
  assert.deepEqual(C.ws11.pedidos.map((p: { model: string }) => p.model), ['claude-sonnet-5']);
  assert.match(C.gasto, /^⚠ clave de Anthropic del negocio/);
  assert.deepEqual(D.ws10.pedidos.map((p: { model: string }) => p.model), ['claude-sonnet-5'], 'la marca de la clave vieja frenó la nueva');
  assert.match(D.gasto, /^⚠ clave de Anthropic del negocio/);
});
