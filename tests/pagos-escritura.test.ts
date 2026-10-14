// =============================================================================
// Las escrituras de cuotas y del link por cuota (lib/pagos.ts, lib/cobros.ts): lo que se lee del FUENTE
// =============================================================================
// Las reglas (qué se actualiza, qué se borra, qué se protege) son puras y se ejecutan en
// tests/pagos-campo.test.ts. Esto fija el CABLEADO que, roto, sigue compilando y mueve plata de clientes reales:
//   1. ningún escritor de cuotas borra e inserta: el único `.from('pagos').delete(` de lib/pagos.ts es el de la
//      reconciliación, va DESPUÉS del insert y lleva `pagado = false` (docs/diseno-ficha-bloques.md §3, la trampa
//      de `saveLeadPlanManual`: cada guardado cambiaba el id de cada cuota y se rompían el link, el corte de la
//      cobranza y su dedup);
//   2. lo que protege a una cuota se lee FAIL-CLOSED: «no pude leer» no es «no tiene link»;
//   3. guardar cuotas o un plan desde una pantalla NO gana el lead (ganarlo es mover de etapa);
//   4. una cuota no se inserta en un lead de OTRO negocio (el FK de `pagos.lead_id` no mira el workspace);
//   5. la etiqueta de un pago (concepto y método, mig XXXX) va en un update aparte que NO tira;
//   6. el link por cuota: `crearCobro` valida la cuota antes de crear nada y escribe SU id; al pagarse se salda
//      por id sólo si el monto coincide;
//   7. el rechazo de una renovación se escribe y se lee con la misma constante, y la siguiente lo borra.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez con un script que reemplaza, corre y restaura byte a byte.
// Con el código como está: 7 pases, 0 fallos. Rota (pases / fallos):
//   · saveLeadPlanManual con un `.from('pagos').delete()` de vuelta                     → 6 / 1
//   · el delete de la reconciliación sin `.eq('pagado', false)`                          → 6 / 1
//   · proteccionesDeCuotas con `console.error` en vez de tirar                           → 6 / 1
//   · ajustarPlanPagos escribiendo `estado_lead: 'ganado'`                               → 6 / 1
//   · registrarPagoSuelto sin `asegurarLeadDelNegocio`                                   → 6 / 1
//   · etiquetarPago tirando cuando falta la columna                                      → 6 / 1
//   · registrarCobroDeProveedor saldando por id sin `mismoMonto`                         → 6 / 1
//   · crearCobro escribiendo `pago_id: p.pagoId` (el id que llegó, sin validar)          → 6 / 1
//   · aplicarPagoFallido con el texto suelto en vez de PREFIJO_RENOVACION_FALLIDA         → 6 / 1
//   · aplicarPagoAprobado sin borrar el rechazo de la renovación anterior                 → 6 / 1
// Correr: npx tsx --test tests/pagos-escritura.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF: las líneas PRIMERO y los bloques después (AGENTS.md). */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGOS = fuente('lib/pagos.ts');
const COBROS = fuente('lib/cobros.ts');

/** La función entera, desde su firma hasta la `}` de la columna 0 que la cierra. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `no encontré el cierre de «${firma}»`);
  return src.slice(i, fin + 2);
}

test('⚠️ ningún escritor de cuotas borra e inserta: el único delete es el de la reconciliación, al final y sobre impagas', () => {
  const deletes = PAGOS.match(/from\('pagos'\)\s*\.delete\(/g) ?? [];
  assert.equal(deletes.length, 1, `hay ${deletes.length} borrados de cuotas en lib/pagos.ts: uno solo, el de la reconciliación`);
  const esc = bloque(PAGOS, 'async function escribirReconciliacion(');
  const iUpd = esc.indexOf(".update({ monto_usd: u.monto_usd");
  const iIns = esc.indexOf('.insert(rows)');
  const iDel = esc.indexOf('.delete()');
  assert.ok(iUpd > 0 && iIns > iUpd && iDel > iIns, `orden actualizar → insertar → borrar: ${iUpd} ${iIns} ${iDel}`);
  assert.match(esc.slice(iDel), /\.eq\('lead_id', leadId\)\.eq\('pagado', false\)/, 'una cuota cobrada mientras tanto no se borra');
  assert.match(esc.slice(iUpd, iIns), /\.eq\('lead_id', leadId\)\.eq\('pagado', false\)/, 'ni se pisa');
  // Los tres escritores de siempre pasan por ahí.
  assert.match(bloque(PAGOS, 'export async function saveLeadPlanManual('), /return reconciliarYGuardar\(leadId, p\.cuotas\.map\([\s\S]{0,160}\), 'lista'\);/);
  assert.match(bloque(PAGOS, 'export async function savePlanPagos('), /ajustarPlanPagos\(/);
  assert.match(bloque(PAGOS, 'export async function ajustarPlanPagos('), /reconciliarYGuardar\(leadId, cuotasDelPlan\(plan, base\), 'slots'\)/);
  assert.match(bloque(PAGOS, 'export async function guardarCuotasPorId('), /reconciliarYGuardar\(leadId, cuotas, 'porId'\)/);
});

test('⚠️ lo que protege a una cuota se lee FAIL-CLOSED', () => {
  const p = bloque(PAGOS, 'export async function proteccionesDeCuotas(');
  assert.match(p, /if \(links\.error\) throw/, 'sin poder leer los links, se borraba la cuota de un link por pagar');
  assert.match(p, /if \(corridas\.error\) throw/);
  assert.match(p, /\.in\('estado', \['pendiente', 'fallido'\]\)/, 'un link rechazado se puede volver a pagar');
  assert.match(p, /\.eq\('estado', 'pendiente'\)\.in\('ctx->>cuotaId'/, 'el recordatorio es la corrida abierta de ESA cuota');
  const ed = bloque(PAGOS, 'export async function editarCuota(');
  assert.ok(ed.indexOf('proteccionesDeCuotas(') > 0 && ed.indexOf('proteccionesDeCuotas(') < ed.indexOf(".update({ monto_usd: despues.monto_usd"), 'editar mira la protección ANTES de escribir');
});

test('guardar cuotas o un plan desde una pantalla NO gana el lead', () => {
  for (const f of ['export async function reconciliarYGuardar(', 'export async function guardarCuotasPorId(', 'export async function ajustarPlanPagos(', 'export async function editarCuota(']) {
    assert.doesNotMatch(bloque(PAGOS, f), /estado_lead|cerro:/, `${f} escribe el desenlace del lead`);
  }
});

test('⚠️ una cuota no se inserta en un lead de OTRO negocio', () => {
  const a = bloque(PAGOS, 'export async function asegurarLeadDelNegocio(');
  assert.match(a, /getTenantDb\(\)\)\.from\('leads'\)\.select\('id'\)\.eq\('id', leadId\)/, 'se busca adentro del workspace de la sesión');
  assert.match(a, /if \(!data\) throw/);
  const suelto = bloque(PAGOS, 'export async function registrarPagoSuelto(');
  assert.ok(suelto.indexOf('asegurarLeadDelNegocio(leadId)') > 0 && suelto.indexOf('asegurarLeadDelNegocio(leadId)') < suelto.indexOf(".insert({"), 'antes del insert');
  const rec = bloque(PAGOS, 'export async function reconciliarYGuardar(');
  assert.ok(rec.indexOf('asegurarLeadDelNegocio(leadId)') >= 0 && rec.indexOf('asegurarLeadDelNegocio(leadId)') < rec.indexOf('escribirReconciliacion('));
});

test('la etiqueta del pago va en un update aparte que no tira, y la moneda viaja con el monto en dólares', () => {
  const e = bloque(PAGOS, 'async function etiquetarPago(');
  assert.match(e, /try \{/);
  assert.doesNotMatch(e, /throw /, 'perder la etiqueta no puede tumbar el registro del pago');
  assert.match(e, /\.update\(\{ concepto: e\.concepto, metodo: e\.metodo \}\)/);
  const cobrar = bloque(PAGOS, 'export async function cobrarCuota(');
  assert.match(cobrar, /pagoEnMoneda\(\{ montoUsd: monto \?\? original, moneda: datos\.moneda/, 'la cuota pone los dólares que se declaran');
  assert.match(cobrar, /upd\.moneda = enMoneda\.moneda; upd\.monto_original = enMoneda\.montoOriginal;/);
  assert.match(bloque(PAGOS, 'export async function registrarPagoSuelto('), /\{ moneda: enMoneda\.moneda, monto_original: enMoneda\.montoOriginal \}/);
});

test('⚠️ el link por cuota: se valida antes de crear nada, escribe SU id y se salda sólo por el mismo monto', () => {
  const crear = bloque(COBROS, 'export async function crearCobro(');
  const iValida = crear.indexOf('cuotaParaLink(lead.id, p.pagoId)');
  assert.ok(iValida > 0 && iValida < crear.indexOf(".from('cobros').insert("), 'la cuota se valida antes de escribir el cobro');
  assert.match(crear, /pago_id: cuota\?\.id \?\? null/, 'el id que se escribe es el de la cuota VALIDADA, no el que llegó');
  assert.doesNotMatch(crear, /pago_id: p\.pagoId/);
  assert.match(crear, /const montoUsd = cuota \? cuota\.monto_usd :/, 'el valor en dólares del link de una cuota es el de la cuota');
  const v = bloque(COBROS, 'async function cuotaParaLink(');
  assert.match(v, /\.eq\('id', pagoId\)\.eq\('lead_id', leadId\)/);
  assert.match(v, /if \(q\.pagado\) return \{ ok: false/);
  const reg = bloque(PAGOS, 'export async function registrarCobroDeProveedor(');
  assert.match(reg, /const mismoMonto = /);
  assert.match(reg, /!cuota\.data\.pagado && !cuota\.data\.proveedor_pago_id && mismoMonto/, 'una cuota cambiada después del link no se marca por el monto de otro');
});

test('el rechazo de una renovación se escribe y se lee con la misma constante, y la siguiente lo borra', () => {
  assert.match(bloque(COBROS, 'export async function aplicarPagoFallido('), /motivo: `\$\{PREFIJO_RENOVACION_FALLIDA\}: \$\{motivo\}`/);
  assert.doesNotMatch(COBROS, /'Falló el cobro de la renovación/, 'el texto suelto: si cambia, la ficha deja de verlo');
  assert.match(bloque(COBROS, 'export async function aplicarPagoAprobado('), /if \(renovacion && esRenovacionFallida\(actual\.motivo\)\) \{\s*actual = \(await actualizar\(ws, c\.id, \{ motivo: null \}\)\)/);
});
