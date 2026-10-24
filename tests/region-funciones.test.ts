// =============================================================================
// Las funciones corren en pdx1 (Portland), al lado de la base (us-west-2) (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «hay cosas que tardan mucho... Debería ser más rápido todo». vercel.json no fijaba región y las
// funciones corrían en iad1 (Virginia). La base está en us-west-2 (Oregon): ~97 ms por cada ida (mediana; p90 127, medido el
// 14/10, docs/hallazgos-infra.md «Medir producción»). Cada consulta EN SERIE de cada pantalla pagaba eso. En pdx1 son ~5 ms.
//
// Revisado antes de moverla (23/10/2026, «Rendimiento y loaders», con el OK del Cerebro):
//   · nada en el código lee VERCEL_REGION ni nombra iad1;
//   · la app habla con la base por HTTPS (PostgREST): no hay conexiones directas a Postgres con lista de IPs;
//   · Evolution (Railway) autentica por clave, no por IP; los crons de Vercel no dependen de la región;
//   · el país del visitante (`x-vercel-ip-country`) lo pone el borde, no la función.
// Volver atrás es sacar esta línea. Se movió en un commit y un tren APARTE para saber qué fue si algo cambia.
// ROTURAS (23/10/2026; base 2 / 0): sin la línea de regions → 1 / 1; un `preferredRegion` en app/ → 1 / 1.
// Correr: node --import tsx --test tests/region-funciones.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('vercel.json fija las funciones en pdx1, la región de la base', () => {
  const v = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as { regions?: string[] };
  assert.deepEqual(v.regions, ['pdx1'], 'sin región, Vercel las corre en iad1: ~97 ms por consulta a la base de us-west-2');
});

test('ninguna ruta pide otra región por su cuenta', () => {
  // Un `preferredRegion` en una ruta le gana a vercel.json y la vuelve a alejar de la base.
  // `git grep` sale con 1 cuando no encuentra nada: se mira la salida, no el código de salida.
  const hits = (spawnSync('git', ['grep', '-l', 'preferredRegion', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' }).stdout ?? '').trim();
  assert.equal(hits, '', `rutas con preferredRegion: ${hits}`);
});
