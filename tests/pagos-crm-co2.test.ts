// =============================================================================
// CO2 (plan del Cerebro, 22/10/2026): una renovación se ve igual en la computadora, el teléfono y Customer Success, y
// suma en «Firmado»
// =============================================================================
// Desde la 0324 un CRM agregado tiene su venta (su fila de `lead_funnel`). Lo que faltaba: que «Firmado» la sume en todos
// sus lectores (`ventasDeCrms`, lib/ventas-crm.ts), y que el teléfono y CS muestren su estado de cuenta.
// La regla de qué es una venta se EJECUTA (`ventasDeFilas`); los lectores se leen del fuente.
// Probado ROMPIÉNDOLO (22/10/2026): cada test dice su rotura y cuántos fallos dio.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ventasDeFilas } from '../lib/pagos-crm';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// La casa del lead 28 es la venta del VSL (funnel 1); la renovación (funnel 29) se ganó el 22/10 por US$7.000.
const fila = (extra: Record<string, unknown> = {}) => ({
  lead_id: 28, funnel_id: 29, etapa: 'ganado', venta_tipo: 'unico', monto_cierre_usd: '7000.00', fecha_cierre: '2026-10-22',
  leads: { nombre: 'Cliente', funnel_id: 1 }, ...extra,
});

// Roturas: sin pedir `etapa === 'ganado'`: 1 fallo. Sin sacar la fila que repite la casa: 1 fallo.
test('una venta de un CRM agregado es la fila ganada ahí, con monto y fecha, que no es «sin cobro» ni la casa', () => {
  assert.deepEqual(ventasDeFilas([fila()], 1), [{ leadId: 28, funnelId: 29, monto: 7000, fecha: '2026-10-22', nombre: 'Cliente' }]);
  assert.equal(ventasDeFilas([fila({ etapa: 'lead' })], 1).length, 0, 'no ganada en ese CRM: no es una venta');
  assert.equal(ventasDeFilas([fila({ venta_tipo: 'sin_cobro' })], 1).length, 0, 'un becado no es una venta');
  assert.equal(ventasDeFilas([fila({ monto_cierre_usd: null })], 1).length, 0, 'sin monto no suma');
  assert.equal(ventasDeFilas([fila({ fecha_cierre: null })], 1).length, 0, 'sin fecha no cae en ningún período');
  assert.equal(ventasDeFilas([fila({ funnel_id: 1 })], 1).length, 0, 'la fila que repite la casa: esa venta es la de `leads`');
  assert.equal(ventasDeFilas([fila({ funnel_id: 1, leads: { nombre: 'X', funnel_id: null } })], 1).length, 0, 'la casa NULL es el funnel del negocio');
});

// Roturas: `soldUsd` sin `firmadoEnCrms`: 1 fallo. El Revenue del período sin `enCrms.usd`: 1 fallo.
test('«Firmado» suma las ventas de los CRMs agregados en todos sus lectores', () => {
  const okr = sinComentarios(leer('lib/objectives-fuentes.ts'));
  assert.match(okr, /return \{ valor: total \+ \(await firmadoEnCrms\(desde, hasta\)\)\.usd \};/, 'el KPI «Firmado»');
  assert.match(okr, /return r\.valor == null \? r : \{ valor: r\.valor \+ \(await firmadoEnCrms\(desde, hasta\)\)\.cierres \};/, 'y los cierres');
  assert.match(okr, /\.\.\.deCrms\.map\(\(v\) => \(\{ lead: v\.leadId, fecha: v\.fecha, valor: monto \? v\.monto : 1, funnel: v\.funnelId \}\)\)/, 'por funnel: con SU funnel');
  const q = sinComentarios(leer('lib/queries.ts'));
  assert.match(q, /const sold_revenue_usd = \(soldRes\.data \?\? \[\]\)\.reduce\([\s\S]{0,120}?\) \+ enCrms\.usd;/, 'el Revenue del período');
  assert.match(q, /const cierres_en_periodo = \(soldRes\.data \?\? \[\]\)\.length \+ enCrms\.cierres;/);
  assert.match(q, /for \(const v of enCrms\) \{\s*const ym = v\.fecha\.slice\(0, 7\);/, 'la serie por mes');
  assert.match(q, /const sold_actual = cuentan\.reduce\([^\n]*\) \+ enCrms\.usd;/, 'el objetivo');
  assert.match(sinComentarios(leer('lib/pagos.ts')), /\.\.\.enCrms\.map\(\(v\) => \(\{ nombre: v\.nombre \?\? '—', monto: v\.monto, fecha: v\.fecha, leadId: v\.leadId, funnel: v\.funnelId \}\)\)/, 'el desglose');
  assert.match(sinComentarios(leer('lib/graficos-datos.ts')), /for \(const v of enCrms\) out\.push\(\{ f: v\.fecha, d: \{\}, v: \{ cierres: 1, vendido: v\.monto \} \}\);/, 'el conjunto «Negocio»');
  assert.match(sinComentarios(leer('lib/graficos-datos-extra.ts')), /for \(const v of enCrms\) out\.push\(\{ f: v\.fecha, d: \{\}, v: \{ cierres: 1, vendido: v\.monto \}, r: \{ lead: String\(v\.leadId\) \} \}\);/, 'el conjunto «Revenue»');
});

// Roturas: CS sin las secciones de los otros CRMs: 1 fallo. El teléfono sin `saldosCrm` en la pieza: 1 fallo.
test('el teléfono y Customer Success muestran el estado de cuenta de cada CRM con plata', () => {
  const cs = sinComentarios(leer('app/customer-success/PagosCliente.tsx'));
  assert.match(cs, /\{deLaPlata\.length > 0 && otros\.map\(\(o\) => \(/);
  assert.match(cs, /<Armador tab="pagos" lista=\{deLaPlata\} ctx=\{\{ \.\.\.ctx, crm: o \}\}/, 'con el trato de ese CRM');
  assert.match(cs, /new Set\(\['cobrado', 'venta', 'cuotas', 'movimientos'\]\)/, 'sólo los bloques de plata: los del deal son del lead');
  const datos = sinComentarios(leer('app/m/crm/datos.ts'));
  assert.match(datos, /const l = leadConTrato\(lead, t\);/, 'la cuenta del escritorio sobre SU trato');
  assert.match(datos, /const verPagos = saldosCrm\.length > 0 \|\| tieneDeal\(/);
  assert.match(sinComentarios(leer('app/m/crm/[id]/FichaLead.tsx')), /k=\{`Estado de cuenta · \$\{x\.crm\}`\}/);
  assert.match(sinComentarios(leer('app/m/crm/ficha-bloques.ts')), /case 'saldo': return !d\.saldo && !d\.saldosCrm;/);
});
