// =============================================================================
// «Restaurar» queda en el historial; «Deshacer» no deja rastro (24/10/2026)
// =============================================================================
// Martín, 03/07 (memoria ficha-lead-v5-pedido.md; docs/feedback-diseno-pendiente.md, «El CRM, medido aparte»): «Deshacer» en
// el toast, con tiempo límite y sin dejar rastro; pasado el límite, «Restaurar», que SÍ queda en el historial. Los dos botones
// del historial llaman a `revertMoveAction`, y hasta hoy los dos borraban la línea: una vuelta de días después desaparecía
// sin autor. El plazo vive en un solo lugar (lib/historial-pisado.ts) y lo miran el botón y el server.
//
// PROBADO ROMPIÉNDOLO: con el plazo en `<=` o corrido, falla el primero; sin el `if (!deshacerSinRastro)` del
// logLeadChanges, o con el borrado fuera de su `if`, el segundo; con logLeadChanges DESPUÉS de alinear la etapa, el tercero;
// con el botón otra vez con su propio `10 * 60_000`, el cuarto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esDeshacerReciente, PLAZO_DESHACER_MS } from '../lib/historial-pisado';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const acc = leer('app/crm/actions.ts');
const ini = acc.indexOf('export async function revertMoveAction(');
const accion = acc.slice(ini, acc.indexOf('\nexport ', ini + 1));

test('el plazo: diez minutos, y una fecha que no se lee no se deshace sin rastro', () => {
  const t = Date.parse('2026-10-24T12:00:00.000Z');
  assert.equal(PLAZO_DESHACER_MS, 10 * 60_000);
  assert.equal(esDeshacerReciente('2026-10-24T12:00:00.000Z', t + 9 * 60_000), true);
  assert.equal(esDeshacerReciente('2026-10-24T12:00:00.000Z', t + 10 * 60_000), false, 'a los diez minutos ya es «Restaurar»');
  assert.equal(esDeshacerReciente('2026-10-24T12:00:00.000Z', t + 3 * 86_400_000), false);
  assert.equal(esDeshacerReciente('no es una fecha', t), false, 'sin fecha, se anota: perder un rastro es peor que una línea de más');
});

test('pasado el plazo se anota la vuelta, y la línea vieja sólo se borra dentro del plazo', () => {
  assert.match(accion, /const deshacerSinRastro = esDeshacerReciente\(createdAt, Date\.now\(\)\);/);
  assert.match(accion, /if \(!deshacerSinRastro\) await logLeadChanges\(leadId, actual, await getLead\(leadId\)\.catch\(\(\) => null\), await autorActual\(\)\);/);
  assert.match(accion, /if \(deshacerSinRastro\) \{\n\s+try \{\n\s+const \{ error \} = await \(await getTenantDb\(\)\)\.from\('lead_audit'\)\.delete\(\)/, 'el «Restaurar» sigue borrando la línea');
});

test('la vuelta se anota ANTES de alinear la etapa vista (alineada primero, la línea de la etapa no se escribe)', () => {
  const iLog = accion.indexOf('await logLeadChanges(');
  const iAlinear = accion.indexOf('alinearEtapaVista(');
  assert.ok(iLog > 0 && iAlinear > 0);
  assert.ok(iLog < iAlinear, 'logLeadChanges va antes de alinearEtapaVista');
});

test('el botón y el pop-up dicen lo que va a pasar, con el mismo plazo que el server', () => {
  const ui = leer('app/crm/lead-view/AuditHistory.tsx');
  assert.match(ui, /const reciente = now > 0 && esDeshacerReciente\(head\.created_at, now\);/);
  assert.doesNotMatch(ui, /10 \* 60_000/, 'el botón volvió a tener su propio plazo');
  assert.match(ui, /'Volver al estado anterior \(queda anotado en el historial\)'/);
  assert.match(ui, /la vuelta <b>queda anotada en el historial<\/b>/);
});
