// =============================================================================
// Tres fallas MEDIAS de la revisión de b2 (Pagos campo por campo, 14/10/2026), las tres de plata
// =============================================================================
// docs/relevo/crm-tanda-b1.md, «Revisión de b2 · Pagos». Lo puro se ejecuta; el cableado se lee del FUENTE, como en
// tests/pagos-escritura.test.ts, porque lib/pagos.ts y lib/cobros.ts son `server-only` y no se importan en un test:
//   1. una cuota REPROGRAMADA vuelve a entrar a la cobranza: el dedup (`cuota:<id>`, 120 días) se olvida cuando le
//      cambia el vencimiento. La clave NO lleva la fecha a propósito (lib/cobranza.ts, `claveDedupCuota`);
//   2. cobrar una cuota (a mano o por otra vía) ANULA sus links sin pagar: si no, el cliente la podía pagar dos veces;
//   3. cancelar una suscripción manual GUARDA el plazo, reactivarla lo DEVUELVE, y el plazo de una cancelada no se
//      revierte desde el historial (quedaba «Cancelada» con el plazo entero y el MRR la volvía a contar).
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura
// byte a byte. Con el código como está: 8 pases, 0 fallos. Rota, cada una da 7 / 1:
//   · `cuotasReprogramadas` devolviendo también las que sólo cambian de monto
//   · el cron con `dedupKey: \`cuota:${c.pago_id}\`` pelado en vez de `claveDedupCuota`
//   · escribirReconciliacion sin `olvidarAvisosDeCuotas`
//   · editarCuota sin `olvidarAvisosDeCuotas`
//   · olvidarAvisosDeCuotas con `setSetting` (sin compare-and-set) en vez de cambiarSettingSi
//   · marcarPago sin `anularLinksAlCobrar`
//   · anularLinksDeCuota sin excluir `exceptoCobroId`
//   · `plazoAlReactivar` devolviendo sólo lo que vino (lo de antes: `?? null`)
//   · cancelar sin guardar `suscripcion_meses_antes`
//   · revertMoveAction sin el corte de `plazoSeRevierte`
// Correr: npx tsx --test tests/pagos-medias-b2.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { disparosDeCobranza, claveDedupCuota, cuotasReprogramadas, AVISOS_DE_CUOTA, type CuotaParaAvisar } from '../lib/cobranza';
import { plazoAlReactivar, plazoSeRevierte } from '../lib/suscripcion-manual';

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF (AGENTS.md: las líneas PRIMERO y los bloques después). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGOS = fuente('lib/pagos.ts');
const COBROS = fuente('lib/cobros.ts');
const ACCIONES = fuente('app/crm/actions.ts');
const MIG = readFileSync(join(RAIZ, 'supabase/migrations/0292_pagos_manual_suscripcion_cancelada.sql'), 'utf8');

/** La función entera, desde su firma hasta la `}` de la columna 0 que la cierra. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de «${firma}»`);
  return src.slice(i, fin + 2);
}

// ── 1 · La cuota reprogramada vuelve a la cobranza ──────────────────────────

test('cuotasReprogramadas: sólo las que cambiaron de VENCIMIENTO (un monto nuevo con la misma fecha no es un hecho nuevo)', () => {
  const ids = cuotasReprogramadas([
    { id: 1, fecha_esperada: '2026-11-01', antes: { fecha_esperada: '2026-10-01' } }, // renegociada
    { id: 2, fecha_esperada: '2026-10-15', antes: { fecha_esperada: '2026-10-15' } }, // sólo el monto
    { id: 3, fecha_esperada: null, antes: { fecha_esperada: '2026-10-20' } },          // quedó sin fecha
    { id: 4, fecha_esperada: null, antes: { fecha_esperada: null } },
  ]);
  assert.deepEqual(ids, [1, 3]);
});

test('⚠️ el cron y el olvido usan LA MISMA clave: la del dedup de la cuota, sin la fecha', () => {
  const c: CuotaParaAvisar = { pago_id: 77, lead_id: 9, lead_nombre: 'Ana', numero: 3, monto_usd: 500, fecha_esperada: '2026-10-01', dias: -2 };
  const [d] = disparosDeCobranza({ vencidas: [c], porVencer: [] });
  assert.equal(d.dedupKey, claveDedupCuota(77));
  // Sin la fecha: con ella, el día del deploy toda cuota que ya avisó dentro de la ventana volvería a avisar.
  assert.equal(claveDedupCuota(77), 'cuota:77');
  assert.deepEqual([...AVISOS_DE_CUOTA].sort(), ['cuota-por-vencer', 'cuota-vencida']);
  assert.match(fuente('lib/cobranza.ts'), /dedupKey: claveDedupCuota\(c\.pago_id\)[\s\S]*dedupKey: claveDedupCuota\(c\.pago_id\)/);
});

test('⚠️ toda escritura que cambia un vencimiento olvida el dedup de esa cuota, con compare-and-set y sin tirar', () => {
  assert.match(bloque(PAGOS, 'async function escribirReconciliacion('), /await olvidarAvisosDeCuotas\(cuotasReprogramadas\(plan\.actualizar\)\);\n\}/,
    'la reconciliación (Editar deal, el wizard, guardar_cuotas, el plan) olvida las que reprogramó');
  const editar = bloque(PAGOS, 'export async function editarCuota(');
  const iUpd = editar.indexOf("from('pagos').update(");
  const iOlv = editar.indexOf('await olvidarAvisosDeCuotas(cuotasReprogramadas([{ id: pagoId, fecha_esperada: despues.fecha_esperada, antes }]))');
  assert.ok(iUpd > 0 && iOlv > iUpd, 'editarCuota olvida DESPUÉS de escribir: si la escritura falla, no se reabre nada');
  const olv = bloque(PAGOS, 'async function olvidarAvisosDeCuotas(');
  assert.match(olv, /for \(const aviso of AVISOS_DE_CUOTA\)/);
  assert.match(olv, /keyEspaciado\(aviso, claveDedupCuota\(id\)\)/, 'la clave es la que reclama el cron (lib/espaciado.ts)');
  assert.match(olv, /cambiarSettingSi\(key, previo, DEDUP_OLVIDADO\)/, 'contra lo leído: un cron que justo la reclama gana');
  assert.doesNotMatch(olv, /setSetting\(/);
  assert.match(olv, /if \(\(await getWorkspaceActual\(\)\) == null\) return;/, 'sin negocio, app_settings caería al ws1');
  assert.match(olv, /try \{[\s\S]*\} catch \(e\) \{\s*console\.error/, 'el olvido no tumba la edición que ya se escribió');
});

// ── 2 · Cobrar una cuota anula sus links vivos ─────────────────────────────

test('⚠️ marcar pagada una cuota anula sus links sin pagar, salvo el cobro que la salda, y sin tumbar el pago', () => {
  const marcar = bloque(PAGOS, 'export async function marcarPago(');
  // (16/10/2026: `*`, para leer `nacio_cobrada` sin romper una base sin la mig 0295; trae `cobro_id` igual.)
  assert.match(marcar, /\.select\('\*'\)/);
  const iSi = marcar.indexOf('if (pagado) {');
  const iAnular = marcar.indexOf('await anularLinksAlCobrar(pagoId, pago.cobro_id ?? null);');
  assert.ok(iSi > 0 && iAnular > iSi, 'sólo al marcar PAGADO, y pasando el cobro propio');
  const alCobrar = bloque(PAGOS, 'async function anularLinksAlCobrar(');
  assert.match(alCobrar, /await import\('\.\/cobros'\)/, 'import dinámico: lib/cobros.ts ya importa lib/pagos.ts');
  assert.match(alCobrar, /anularLinksDeCuota\(ws, pagoId, 'MaKo \(la cuota ya se cobró\)', cobroId == null \? null : Number\(cobroId\)\)/);
  assert.match(alCobrar, /\} catch \(e\) \{\s*console\.error\('\[pagos\] no pude anular/, 'que falle la anulación no tumba el pago');
  const anular = bloque(COBROS, 'export async function anularLinksDeCuota(');
  assert.match(anular, /\.eq\('pago_id', pagoId\)\.in\('estado', \['pendiente', 'fallido'\]\)/);
  assert.match(anular, /\.filter\(\(id\) => id !== exceptoCobroId\)/);
  assert.match(anular, /await anularCobro\(ws, id, autor\)/, 'por anularCobro: expira la sesión de Stripe y deja el historial');
});

// ── 3 · El plazo de la suscripción manual ──────────────────────────────────

test('plazoAlReactivar: lo que vino, si no el guardado al cancelar; «no vino» no es «mes a mes»', () => {
  assert.equal(plazoAlReactivar(null, 12), 12, 'la API reactiva sin plazo: vuelve el de antes');
  assert.equal(plazoAlReactivar(undefined, 12), 12);
  assert.equal(plazoAlReactivar(6, 12), 6, 'el Deshacer manda el que había');
  assert.equal(plazoAlReactivar(null, null), null, 'era mes a mes (o se canceló antes de la columna)');
  assert.equal(plazoAlReactivar(0, 12), 12, 'un plazo inválido no cuenta');
  assert.equal(plazoAlReactivar('', 9), 9);
  assert.equal(plazoAlReactivar(2.5, null), null);
});

test('plazoSeRevierte: no mientras esté cancelada', () => {
  assert.equal(plazoSeRevierte(null), true);
  assert.equal(plazoSeRevierte(undefined), true, 'sin la migración, como antes');
  assert.equal(plazoSeRevierte('2026-10-14T12:00:00Z'), false);
});

test('⚠️ cancelar guarda el plazo, reactivar lo devuelve, y la columna está en la migración', () => {
  const f = bloque(PAGOS, 'export async function cambiarEstadoSuscripcionManual(');
  assert.match(f, /select\('venta_tipo, suscripcion_meses, suscripcion_cancelada_at, suscripcion_meses_antes'\)/);
  assert.match(f, /suscripcion_meses: opts\.mesesAlCancelar, suscripcion_meses_antes: mesesAntes \}/);
  assert.match(f, /suscripcion_meses: plazoAlReactivar\(opts\.mesesAlReactivar, fila\.suscripcion_meses_antes\), suscripcion_meses_antes: null \}/);
  assert.match(MIG, /alter table leads add column if not exists suscripcion_meses_antes integer;/);
});

test('⚠️ el plazo de una cancelada no se revierte desde el historial, por ninguna de las dos puertas, ANTES de escribir', () => {
  const uno = bloque(ACCIONES, 'export async function revertAuditChangeAction(');
  assert.match(uno, /if \(row\.campo === CAMPO_SUS_MESES && !plazoSeRevierte\(canceladaDe\(before\)\)\) throw new Error\(PLAZO_DE_CANCELADA\);\n\s*const \{ error \} = await/);
  const grupo = bloque(ACCIONES, 'export async function revertMoveAction(');
  const iCorte = grupo.indexOf('throw new Error(PLAZO_DE_CANCELADA)');
  const iPrimera = grupo.indexOf('await updateLead(');
  assert.ok(iCorte > 0 && iPrimera > iCorte, 'el corte va antes de la primera escritura del grupo');
});
