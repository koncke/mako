// Tests del paginado de PostgREST (lib/supabase-paginado.ts). El bug que
// blindan no da error ni warning: pasadas las 1000 filas la respuesta viene
// corta y el código sigue como si eso fuera todo lo que hay. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerTodo, PAGINA_POSTGREST } from '../lib/supabase-paginado';

type Fila = { id: number };
type Llamada = { tabla: string; cols: string; orden: string; eq: Array<[string, unknown]>; desde: number; hasta: number };

/**
 * Cliente falso que imita el techo de PostgREST: devuelve como mucho `techo`
 * filas por request, aunque le pidas un rango más grande.
 */
function fakeDb(filas: Fila[], opts: { techo?: number; errorEnLlamada?: number } = {}) {
  const techo = opts.techo ?? PAGINA_POSTGREST;
  const llamadas: Llamada[] = [];
  const db = {
    from(tabla: string) {
      return {
        select(cols: string) {
          const eq: Array<[string, unknown]> = [];
          const q = {
            eq(col: string, val: unknown) { eq.push([col, val]); return q; },
            order(orden: string, _o: { ascending: boolean }) {
              return {
                range(desde: number, hasta: number) {
                  llamadas.push({ tabla, cols, orden, eq: [...eq], desde, hasta });
                  if (llamadas.length === opts.errorEnLlamada) {
                    return Promise.resolve({ data: null, error: { message: 'boom' } });
                  }
                  const pedidas = hasta - desde + 1;
                  return Promise.resolve({ data: filas.slice(desde, desde + Math.min(pedidas, techo)), error: null });
                },
              };
            },
          };
          return q;
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, llamadas };
}

const seed = (n: number): Fila[] => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

test('trae TODO lo que pasa del techo de 1000 (el caso que se perdía en silencio)', async () => {
  const { db, llamadas } = fakeDb(seed(2500));
  const filas = await leerTodo<Fila>(db, 'leads', 'id');
  assert.equal(filas.length, 2500);
  assert.equal(filas[0].id, 1);
  assert.equal(filas[2499].id, 2500);
  assert.equal(llamadas.length, 3);
  assert.deepEqual(llamadas.map((l) => [l.desde, l.hasta]), [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('1001 filas: la 1001 no se pierde', async () => {
  const { db } = fakeDb(seed(1001));
  const filas = await leerTodo<Fila>(db, 'leads', 'id');
  assert.equal(filas.length, 1001);
  assert.equal(filas[1000].id, 1001);
});

test('exactamente 1000 filas: pide una página más, porque "justo 1000" y "cortado" se ven igual', async () => {
  const { db, llamadas } = fakeDb(seed(1000));
  const filas = await leerTodo<Fila>(db, 'leads', 'id');
  assert.equal(filas.length, 1000);
  assert.equal(llamadas.length, 2, 'la segunda página vuelve vacía y recién ahí se corta');
});

test('menos de una página: una sola request', async () => {
  const { db, llamadas } = fakeDb(seed(7));
  assert.equal((await leerTodo<Fila>(db, 'pagos', 'lead_id')).length, 7);
  assert.equal(llamadas.length, 1);
});

test('tabla vacía: array vacío, una sola request', async () => {
  const { db, llamadas } = fakeDb([]);
  assert.deepEqual(await leerTodo<Fila>(db, 'pagos', 'lead_id'), []);
  assert.equal(llamadas.length, 1);
});

test('siempre ordena (sin ORDER BY el offset de la página 2 lee otro orden)', async () => {
  const { db, llamadas } = fakeDb(seed(5), { techo: 2 });
  await leerTodo<Fila>(db, 'leads', 'id', { pagina: 2 });
  assert.ok(llamadas.every((l) => l.orden === 'id'), 'todas las páginas piden ORDER BY id');
  assert.equal(llamadas.length, 3);
});

test('respeta el orden custom y los filtros eq en TODAS las páginas', async () => {
  const { db, llamadas } = fakeDb(seed(5), { techo: 2 });
  await leerTodo<Fila>(db, 'lead_respuestas', 'lead_id', { pagina: 2, orden: 'created_at', eq: { reunion: 'R2' } });
  assert.ok(llamadas.every((l) => l.orden === 'created_at'));
  assert.ok(llamadas.every((l) => l.eq.length === 1 && l.eq[0][0] === 'reunion' && l.eq[0][1] === 'R2'));
});

test('un error de PostgREST se propaga con la tabla y la página (no devuelve datos a medias)', async () => {
  const { db } = fakeDb(seed(5), { techo: 2, errorEnLlamada: 2 });
  await assert.rejects(
    () => leerTodo<Fila>(db, 'leads', 'id', { pagina: 2 }),
    /leads \(página 2\).*boom/,
  );
});

test('cols y tabla llegan tal cual al cliente', async () => {
  const { db, llamadas } = fakeDb(seed(1));
  await leerTodo<Fila>(db, 'pagos', 'lead_id, pagado, comprobante_path');
  assert.equal(llamadas[0].tabla, 'pagos');
  assert.equal(llamadas[0].cols, 'lead_id, pagado, comprobante_path');
});
