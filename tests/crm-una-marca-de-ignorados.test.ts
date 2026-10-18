// =============================================================================
// «Datos sin marcar»: una sola marca para ignorar, y nadie escribe la vieja (17/10/2026)
// =============================================================================
// `ignorarPendientesAction`, `ignorarPendientesMasaAction` y `reactivarPendientesAction` (app/crm/actions.ts) escribían
// `leads.pendientes_ignorados` (la marca del lead entero, mig 0109), no tenían corte de sesión y nadie las llamaba:
// CrmBoard sólo las importaba (docs/relevo/crm-tanda-b1.md, b1). Se borraron. Ignorar y volver a avisar van por
// `escribirDatosIgnorados` (lib/datos-aviso-config.ts), y la marca vieja sólo se LEE (filas de antes) o se LIMPIA.
//
// Verificado rompiéndolo (el archivo da 1 / 0): con `export const _x = { pendientes_ignorados: new Date().toISOString() };`
// agregado al final de app/crm/actions.ts → 0 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');

test('nadie en app/ ni en lib/ PONE la marca vieja: sólo se lee o se limpia', () => {
  // `git grep` (rápido) de cada asignación `pendientes_ignorados: <valor>`, fuera de comentarios. Lo que vale: leerla de
  // una fila (`fila.pendientes_ignorados`), declararla en un tipo, o limpiarla (`null`).
  const salida = execFileSync('git', ['grep', '-n', '-E', 'pendientes_ignorados\\??:', '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' });
  const ponen = salida.split(/\r?\n/).filter(Boolean)
    .filter((l) => !/^\S+:\d+:\s*(\/\/|\*)/.test(l))
    .filter((l) => !/pendientes_ignorados\??:\s*(null\b|string\b|fila\.pendientes_ignorados|unknown)/.test(l));
  assert.deepEqual(ponen, [], 'volvió alguien que pone la marca del lead entero');
  const acc = readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8');
  assert.doesNotMatch(acc, /export async function (ignorarPendientesAction|ignorarPendientesMasaAction|reactivarPendientesAction)\(/);
});
