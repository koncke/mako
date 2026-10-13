// =============================================================================
// Los lotes del Ads Manager salen a Meta con un tope, no todos juntos
// =============================================================================
// EL CASO (13/10/2026, del relevo del Ads Manager). Pausar, activar o cambiar el
// presupuesto de N filas mandaba N pedidos a la vez, cada uno con dos llamadas a Meta,
// que topea por cuenta publicitaria. `allSettledConTope` (lib/settled-con-tope.ts)
// tiene la misma forma que `Promise.allSettled` y deja salir TOPE_LOTE_META a la vez.
//
// PROBADO ROMPIÉNDOLO el 13/10/2026 (con todo puesto: 5 pasan, 0 fallan). Pasan / fallan:
//   · un trabajador por ítem (sin tope)                                     -> 3 / 2
//   · un solo trabajador (serie, ignora el tope)                            -> 4 / 1
//   · los resultados en orden de llegada y no de entrada                    -> 4 / 1
//   · un `fn` que tira corta a los demás (sin el try)                       -> 3 / 2
//   · la pausa en lote vuelve a `Promise.allSettled`                        -> 4 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allSettledConTope, TOPE_LOTE_META } from '../lib/settled-con-tope';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('nunca hay más de `tope` en vuelo, y llega al tope (no corre en serie)', async () => {
  let enVuelo = 0;
  let maximo = 0;
  const items = Array.from({ length: 11 }, (_, i) => i);
  await allSettledConTope(items, 4, async (i) => {
    enVuelo++;
    maximo = Math.max(maximo, enVuelo);
    await esperar(5 + (i % 3));
    enVuelo--;
    return i;
  });
  assert.equal(maximo, 4);
});

test('mismo orden y misma forma que Promise.allSettled, aunque terminen desordenados', async () => {
  const items = [30, 5, 20, 1, 10];
  const fn = async (ms: number) => { await esperar(ms); if (ms === 20) throw new Error('veinte'); return ms * 2; };
  const conTope = await allSettledConTope(items, 2, fn);
  const nativo = await Promise.allSettled(items.map(fn));
  assert.deepEqual(conTope.map((r) => r.status), nativo.map((r) => r.status));
  assert.deepEqual(conTope.map((r) => (r.status === 'fulfilled' ? r.value : (r.reason as Error).message)), [60, 10, 'veinte', 2, 20]);
});

test('un pedido que tira queda rejected y los demás siguen', async () => {
  const hechos: number[] = [];
  const r = await allSettledConTope([1, 2, 3, 4, 5], 2, async (i) => { if (i === 1) throw new Error('uno'); hechos.push(i); return i; });
  assert.equal(r[0].status, 'rejected');
  assert.deepEqual(hechos.sort(), [2, 3, 4, 5]);
});

test('vacío devuelve vacío, y un tope inválido corre de a uno', async () => {
  assert.deepEqual(await allSettledConTope([], 4, async () => 1), []);
  let enVuelo = 0, maximo = 0;
  await allSettledConTope([1, 2, 3], Number.NaN, async () => { enVuelo++; maximo = Math.max(maximo, enVuelo); await esperar(2); enVuelo--; });
  assert.equal(maximo, 1);
  assert.ok(TOPE_LOTE_META >= 1 && TOPE_LOTE_META <= 8, 'el tope es chico y positivo');
});

test('los cuatro lotes de escritura del Ads Manager pasan por el tope', () => {
  const src = sinComentarios(leer('../app/ads-manager/CampanasBrowser.tsx'));
  assert.doesNotMatch(src, /Promise\.allSettled\(/, 'un lote volvió a mandar todo junto');
  assert.equal((src.match(/allSettledConTope\([^\n]*TOPE_LOTE_META, \([a-z]+\) => write(OneStatus|Budget)\(/g) ?? []).length, 4,
    'activar en cascada, pausar, activar en lote y el presupuesto');
});
