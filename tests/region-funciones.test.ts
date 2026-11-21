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
// LA ÚNICA EXCEPCIÓN (20/11/2026): /api/cron/binance-pagos corre en São Paulo porque Binance contesta 451 desde EE. UU. Va en vercel.json
// (`functions[<ruta>].regions`, lo que Vercel documenta para pisar la región del proyecto en UNA función), está escrita abajo con su
// porqué, y cualquier otra función con región propia sigue en rojo.
// ⚠️ EL EXPORT DE NEXT NO SIRVE: la primera versión pedía la región con `export const preferredRegion` y Vercel la IGNORÓ (medido el
// 21/11 en los request-logs: los crons de las 00:17 y las 00:47 UTC corrieron la ruta en pdx1 y Binance contestó 451). Sigue prohibido
// en app/ y lib/ (ni en un comentario): o no hace nada y engaña, o aleja una función de la base.
// ROTURAS (21/11; base 3 / 0): el export en una ruta de app/ → 2 / 1; la palabra en un comentario de lib/ → 2 / 1; otra función con
// región en vercel.json → 2 / 1; la de Binance sin su región → 2 / 1; la excepción apuntando a un archivo que no existe → 2 / 1.
// Correr: node --import tsx --test tests/region-funciones.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('vercel.json fija las funciones en pdx1, la región de la base', () => {
  const v = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as { regions?: string[] };
  assert.deepEqual(v.regions, ['pdx1'], 'sin región, Vercel las corre en iad1: ~97 ms por consulta a la base de us-west-2');
});

test('ninguna ruta pide otra región con el export de Next (Vercel lo ignora: la región va en vercel.json)', () => {
  // `git grep` sale con 1 cuando no encuentra nada: se mira la salida, no el código de salida.
  const hits = (spawnSync('git', ['grep', '-l', 'preferredRegion', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' }).stdout ?? '').trim();
  assert.equal(hits, '', `rutas con preferredRegion: ${hits}`);
});

/** Las funciones que corren en OTRA región (vercel.json, `functions[<ruta>].regions`), con su porqué. UNA por decisión escrita. */
const EXCEPCIONES: Readonly<Record<string, { regiones: string[]; porque: string }>> = {
  'app/api/cron/binance-pagos/route.ts': {
    regiones: ['gru1'],
    porque: 'Binance contesta 451 «restricted location» desde EE. UU. (pdx1): esta ruta lee la cuenta desde São Paulo. Es una lectura chica que NO toca la base (carga sólo el secreto del cron y lib/binance-pay-directo.ts; tests/binance-pay-region.test.ts lo fija): lo que consulta la base lo hace quien la llama, en pdx1 (20/11/2026)',
  },
};

test('la ÚNICA función fuera de pdx1 es la escrita en EXCEPCIONES, y su archivo existe', () => {
  const v = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as { functions?: Record<string, { regions?: string[] }> };
  const conRegion = Object.fromEntries(Object.entries(v.functions ?? {}).filter(([, c]) => c.regions).map(([k, c]) => [k, c.regions]));
  assert.deepEqual(conRegion, Object.fromEntries(Object.entries(EXCEPCIONES).map(([k, e]) => [k, e.regiones])), 'una función con región propia tiene que estar en EXCEPCIONES, con su porqué');
  // Un patrón de vercel.json que no apunta a ninguna función no hace nada (y puede romper el build): el archivo tiene que existir.
  for (const k of Object.keys(EXCEPCIONES)) assert.ok(existsSync(join(RAIZ, k)), `${k} no existe: sácalo de vercel.json y de EXCEPCIONES`);
});
