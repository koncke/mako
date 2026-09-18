// Tests de lib/nutricion-envios-resumen.ts: «qué salió» por inscripción, que es
// lo que decide si una secuencia FALLÓ por silencio y mueve al lead de etapa.
// El bug que blindan: un `.in('inscripcion_id', ids)` suelto sobre
// nutricion_envios que PostgREST cortaba en 1000 filas sin avisar, y las
// inscripciones del final se quedaban sin su envío más reciente.
//
// Verificado rompiéndolo (17/09/2026): cortando el barrido después de la primera
// página (`return false` en el onPagina, o sea el `.in()` suelto de antes), el
// test de las 600 inscripciones da 1 fallo y 3 pases — la inscripción 1 vuelve
// con n=5 y `ultimo` del día 5 en vez de n=6 y día 6: le falta el último envío,
// que es exactamente el que decide cuándo arranca el reloj del silencio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { acumularEnvios, enviosPorInscripcion, type ResumenEnvio } from '../lib/nutricion-envios-resumen';

type Envio = { id: number; inscripcion_id: number | null; created_at: string; estado: string };

/**
 * Cliente falso con el techo de PostgREST: aplica `.eq`/`.in` de verdad, ordena
 * por las columnas pedidas y devuelve como mucho `techo` filas por request.
 */
function fakeDb(filas: Envio[], techo = 1000) {
  let requests = 0;
  const db = {
    from() {
      return {
        select() {
          const preds: Array<(f: Envio) => boolean> = [];
          const orden: string[] = [];
          const q = {
            eq(col: keyof Envio, val: unknown) { preds.push((f) => f[col] === val); return q; },
            in(col: keyof Envio, vals: readonly unknown[]) { const s = new Set(vals); preds.push((f) => s.has(f[col])); return q; },
            order(col: string) { orden.push(col); return q; },
            range(desde: number, hasta: number) {
              requests++;
              const out = filas
                .filter((f) => preds.every((p) => p(f)))
                .sort((a, b) => {
                  for (const c of orden) {
                    const x = a[c as keyof Envio] as number | string;
                    const y = b[c as keyof Envio] as number | string;
                    if (x !== y) return x < y ? -1 : 1;
                  }
                  return 0;
                });
              return Promise.resolve({ data: out.slice(desde, desde + Math.min(hasta - desde + 1, techo)), error: null });
            },
          };
          return q;
        },
      };
    },
  };
  return { db: db as unknown as SupabaseClient, requests: () => requests };
}

const dia = (d: number) => `2026-09-${String(d).padStart(2, '0')}T12:00:00.000Z`;

test('600 inscripciones × 6 envíos (3.600 filas, 1.200 por tanda de 200 ids): cada una trae sus 6 y su último', async () => {
  const filas: Envio[] = [];
  let id = 1;
  // Los envíos de cada paso salen en tandas por día: primero todos los del paso 1,
  // después los del 2… — igual que el motor. Así, un corte en 1000 por `id` deja
  // a las inscripciones del final de cada tanda SIN su paso 6.
  for (let paso = 1; paso <= 6; paso++) {
    for (let i = 1; i <= 600; i++) filas.push({ id: id++, inscripcion_id: i, created_at: dia(paso), estado: 'enviado' });
  }
  const { db } = fakeDb(filas);
  const r = await enviosPorInscripcion(db, Array.from({ length: 600 }, (_, i) => i + 1));
  assert.equal(r.size, 600);
  assert.deepEqual(r.get(1), { n: 6, ultimo: dia(6) });
  assert.deepEqual(r.get(200), { n: 6, ultimo: dia(6) });
  assert.deepEqual(r.get(600), { n: 6, ultimo: dia(6) });
});

test('solo cuenta los enviados, y solo de las inscripciones pedidas', async () => {
  const { db } = fakeDb([
    { id: 1, inscripcion_id: 1, created_at: dia(1), estado: 'enviado' },
    { id: 2, inscripcion_id: 1, created_at: dia(5), estado: 'borrador' },
    { id: 3, inscripcion_id: 2, created_at: dia(2), estado: 'enviado' },
    { id: 4, inscripcion_id: 9, created_at: dia(9), estado: 'enviado' },
  ]);
  const r = await enviosPorInscripcion(db, [1, 2]);
  assert.deepEqual([...r.entries()].sort(), [[1, { n: 1, ultimo: dia(1) }], [2, { n: 1, ultimo: dia(2) }]]);
});

test('sin inscripciones no pregunta nada', async () => {
  const f = fakeDb([]);
  const r = await enviosPorInscripcion(f.db, []);
  assert.equal(r.size, 0);
  assert.equal(f.requests(), 0);
});

test('acumularEnvios: el último sale de la fecha, no del orden de llegada', () => {
  const acc = new Map<number, ResumenEnvio>();
  acumularEnvios(acc, [{ inscripcion_id: 7, created_at: dia(3) }]);
  acumularEnvios(acc, [{ inscripcion_id: 7, created_at: dia(1) }, { inscripcion_id: null, created_at: dia(9) }]);
  assert.deepEqual(acc.get(7), { n: 2, ultimo: dia(3) });
  assert.equal(acc.size, 1);
});
