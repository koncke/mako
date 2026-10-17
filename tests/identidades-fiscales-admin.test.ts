// =============================================================================
// Las identidades fiscales del negocio las cambia sólo su admin (17/10/2026)
// =============================================================================
// La razón social, el id fiscal y el domicilio con los que factura el negocio viven en /configuraciones/fiscal,
// que ya era sólo del admin (`requireRolWs([])`). Pero `saveIdentidadFiscalAction` y `deleteIdentidadFiscalAction`
// son server actions: una puerta propia que cualquiera con sesión podía llamar. Un closer podía borrar la razón social.
// Leerlas sigue abierto a cualquiera con sesión (el deal las muestra).
//
// Asserts sobre el FUENTE (las acciones dependen de la sesión; el molde es tests/acciones-sin-sesion.test.ts).
//
// Probado rompiéndolo (17/10/2026; base 3 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · save sin el corte de admin                                         -> 2 / 1
//   · delete sin el corte de admin                                       -> 2 / 1
//   · esAdminDelNegocio pregunta `!== null` en vez de `=== 'admin'`      -> 2 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(import.meta.dirname, '..', 'app/crm/[id]/deal-actions.ts'), 'utf8').replace(/\r\n/g, '\n');
const cuerpo = (firma: string): string => {
  const i = SRC.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  return SRC.slice(i, SRC.indexOf('\n}\n', i));
};
const CORTE = /if \(!\(await haySesion\(\)\)\) throw new Error\(SIN_SESION\);\n {2}if \(!\(await esAdminDelNegocio\(\)\)\) throw new Error\(SOLO_ADMIN_FISCAL\);/;

test('crear o editar una identidad fiscal pide ser admin del negocio, antes de tocar la base', () => {
  assert.match(cuerpo('export async function saveIdentidadFiscalAction('), CORTE);
});

test('borrar una identidad fiscal pide ser admin del negocio, antes de tocar la base', () => {
  assert.match(cuerpo('export async function deleteIdentidadFiscalAction('), CORTE);
});

test('«admin del negocio» es el rol efectivo admin, no cualquier sesión', () => {
  assert.match(cuerpo('async function esAdminDelNegocio('), /return \(await getRolWsEfectivo\(\)\) === 'admin';/);
});
