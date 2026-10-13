// =============================================================================
// La nota desde el teléfono se rechaza si es larga: no se recorta en silencio
// =============================================================================
// Estaba en docs/relevo/crm.md («Lo que quedó sin hacer», 12/10/2026): `notaLeadAction`
// (app/m/crm/acciones.ts) cortaba a 4000 ANTES de llamar a `addLeadNoteAction`, cuyo rechazo por
// largo (`TOPE_NOTA`) entonces nunca llegaba: se guardaba el principio y el teléfono decía que
// quedó. Ahora usa el mismo tope y rechaza.
//
// Correr: npx tsx --test tests/nota-movil-no-recorta.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (13/10/2026): volver a `.slice(0, 4000)` → 1 pase / 1 fallo; sacar el
// rechazo por largo → 1 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPE_NOTA } from '../app/crm/notas-reglas';

const src = readFileSync('app/m/crm/acciones.ts', 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const f = src.slice(src.indexOf('export async function notaLeadAction'), src.indexOf('export async function notaLeadAction') + 900);

test('no recorta el texto de la nota', () => {
  assert.doesNotMatch(f, /\.slice\(0, \d+\)/, 'el teléfono vuelve a guardar sólo el principio de una nota larga');
});

test('rechaza con el MISMO tope que el alta de escritorio', () => {
  assert.match(f, /if \(t\.length > TOPE_NOTA\) return \{ ok: false/);
  assert.equal(TOPE_NOTA, 4000);
});
