// F152 (18/11/2026): un lead MIGRADO de otro CRM cuenta como «nuevo» el día en que nació allá (`fecha_original`, mig
// 0405), no el día que entró a MaKo. Se ejecutan las funciones de lib/leads-alta.ts contra un PostgREST de mentira que
// evalúa los filtros sobre filas en memoria (y que, si se le pide, contesta 42703 como la base sin la 0405).
//
// Probado rompiéndolo (base 9/0):
//   · `momentoDeAlta` devolviendo siempre `created_at` → 8/1;
//   · `contarAltas` sumando sólo las nativas (sin las migradas) → 8/1;
//   · `contarAltas` sin el `.is('fecha_original', null)` en la de las nativas (las cuenta dos veces) → 8/1;
//   · `hayFechaOriginal` sin la sonda (siempre true): con la base sin la columna, tira → 6/3.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  altaEnRango, contarAltas, diaDeAltaUtc, faltaFechaOriginal, hayFechaOriginal, leerAltas, momentoDeAlta,
  olvidarSondeoFechaOriginal, REPREGUNTAR_SIN_COLUMNA_MS,
} from '../lib/leads-alta';

type Fila = { id: number; created_at: string; fecha_original: string | null; estado_lead: string };

/** Un PostgREST de mentira: `.select`, `.is`, `.gte`, `.lte`, `.eq`, `.order`, `.range`, `.limit`, y await. */
function baseFalsa(filas: Fila[], opts: { sinColumna?: boolean } = {}) {
  const pedidos: string[] = [];
  const db = {
    from(tabla: string) {
      assert.equal(tabla, 'leads');
      let cols = '';
      let head = false;
      let conteo = false;
      const filtros: Array<(f: Fila) => boolean> = [];
      const nombra: string[] = [];
      let desde = 0;
      let hasta = Infinity;
      const valor = (f: Fila, c: string) => (f as unknown as Record<string, unknown>)[c];
      const b = {
        select(c: string, o?: { count?: string; head?: boolean }) { cols = c; head = !!o?.head; conteo = !!o?.count; return b; },
        is(c: string, v: null) { nombra.push(c); filtros.push((f) => (valor(f, c) ?? null) === v); return b; },
        eq(c: string, v: unknown) { nombra.push(c); filtros.push((f) => valor(f, c) === v); return b; },
        gte(c: string, v: string) { nombra.push(c); filtros.push((f) => { const x = valor(f, c); return typeof x === 'string' && Date.parse(x) >= Date.parse(v); }); return b; },
        lte(c: string, v: string) { nombra.push(c); filtros.push((f) => { const x = valor(f, c); return typeof x === 'string' && Date.parse(x) <= Date.parse(v); }); return b; },
        order() { return b; },
        limit(n: number) { hasta = n - 1; return b; },
        range(a: number, z: number) { desde = a; hasta = z; return b; },
        then(ok: (r: unknown) => unknown, no?: (e: unknown) => unknown) {
          pedidos.push(`${cols}|${nombra.join(',')}`);
          const usaOriginal = /fecha_original/.test(cols) || nombra.includes('fecha_original');
          if (opts.sinColumna && usaOriginal) {
            const error = { code: '42703', message: 'column leads.fecha_original does not exist' };
            return Promise.resolve({ data: null, error, count: null }).then(ok, no);
          }
          const dan = filas.filter((f) => filtros.every((p) => p(f)));
          const pagina = dan.slice(desde, Number.isFinite(hasta) ? hasta + 1 : undefined);
          return Promise.resolve({ data: head ? null : pagina, error: null, count: conteo ? dan.length : null }).then(ok, no);
        },
      };
      return b;
    },
  };
  return { db: db as never, pedidos };
}

// El período: octubre de 2026. «Hoy» (cuando se migró) es el 18/11.
const DESDE = '2026-10-01T00:00:00Z';
const HASTA = '2026-10-31T23:59:59Z';
const FILAS: Fila[] = [
  { id: 1, created_at: '2026-10-05T10:00:00+00:00', fecha_original: null, estado_lead: 'abierto' },   // nativo, adentro
  { id: 2, created_at: '2026-10-20T10:00:00+00:00', fecha_original: null, estado_lead: 'ganado' },    // nativo, adentro
  { id: 3, created_at: '2026-09-29T10:00:00+00:00', fecha_original: null, estado_lead: 'abierto' },   // nativo, afuera
  { id: 4, created_at: '2026-11-18T09:00:00+00:00', fecha_original: '2026-10-12T15:00:00+00:00', estado_lead: 'ganado' },  // migrado HOY, nació en octubre
  { id: 5, created_at: '2026-10-15T09:00:00+00:00', fecha_original: '2025-03-01T12:00:00+00:00', estado_lead: 'abierto' }, // migrado en octubre, nació en 2025
];

test('el alta de un migrado es su fecha del CRM anterior; si no es legible, la de MaKo', () => {
  assert.equal(momentoDeAlta(FILAS[3]), '2026-10-12T15:00:00+00:00');
  assert.equal(momentoDeAlta(FILAS[0]), '2026-10-05T10:00:00+00:00');
  assert.equal(momentoDeAlta({ created_at: '2026-10-05T10:00:00Z', fecha_original: 'no es una fecha' }), '2026-10-05T10:00:00Z');
  assert.equal(momentoDeAlta({ created_at: null, fecha_original: undefined }), null);
  assert.equal(diaDeAltaUtc(FILAS[3]), '2026-10-12');
  assert.equal(diaDeAltaUtc(FILAS[4]), '2025-03-01');
  assert.deepEqual(FILAS.filter((f) => altaEnRango(f, DESDE, HASTA)).map((f) => f.id), [1, 2, 4]);
});

test('reconoce el «esa columna no existe» de PostgREST y no otro error', () => {
  assert.equal(faltaFechaOriginal({ code: '42703', message: 'column leads.fecha_original does not exist' }), true);
  assert.equal(faltaFechaOriginal({ code: 'PGRST204', message: "Could not find the 'fecha_original' column of 'leads'" }), true);
  assert.equal(faltaFechaOriginal({ code: '57014', message: 'canceling statement due to statement timeout' }), false);
  assert.equal(faltaFechaOriginal(null), false);
});

test('contar las altas: el migrado de hoy cuenta en octubre, el migrado en octubre que nació en 2025 no', async () => {
  olvidarSondeoFechaOriginal();
  const { db } = baseFalsa(FILAS);
  const esperado = FILAS.filter((f) => altaEnRango(f, DESDE, HASTA)).length;
  assert.equal(await contarAltas(db, DESDE, HASTA), esperado, 'las altas de octubre: 1, 2 y el migrado 4');
  assert.equal(await contarAltas(db, DESDE, HASTA, (q) => q.eq('estado_lead', 'ganado') as typeof q), 2, 'las ganadas de octubre: 2 y 4');
});

test('leer las altas: las dos lecturas no se pisan y traen la fecha original', async () => {
  olvidarSondeoFechaOriginal();
  const { db, pedidos } = baseFalsa(FILAS);
  const filas = await leerAltas<Fila>(db, 'id, created_at, estado_lead', DESDE, HASTA, { orden: 'id' });
  assert.deepEqual(filas.map((f) => f.id).sort(), [1, 2, 4]);
  assert.equal(new Set(filas.map((f) => f.id)).size, filas.length, 'ningún lead dos veces');
  assert.ok(pedidos.filter((p) => p.startsWith('id, created_at, estado_lead, fecha_original|')).length >= 2, 'las dos lecturas piden la fecha original');
});

test('sin la migración 0405 cuenta por created_at, como antes, y no tira', async () => {
  olvidarSondeoFechaOriginal();
  const { db } = baseFalsa(FILAS, { sinColumna: true });
  assert.equal(await hayFechaOriginal(db), false);
  // Por created_at: 1, 2 y el 5 (migrado en octubre). El 4 entró en noviembre.
  assert.equal(await contarAltas(db, DESDE, HASTA), 3);
  assert.deepEqual((await leerAltas<Fila>(db, 'id, created_at', DESDE, HASTA)).map((f) => f.id).sort(), [1, 2, 5]);
});

test('la sonda: un «sí» se guarda; un «no» se vuelve a preguntar pasado el plazo', async () => {
  olvidarSondeoFechaOriginal();
  const sin = baseFalsa(FILAS, { sinColumna: true });
  const t0 = Date.parse('2026-11-18T10:00:00Z');
  assert.equal(await hayFechaOriginal(sin.db, t0), false);
  const n = sin.pedidos.length;
  assert.equal(await hayFechaOriginal(sin.db, t0 + 1000), false);
  assert.equal(sin.pedidos.length, n, 'dentro del plazo no vuelve a preguntar');
  const con = baseFalsa(FILAS);
  assert.equal(await hayFechaOriginal(con.db, t0 + REPREGUNTAR_SIN_COLUMNA_MS + 1), true, 'aplicada la migración, la ve');
  assert.equal(await hayFechaOriginal(sin.db, t0 + 2 * REPREGUNTAR_SIN_COLUMNA_MS), true, 'una vez que sí, queda');
});

test('una base caída no se toma como «falta la columna»', async () => {
  olvidarSondeoFechaOriginal();
  const caida = { from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: null, error: { code: '57014', message: 'timeout' } }) }) }) };
  assert.equal(await hayFechaOriginal(caida as never, 1), false);
  const { db } = baseFalsa(FILAS);
  assert.equal(await hayFechaOriginal(db, 2), true, 'no quedó guardado el «no»: a la siguiente pregunta, sí');
});

test('un conteo que la base no devuelve no es cero', async () => {
  olvidarSondeoFechaOriginal();
  const sinConteo = {
    from: () => {
      const b: Record<string, unknown> = {};
      for (const k of ['select', 'is', 'gte', 'lte', 'eq', 'limit']) b[k] = () => b;
      b.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: null }).then(ok);
      return b;
    },
  };
  await assert.rejects(() => contarAltas(sinConteo as never, DESDE, HASTA), /no devolvió el conteo/);
});

test('el rango incluye su último instante', () => {
  assert.equal(altaEnRango({ created_at: HASTA, fecha_original: null }, DESDE, HASTA), true);
  assert.equal(altaEnRango({ created_at: '2026-11-01T00:00:00Z', fecha_original: null }, DESDE, HASTA), false);
});
