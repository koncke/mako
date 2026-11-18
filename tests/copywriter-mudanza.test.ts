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
import { fechasDeLoMudado, leerLoDeAntes, quedanAfuera, SIN_FECHA, type PaginaMudada } from '../lib/copywriter/mudanza-reglas';

const RAIZ = join(__dirname, '..');
type Estado = { paginas: number; rotas: number; marca: string | null; padresAds: number; padresReels: number; reelsEnLaRaiz: number };
let salida: Record<string, unknown> | null = null;
const correr = () => {
  salida ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_copywriter-mudanza-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
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

// ── Las cuatro bajas que quedaban de la verificación (18/11/2026, B3 · B4 · B5 · B6) ──────────────────────────────────
// Probado rompiéndolo (18/11/2026), base 12/0 (los 7 de arriba y los 5 de abajo):
//   · crearVarias vuelve a poner `actualizado: ahora` (sin la fecha del origen) ................ B3: 1 falla (y la pura)
//   · mudanza.ts marca «hecha» aunque algo quede afuera (sin `if (ilegibles.length || afuera)`) . B4 y B5: 2 fallan
//   · crearVarias sin el corte del tope (deja que `agregar` lo rechace callado) ................. B4c: 1 falla
//   · leerLoDeAntes devuelve `{ ok: true, valor: null }` con un JSON roto ......................... B5 y la pura: 2 fallan
//   · guionALaVista mira sólo `pagina.papelera` (sin `escondida`) ................................ B6: 1 falla

test('B3 · lo mudado nace con la fecha de su origen y nunca le gana a la última página del usuario', () => {
  const e = correr().B3 as { abre: boolean; ningunaLeGana: boolean; reel1: string; guion1: string; padreReels: string; marca: string; paginas: number };
  assert.equal(e.abre, true, '/copywriter abría un Reel mudado (nacía con «ahora»)');
  assert.equal(e.ningunaLeGana, true);
  assert.equal(e.reel1, '2026-10-20T10:00:00.000Z', 'el Reel conserva su fecha');
  assert.equal(e.guion1, '2026-10-05T12:00:00.000Z', 'el guion conserva su `creadoEn`');
  assert.ok(e.padreReels >= e.reel1, 'el padre lleva la fecha de su hija más nueva');
  assert.deepEqual([e.marca, e.paginas], ['hecha', 1 + 3 + 3]);
});

test('B4 · con el índice casi lleno la marca no queda «hecha», y al liberar lugar el reintento trae todo', () => {
  const e = correr().B4 as { r1: number; r2: number; paginas: number; marca: string; tras1: { paginas: number; marca: string } };
  assert.deepEqual([e.r1, e.tras1.paginas, e.tras1.marca], [0, 485, 'en-curso'], 'quedaba «hecha» con 0 y los Reels no aparecían nunca');
  assert.deepEqual([e.r2, e.paginas, e.marca], [TODAS, 400 + TODAS, 'hecha']);
  const b = correr().B4c as { creadas: number; faltan: number; sinLugar: number; paginas: number };
  assert.deepEqual(b, { creadas: 1, faltan: 0, sinLugar: 2, paginas: 500 }, 'crearVarias dice cuántas no entraron por el tope');
});

test('B5 · un historial que no es JSON no es «no hay»: se muda lo legible y la marca espera al reintento', () => {
  const e = correr().B5 as Estado & { r1: number; r2: number; tras1: Estado };
  assert.deepEqual([e.tras1.padresReels, e.tras1.padresAds, e.tras1.marca], [0, 1, 'en-curso'], 'quedaba «hecha» y los Reels no se mudaban nunca');
  assert.deepEqual([e.r2, e.paginas, e.padresReels, e.marca], [3, TODAS, 1, 'hecha']);
});

test('B6 · el link de una página que cuelga de otra en la Papelera no abre ni escribe, y vuelve con su madre', () => {
  const e = correr().B6 as Record<string, unknown>;
  assert.deepEqual(e.antes, { madre: true, hija: true });
  assert.deepEqual(e.enPapelera, { madre: false, hija: false, noExiste: false }, 'la hija seguía editándose por el link');
  assert.deepEqual(e.vuelta, { madre: true, hija: true });
  assert.equal(e.otroNegocio, false);
});

test('las reglas puras: la fecha de lo mudado, lo que queda afuera y «no pude leer»', () => {
  const pm = (clave: string, padreClave: string | null, fecha: string | null): PaginaMudada =>
    ({ clave, padreClave, fecha, titulo: clave, tipo: 'ad', emoji: null, props: {}, contenido: { type: 'doc' } });
  const ps = [pm('reels', null, null), pm('r1', 'reels', '2026-10-01T00:00:00.000Z'), pm('r2', 'reels', '2026-10-09T00:00:00.000Z'), pm('r3', 'reels', null)];
  const ahora = '2026-11-18T00:00:00.000Z';
  const f = fechasDeLoMudado(ps, null, ahora);
  assert.deepEqual([f.get('reels'), f.get('r1'), f.get('r3')], ['2026-10-09T00:00:00.000Z', '2026-10-01T00:00:00.000Z', SIN_FECHA]);
  const conPropia = fechasDeLoMudado(ps, '2026-10-05T00:00:00.000Z', ahora);
  assert.equal(conPropia.get('r2'), '2026-10-04T23:59:59.999Z', 'nunca pasa a la última página propia');
  assert.equal(conPropia.get('r1'), '2026-10-01T00:00:00.000Z');
  assert.equal(fechasDeLoMudado([pm('x', null, '2099-01-01T00:00:00.000Z')], null, ahora).get('x'), ahora, 'ni al futuro');
  assert.deepEqual(leerLoDeAntes('[1'), { ok: false });
  assert.deepEqual(leerLoDeAntes(null), { ok: true, valor: null });
  assert.deepEqual(leerLoDeAntes('  '), { ok: true, valor: null });
  assert.deepEqual(leerLoDeAntes('[1]'), { ok: true, valor: [1] });
  const grupo = [pm('p', null, null), pm('a', 'p', null), pm('b', 'p', null)];
  assert.equal(quedanAfuera([grupo], 1_000), 0);
  assert.equal(quedanAfuera([grupo], 2), 1);
  assert.equal(quedanAfuera([grupo], 0), 3);
});
