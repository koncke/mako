// =============================================================================
// Las tareas que MaKo propone por WhatsApp llevan `recurrente` (pendiente T11, 18/11/2026)
// =============================================================================
// El schema de `proponer_tareas_plan` le ofrece `recurrente` al modelo y el `map` del `case` no lo
// copiaba: una «junta de los miércoles» pedida por WhatsApp entraba como tarea normal. El mapeo se
// mudó a lib/plan-tareas-del-doer.ts para que este test lo CORRA, no para leerlo con un regex.
//
// ⚠️ PROBADO ROMPIÉNDOLO (base: 4 pasan, 0 fallan):
//  · sacar `recurrente:` del objeto de `tareasDelDoer`              → 3 / 1  («llega true»)
//  · `recurrente: !!x.recurrente`                                  → 3 / 1  («el string "true" no marca»)
//  · volver al segundo `map` a mano en el `crearPropuesta` del doer → 3 / 1  («el doer pasa lo que arma»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tareasDelDoer } from '../lib/plan-tareas-del-doer';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('una tarea marcada recurrente por el modelo llega recurrente al borrador', () => {
  const [t] = tareasDelDoer([{ titulo: 'Asistir a la junta de los miércoles', recurrente: true }]);
  assert.equal(t?.recurrente, true);
  assert.equal(t?.titulo, 'Asistir a la junta de los miércoles');
});

test('lo que no es el booleano true no marca una recurrente', () => {
  const ts = tareasDelDoer([
    { titulo: 'a', recurrente: 'true' },
    { titulo: 'b', recurrente: 1 },
    { titulo: 'c' },
    { titulo: 'd', recurrente: false },
  ]);
  assert.equal(ts.length, 4);
  for (const t of ts) assert.equal(t.recurrente, undefined, `«${t.titulo}» no puede quedar recurrente`);
});

test('el resto del mapeo sigue igual: sin título se descarta, prioridad por defecto media', () => {
  const ts = tareasDelDoer([
    { titulo: '   ' },
    null,
    'texto suelto',
    { titulo: '  Llamar a Lucía ', prioridad: 'urgentísima', deadline: '2026-12-01', detalle: 'x'.repeat(7000) },
  ]);
  assert.equal(ts.length, 1);
  assert.equal(ts[0]?.titulo, 'Llamar a Lucía');
  assert.equal(ts[0]?.prioridad, 'media');
  assert.equal(ts[0]?.deadline, '2026-12-01');
  assert.equal(ts[0]?.detalle?.length, 6000);
  assert.deepEqual(tareasDelDoer(undefined), []);
});

test('el doer pasa a crearPropuesta lo que arma tareasDelDoer, sin otro map en el medio', () => {
  // Guarda de cableado (no reemplaza a los tres de arriba): el bug vivía también en un SEGUNDO
  // map, el del `crearPropuesta`, que copiaba cinco campos a mano.
  const src = readFileSync(resolve(RAIZ, 'lib', 'mako-doer-acciones.ts'), 'utf8').replace(/\r\n/g, '\n');
  const ini = src.indexOf("case 'proponer_tareas_plan': {");
  assert.ok(ini >= 0, 'no encontré el case');
  const fin = src.indexOf('\n      case ', ini + 10);
  const bloque = src.slice(ini, fin > ini ? fin : undefined);
  assert.match(bloque, /const tareas = tareasDelDoer\(/, 'el case no usa tareasDelDoer');
  assert.match(bloque, /crearPropuesta\(\{ tareas, /, 'el crearPropuesta del doer vuelve a mapear las tareas a mano');
});
