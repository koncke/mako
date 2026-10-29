// =============================================================================
// La mudanza del Copywriter se puede cortar en cualquier pedido y repetir sin duplicar ni perder (29/10/2026)
// =============================================================================
// Verificación del Cerebro de 544991179 (C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md):
//   · ALTA: si la marca «hecha» no llegaba, o la respuesta del índice se perdía, a los 10 minutos se mudaba TODO otra vez
//     (7 → 14 páginas, dos «Guiones del Ads Writer»); y con la respuesta del índice perdida, 6 de 7 abrían «No existe»;
//   · MEDIA: un documento que fallaba una vez no se mudaba nunca (la marca quedaba «hecha» con menos);
//   · MEDIA: en un negocio con más guiones que el tope, el Ads Writer lo llenaba y no entraba ningún Reel.
// El arreglo: el id de cada página sale de su origen (lib/copywriter/mudanza-reglas.ts → `idDeMudanza`), `crearVarias`
// saltea lo que ya está, adopta el documento de una corrida cortada y no borra nada; la marca queda «hecha» sólo si no
// faltó nada; los Reels van primero. Corre la mudanza REAL en un node aparte (tests/_copywriter-mudanza-hijo.ts).
// Verificado rompiéndolo: ver el pie del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
type Estado = { paginas: number; rotas: number; marca: string | null; padresAds: number; padresReels: number; reelsEnLaRaiz: number };
let salida: Record<string, unknown> | null = null;
const correr = () => {
  salida ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_copywriter-mudanza-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  })) as Record<string, unknown>;
  assert.equal(salida.error, undefined, String(salida.error));
  return salida;
};
// Lo sembrado: el padre del Ads Writer, 3 guiones, la celda vieja; el padre de Reels y 2 Reels.
const TODAS = 8;

test('dos corridas seguidas: la segunda no hace nada, y la celda de antes del multi-guion también se muda', () => {
  const e = correr().E2 as Estado & { r1: number; r2: number; legado: boolean };
  assert.deepEqual([e.r1, e.r2, e.paginas, e.marca], [TODAS, 0, TODAS, 'hecha']);
  assert.equal(e.legado, true, 'la matriz la muestra como «General»: la mudanza la dejaba afuera');
});

test('si la marca «hecha» no llega, el reintento encuentra todo y no duplica', () => {
  const e = correr().E5 as Estado & { r1: number; r2: number; tras1: Estado };
  assert.equal(e.tras1.marca, 'en-curso');
  assert.equal(e.tras1.paginas, TODAS);
  assert.equal(e.r2, 0, 'a los 10 minutos volvía a crear las 8');
  assert.deepEqual([e.paginas, e.padresAds, e.padresReels, e.rotas, e.marca], [TODAS, 1, 1, 0, 'hecha']);
});

test('si el índice llega y su respuesta se pierde, ninguna página abre «No existe» y el reintento no duplica', () => {
  const e = correr().E5b as Estado & { r1: number; r2: number; tras1: Estado };
  assert.equal(e.tras1.rotas, 0, 'se borraban los documentos de páginas que ya estaban en el índice');
  assert.equal(e.tras1.marca, 'en-curso');
  assert.deepEqual([e.r2, e.paginas, e.padresAds, e.rotas, e.marca], [0, TODAS, 1, 0, 'hecha']);
});

test('un documento que falla una vez: la marca no queda «hecha» y el reintento lo muda', () => {
  const e = correr().E6 as Estado & { r1: number; r2: number; reel2: boolean; tras1: Estado & { reel2: boolean } };
  assert.deepEqual([e.tras1.reel2, e.tras1.marca], [false, 'en-curso'], 'quedaba «hecha» y el Reel no se mudaba nunca');
  assert.deepEqual([e.r2, e.reel2, e.paginas, e.marca], [1, true, TODAS, 'hecha']);
});

test('si falla el padre «Reels», sus hijas esperan al reintento y quedan debajo de él (no en la raíz)', () => {
  const e = correr().E6p as Estado & { r1: number; r2: number; tras1: Estado };
  assert.equal(e.tras1.reelsEnLaRaiz, 0);
  assert.equal(e.tras1.marca, 'en-curso');
  assert.deepEqual([e.paginas, e.padresReels, e.reelsEnLaRaiz, e.rotas, e.marca], [TODAS, 1, 0, 0, 'hecha']);
});

test('con más guiones que el tope, los Reels entran igual (van primero)', () => {
  const e = correr().E9 as Estado & { r1: number; reels: number };
  assert.equal(e.reels, 3, 'el Ads Writer llenaba el tope y no entraba ningún Reel');
  assert.equal(e.paginas, 300, 'el tope de la mudanza');
});

test('dos negocios con lo mismo no comparten ningún id, y nada sale a la red', () => {
  const s = correr();
  assert.deepEqual(s.dosNegocios, { comparten: 0, paginas: TODAS });
  assert.deepEqual(s.red, []);
});
