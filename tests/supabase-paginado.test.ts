// Tests del paginado de PostgREST (lib/supabase-paginado.ts). El bug que
// blindan no da error ni warning: pasadas las 1000 filas la respuesta viene
// corta y el código sigue como si eso fuera todo lo que hay. Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerTodo, leerPorPaginas, PAGINA_POSTGREST } from '../lib/supabase-paginado';

type Fila = { id: number };
type Llamada = {
  tabla: string; cols: string;
  /** Todas las columnas del ORDER BY, en orden: ['fecha desc', 'id asc']. */
  orden: string[];
  /** Todo filtro aplicado, como 'eq:col=valor'. */
  filtros: string[];
  desde: number; hasta: number;
};

/**
 * Cliente falso que imita el techo de PostgREST: devuelve como mucho `techo`
 * filas por request, aunque le pidas un rango más grande. Encadena como el
 * builder de verdad (cada método devuelve el mismo objeto) para poder verificar
 * que el ORDER BY y los filtros se aplican en TODAS las páginas, no solo en la
 * primera — que es justo el tipo de olvido que hace perder filas en silencio.
 */
function fakeDb(filas: Fila[], opts: { techo?: number; errorEnLlamada?: number } = {}) {
  const techo = opts.techo ?? PAGINA_POSTGREST;
  const llamadas: Llamada[] = [];
  const db = {
    from(tabla: string) {
      return {
        select(cols: string) {
          const orden: string[] = [];
          const filtros: string[] = [];
          const q = {
            eq(col: string, val: unknown) { filtros.push(`eq:${col}=${String(val)}`); return q; },
            neq(col: string, val: unknown) { filtros.push(`neq:${col}=${String(val)}`); return q; },
            in(col: string, vals: readonly unknown[]) { filtros.push(`in:${col}=${vals.join('|')}`); return q; },
            not(col: string, op: string, val: unknown) { filtros.push(`not:${col} ${op} ${String(val)}`); return q; },
            order(col: string, o: { ascending: boolean }) { orden.push(`${col} ${o.ascending ? 'asc' : 'desc'}`); return q; },
            range(desde: number, hasta: number) {
              llamadas.push({ tabla, cols, orden: [...orden], filtros: [...filtros], desde, hasta });
              if (llamadas.length === opts.errorEnLlamada) {
                return Promise.resolve({ data: null, error: { message: 'boom' } });
              }
              const pedidas = hasta - desde + 1;
              return Promise.resolve({ data: filas.slice(desde, desde + Math.min(pedidas, techo)), error: null });
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
  assert.ok(llamadas.every((l) => l.orden.length === 1 && l.orden[0] === 'id asc'), 'todas las páginas piden ORDER BY id');
  assert.equal(llamadas.length, 3);
});

test('respeta el orden custom y los filtros eq en TODAS las páginas', async () => {
  const { db, llamadas } = fakeDb(seed(5), { techo: 2 });
  await leerTodo<Fila>(db, 'lead_respuestas', 'lead_id', { pagina: 2, orden: 'created_at', eq: { reunion: 'R2' } });
  assert.ok(llamadas.every((l) => l.orden.length === 1 && l.orden[0] === 'created_at asc'));
  assert.ok(llamadas.every((l) => l.filtros.length === 1 && l.filtros[0] === 'eq:reunion=R2'));
});

// ── Orden compuesto ──────────────────────────────────────────────────────────
// Ordenar por una columna que NO es única (una fecha, un ad_id que se repite por
// día) es la MISMA trampa que no ordenar: los empates se pueden repartir distinto
// entre páginas. Por eso el orden acepta lista y el último tramo es la PK.

test('el orden compuesto se manda entero, columna por columna y en orden', async () => {
  const { db, llamadas } = fakeDb(seed(5), { techo: 2 });
  await leerTodo<Fila>(db, 'marketing_metrics_daily', 'ad_id', {
    pagina: 2,
    orden: [{ col: 'fecha', asc: false }, { col: 'ad_id' }, { col: 'id' }],
  });
  assert.ok(llamadas.every((l) => l.orden.join(' | ') === 'fecha desc | ad_id asc | id asc'));
  assert.equal(llamadas.length, 3, 'y sigue paginando igual');
});

test('un orden en string sigue valiendo (ascendente por defecto)', async () => {
  const { db, llamadas } = fakeDb(seed(1));
  await leerTodo<Fila>(db, 'ad_transcripts', 'ad_id', { orden: 'ad_id' });
  assert.deepEqual(llamadas[0].orden, ['ad_id asc']);
});

// ── Filtros del caller ───────────────────────────────────────────────────────

test('los filtros del caller (.not/.in/.neq) se aplican en TODAS las páginas', async () => {
  const { db, llamadas } = fakeDb(seed(5), { techo: 2 });
  await leerTodo<Fila>(db, 'evolution_contactos', 'telefono, nombre', {
    pagina: 2,
    filtros: (q) => q.not('nombre', 'is', null).in('telefono', ['1', '2']),
  });
  assert.equal(llamadas.length, 3);
  assert.ok(
    llamadas.every((l) => l.filtros.join(' | ') === 'not:nombre is null | in:telefono=1|2'),
    'la página 2 con menos filtros trae filas que no corresponden y descoloca el offset',
  );
});

test('filtros y eq conviven (el eq se agrega, no pisa)', async () => {
  const { db, llamadas } = fakeDb(seed(1));
  await leerTodo<Fila>(db, 'marketing_metrics_daily', 'ad_id', {
    eq: { plataforma: 'meta' },
    filtros: (q) => q.neq('ad_id', ''),
  });
  assert.deepEqual(llamadas[0].filtros, ['neq:ad_id=', 'eq:plataforma=meta']);
});

// ── leerPorPaginas ───────────────────────────────────────────────────────────

test('leerPorPaginas entrega cada página y no acumula nada', async () => {
  const { db } = fakeDb(seed(5), { techo: 2 });
  const tamanos: number[] = [];
  const numeros: number[] = [];
  let total = 0;
  await leerPorPaginas<Fila>(db, 'leads', 'id', (filas, nro) => {
    tamanos.push(filas.length);
    numeros.push(nro);
    total += filas.length;
  }, { pagina: 2 });
  assert.deepEqual(tamanos, [2, 2, 1]);
  assert.deepEqual(numeros, [1, 2, 3], 'el número de página arranca en 1');
  assert.equal(total, 5);
});

test('devolver false corta el barrido ahí mismo (truncado a propósito, no en silencio)', async () => {
  const { db, llamadas } = fakeDb(seed(100), { techo: 2 });
  const vistas: number[] = [];
  await leerPorPaginas<Fila>(db, 'wa_mensajes', 'id', (filas, nro) => {
    vistas.push(...filas.map((f) => f.id));
    return nro < 2;   // tope explícito: 2 páginas
  }, { pagina: 2 });
  assert.deepEqual(vistas, [1, 2, 3, 4]);
  assert.equal(llamadas.length, 2, 'no pide una tercera página después del corte');
});

test('devolver undefined NO corta (solo `false` frena)', async () => {
  const { db, llamadas } = fakeDb(seed(5), { techo: 2 });
  await leerPorPaginas<Fila>(db, 'leads', 'id', () => { /* sin return */ }, { pagina: 2 });
  assert.equal(llamadas.length, 3);
});

test('leerPorPaginas propaga el error de PostgREST (no se come media tabla)', async () => {
  const { db } = fakeDb(seed(5), { techo: 2, errorEnLlamada: 2 });
  await assert.rejects(
    () => leerPorPaginas<Fila>(db, 'leads', 'id', () => {}, { pagina: 2 }),
    /leads \(página 2\).*boom/,
  );
});

test('el tope de páginas rompe fuerte en vez de devolver media tabla', async () => {
  // 3 páginas × 2 filas = 6; con 100 filas el barrido se pasa del tope.
  const { db } = fakeDb(seed(100), { techo: 2 });
  await assert.rejects(
    () => leerTodo<Fila>(db, 'leads', 'id', { pagina: 2, maxPaginas: 3 }),
    /pasó 3 páginas/,
  );
});

// El tope por defecto es un CINTURÓN, no un límite de producto: si queda por
// debajo de la lectura legítima más grande, el throw cae en el catch del caller
// y se lee como "no hay datos". Pasó de verdad: con 100 páginas (100k filas) el
// análisis de la landing decía "sin datos de comportamiento" y el importador de
// contactos —que antes paginaba hasta 200k— dejaba de importar del todo.
test('el tope POR DEFECTO deja pasar bastante más de 100 páginas', async () => {
  const { db, llamadas } = fakeDb(seed(401), { techo: 2 });
  const filas = await leerTodo<Fila>(db, 'landing_visits', 'id', { pagina: 2 });
  assert.equal(filas.length, 401, 'no puede truncar una lectura de 200 páginas');
  assert.equal(llamadas.length, 201);
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
