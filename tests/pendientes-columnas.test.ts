// =============================================================================
// El worklist tiene que TRAER todas las columnas que el motor de requisitos LEE
// =============================================================================
// `PENDIENTES_COLS` (lib/queries.ts) enumera a mano las columnas del lead que baja
// el worklist «Datos sin marcar», y `faltantesDeLead` (lib/leads.ts) decide qué
// falta leyendo campos de ese lead. Son dos listas que nadie ata, y cuando se
// separan **no falla nada**: la columna ausente llega como `undefined` y el motor
// concluye lo que concluiría con el dato en blanco.
//
// Pasó el 13/08/2026 y llegó a una clienta. Se agregó la venta por suscripción
// (`venta_tipo`, `suscripcion_monto_usd`) y `faltantesDeLead` aprendió a leerlas,
// pero nadie las sumó a `PENDIENTES_COLS`. Efecto: un cierre por suscripción
// —guardado bien, con su MRR— reaparecía para siempre en Pendientes pidiendo
// «Monto de cierre · Plan de pagos». Leila marcaba los datos, MaKo contestaba
// «Datos actualizados», y el pendiente seguía ahí. En la ficha se veía bien,
// porque la ficha usa otra proyección: el bug era solo del worklist.
//
// El fallback de `leerLeadsDePendientes` NO cubre esto: reintenta con '*' cuando
// una columna listada no EXISTE en la base, no cuando falta en la lista.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Normalizado a \n: en Windows el CRLF rompe los cortes por bloque. */
const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** El cuerpo de una función exportada, desde su firma hasta la llave de cierre. */
function cuerpoDe(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.notEqual(i, -1, `no encontré «${firma}» — ¿se renombró?`);
  const j = src.indexOf('\n}\n', i);
  assert.notEqual(j, -1, `no encontré el cierre de «${firma}»`);
  return src.slice(i, j);
}

/** Las columnas de una constante armada por concatenación de literales. */
function columnasDe(src: string, nombre: string): Set<string> {
  const i = src.indexOf(`const ${nombre}`);
  assert.notEqual(i, -1, `no encontré ${nombre}`);
  const decl = src.slice(i, src.indexOf(';', i));
  const literales = decl.match(/'([^']*)'/g) ?? [];
  assert.ok(literales.length > 0, `${nombre} no parece una lista de columnas`);
  return new Set(
    literales.join('')
      .replace(/'/g, '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
  );
}

test('PENDIENTES_COLS trae TODO lo que faltantesDeLead lee del lead', () => {
  const cols = columnasDe(leer('../lib/queries.ts'), 'PENDIENTES_COLS');
  const cuerpo = cuerpoDe(leer('../lib/leads.ts'), 'export function faltantesDeLead');
  const leidos = [...new Set((cuerpo.match(/\blead\.[a-z_0-9]+/g) ?? []).map((m) => m.slice(5)))];

  assert.ok(leidos.length > 10, `esperaba varios campos y encontré ${leidos.length}: ¿cambió la forma de la función?`);
  const faltan = leidos.filter((c) => !cols.has(c));
  assert.deepEqual(
    faltan, [],
    `faltantesDeLead lee ${faltan.join(', ')} y el worklist NO las baja: llegan undefined y el motor decide con el dato en blanco. ` +
    'Sumalas a PENDIENTES_COLS en lib/queries.ts.',
  );
});

test('PENDIENTES_COLS trae TODO lo que deriveStageKey lee del lead', () => {
  // La etapa del lead se DERIVA al leer, y `faltantesDeLead` la calcula con esta
  // función sobre la misma fila proyectada: una columna que falte acá no pide un
  // dato de más, hace algo peor — pone el lead en la columna equivocada.
  const cols = columnasDe(leer('../lib/queries.ts'), 'PENDIENTES_COLS');
  const cuerpo = cuerpoDe(leer('../lib/pipeline.ts'), 'export function deriveStageKey');
  const leidos = [...new Set((cuerpo.match(/\blead\.[a-z_0-9]+/g) ?? []).map((m) => m.slice(5)))];

  const faltan = leidos.filter((c) => !cols.has(c));
  assert.deepEqual(faltan, [], `deriveStageKey lee ${faltan.join(', ')} y el worklist NO las baja`);
});

test('la venta recurrente está en la proyección (el caso que lo probó)', () => {
  // Explícito además del chequeo genérico: si alguien "limpia" PENDIENTES_COLS
  // borrando columnas que le parecen de más, este test dice cuál era el caso real.
  const cols = columnasDe(leer('../lib/queries.ts'), 'PENDIENTES_COLS');
  for (const c of ['venta_tipo', 'suscripcion_monto_usd']) {
    assert.ok(cols.has(c), `sin ${c}, un cierre por suscripción vuelve a pedir «Monto de cierre» para siempre`);
  }
});
