// La checklist de /admin/runway/checklist (16/10/2026, pedido de Martín: «Preparamelo tipo checklist en "runway" con
// todo lo que se hizo y lo que aún queda pendiente»). Lo marcado se guarda por id, así que un id repetido o renombrado
// pierde la marca de otro ítem; y la acción escribe en la base, así que exige al admin y lee estricto antes de escribir.
// Probado rompiéndolo (16/10/2026, base 2/0): id repetido, sin getSesionAdmin, sin validar el id y leer tolerante → 1 fallo cada uno.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HECHO, PENDIENTE } from '../app/admin/runway/checklist/datos';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('cada ítem tiene un id único y un texto corto', () => {
  const items = [...HECHO, ...PENDIENTE].flatMap((s) => s.items);
  const ids = items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'hay un id repetido');
  for (const i of items) assert.ok(i.t.length <= 130, `«${i.id}» es largo (${i.t.length})`);
});

test('la acción exige al admin, valida el id y lee estricto antes de escribir', () => {
  const src = leer('app/admin/runway/checklist/acciones.ts');
  assert.match(src, /if \(!\(await getSesionAdmin\(\)\)\)/);
  assert.match(src, /if \(!IDS\.has\(id\)\)/);
  assert.match(src, /getSettingEstricto\(CLAVE_CHECKLIST\)/);
  assert.doesNotMatch(src, /\bgetSetting\(/);
});
