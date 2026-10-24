// =============================================================================
// Las cuotas de la ficha: el modelo simple, y el aviso cuando no suman la venta (24/10/2026)
// =============================================================================
// Martín, 03/07 (memoria ficha-lead-v5-pedido.md, punto 10; docs/feedback-diseno-pendiente.md, «El CRM, medido aparte»):
// «Modelo de cuotas simple EN TODOS LADOS: eliminar "Un solo pago/Cuotas/Inicial+cuotas" → "Monto primera cuota" + "+ Agregar
// cuota" (cada una monto+fecha) + error si Σcuotas ≠ monto de cierre». En el asistente de Ganado ya estaba; en la ficha seguía
// «Armar el plan» (cobro inicial + N cuotas iguales + día) y no se avisaba si el plan no sumaba la venta.
//
// La cuenta es la de `cobradoDelLead` (`cuadra`), la misma que la API de MaKo: la pantalla no suma cuotas por su cuenta.
//
// PROBADO ROMPIÉNDOLO: con lo devuelto contado como faltante, falla el primero; con el aviso también cuando todo lo vivo
// está cobrado (lo dice el estado de cuenta), el segundo; sin el «sobran», el tercero; con un cliente de baja avisando, el
// cuarto; con «Armar el plan» de vuelta en la ficha, o sin el faltante precargado, el quinto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cobradoDelLead, type CuotaParaCobrado } from '../lib/cobrado-lead';
import { avisoDelPlan, type CuotaDelLead } from '../lib/pagos-vistazo';

const HOY = '2026-10-24';
const aviso = (pagos: CuotaDelLead[], cierre = 3000) => {
  const cobrado = cobradoDelLead({ ventaTipo: 'unico', montoCierreUsd: cierre, suscripcionMontoUsd: null, suscripcionMeses: null, fechaCierre: '2026-10-01', pagos: pagos as CuotaParaCobrado[], hoy: HOY });
  return avisoDelPlan({ cobrado, pagos });
};
const cuota = (id: number, monto: number, extra: Partial<CuotaDelLead> = {}): CuotaDelLead =>
  ({ id, numero: id, monto_usd: monto, pagado: false, fecha_esperada: '2026-11-0' + id, ...extra });

test('faltan: las cuotas suman menos que la venta y queda algo por cobrar; lo devuelto no cuenta como faltante', () => {
  const a = aviso([cuota(1, 1000, { pagado: true, fecha_pago: '2026-10-02' }), cuota(2, 1000)]);
  assert.ok(a, 'no avisa');
  assert.equal(a.faltaUsd, 1000);
  assert.match(a.texto, /Las cuotas suman \$2,000 y la venta es de \$3,000: faltan \$1,000 sin cuota\./);
  // Una cuota de 1000 devuelta (sin fecha, de la pasarela, impaga): lo devuelto no es lo que falta.
  const devuelta: CuotaDelLead = { id: 3, numero: 3, monto_usd: 1000, pagado: false, fecha_esperada: null, proveedor: 'stripe', cobro_id: 5 };
  assert.equal(aviso([cuota(1, 1000, { pagado: true, fecha_pago: '2026-10-02' }), cuota(2, 1000), devuelta]), null, 'avisa un faltante que es lo devuelto');
});

test('con todo lo vivo cobrado no se repite: lo dice el estado de cuenta («Faltan $X»)', () => {
  assert.equal(aviso([cuota(1, 1000, { pagado: true, fecha_pago: '2026-10-02' })]), null);
});

test('sobran: las cuotas suman más que la venta, sin cuota que agregar; si cuadra, nada', () => {
  const a = aviso([cuota(1, 2000), cuota(2, 1500)]);
  assert.ok(a);
  assert.equal(a.faltaUsd, null);
  assert.match(a.texto, /Las cuotas suman \$3,500 y la venta es de \$3,000: sobran \$500\./);
  assert.equal(aviso([cuota(1, 1500), cuota(2, 1500)]), null, 'avisa un plan que cuadra');
  assert.equal(aviso([cuota(1, 1500), cuota(2, 1500.3)]), null, 'medio dólar no es una diferencia');
});

test('un cliente que se dio de baja no tiene faltante (lo que no pagó dejó de ser deuda)', () => {
  assert.equal(aviso([cuota(1, 1000, { pagado: true, fecha_pago: '2026-10-02' }), cuota(2, 500, { baja_at: '2026-10-20' }), cuota(3, 500)]), null);
});

test('la ficha: sin «Armar el plan», el aviso con «Agregar la cuota», y «+ Agregar una cuota» precarga lo que falta', () => {
  const src = readFileSync(join(__dirname, '..', 'app/crm/lead-view/ficha/pagos/bloques-cobro.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.doesNotMatch(src, /Armar el plan'|Cambiar el plan'|function ArmarPlan/, 'volvió el plan uniforme');
  assert.match(src, /const plan = avisoDelPlan\(\{ cobrado, pagos: data\.pagos \}\);/);
  assert.match(src, /\{plan\.faltaUsd != null && !editando && !becado && <Button[^\n]*onClick=\{\(\) => cobrar\.agregarCuota\(plan\.faltaUsd\)\}>Agregar la cuota<\/Button>\}/);
  assert.match(src, /onClick=\{\(\) => cobrar\.agregarCuota\(plan\?\.faltaUsd \?\? null\)\}>\+ Agregar una cuota<\/Button>/);
  const cobrar = readFileSync(join(__dirname, '..', 'app/crm/lead-view/ficha/pagos/cobrar.tsx'), 'utf8');
  assert.match(cobrar, /agregarCuota: \(faltaUsd: number \| null = null\) => setAbierto\(\{ que: 'agregar', faltaUsd \}\),/);
});
