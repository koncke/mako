// =============================================================================
// «$X cobrado de $Y»: lo cobrado de UN lead (lib/cobrado-lead.ts), EJECUTADO
// =============================================================================
// El bloque `cobrado` de docs/diseno-ficha-bloques.md §3 (Pagos, Resumen y Customer Success) y la lectura
// `cobranza_lead` de la API cuentan con la misma función. Las tres mentiras que tenía la tarjeta de hoy
// (DealDetailsCard.tsx:348-359), medidas en el código el 14/10/2026:
//   · una mensualidad ACTIVA con lo registrado cobrado decía «Pagado por completo»;
//   · una renovación RECHAZADA se pintaba en verde (el rechazo queda en `cobros.motivo` de un cobro «Pagado»);
//   · un pago único SIN cuotas decía «Al corriente».
// Y las de siempre: la plata de una suscripción es su mensualidad (nunca `monto_cierre_usd` pelado: en ws11 eso
// infló el MRR un 85%), y un becado no tiene cobrado.
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez sobre lib/cobrado-lead.ts con un script que reemplaza,
// corre y restaura byte a byte. Con el código como está: 11 pases, 0 fallos. Rota (pases / fallos):
//   · la mensualidad activa diciendo «Pagado por completo» (la tarjeta de hoy)              → 10 / 1
//   · sin la rama de `renovacionFallida` (el rechazo en verde)                              → 10 / 1
//   · el total de una suscripción con `monto_cierre_usd` pelado                             →  9 / 2
//   · el becado con `seDibuja: true`                                                        → 10 / 1
//   · sin la rama «Sin cuotas cargadas» (el «Al corriente» sin nada)                        → 10 / 1
//   · el total de un pago único = sólo las cuotas (el link parcial «pagado por completo»)   → 10 / 1
//   · contando las cuotas devueltas                                                         → 10 / 1
//   · sin la rama de meses sin registrar                                                    → 10 / 1
//   · sin `suscripcionCanceladaAt` (la manual cancelada seguía «activa»)                    → 10 / 1
// Correr: npx tsx --test tests/cobrado-lead.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cobradoDelLead, sumarMeses, esRenovacionFallida, PREFIJO_RENOVACION_FALLIDA, type EntradaCobrado } from '../lib/cobrado-lead';

const HOY = '2026-10-14';
const pago = (monto: number, pagado: boolean, fecha: string | null, extra: Record<string, unknown> = {}) =>
  ({ monto_usd: monto, pagado, fecha_esperada: fecha, fecha_pago: pagado ? fecha : null, ...extra });
const lead = (e: Partial<EntradaCobrado>): EntradaCobrado => ({
  ventaTipo: 'unico', montoCierreUsd: null, suscripcionMontoUsd: null, suscripcionMeses: null, fechaCierre: null, pagos: [], cobros: [], hoy: HOY, ...e,
});

test('⚠️ una mensualidad activa con lo registrado cobrado está «Al día · próxima el …», no «Pagada por completo»', () => {
  const c = cobradoDelLead(lead({
    ventaTipo: 'suscripcion', suscripcionMontoUsd: 800, fechaCierre: '2026-08-05',
    pagos: [pago(800, true, '2026-08-05'), pago(800, true, '2026-09-05'), pago(800, true, '2026-10-05')],
  }));
  assert.equal(c.seDibuja, true);
  assert.deepEqual(c.semaforo, { tono: 'verde', texto: 'Al día · próxima el 05/11' });
  assert.equal(c.cobradoUsd, 2400);
  assert.equal(c.totalUsd, null, 'una suscripción mes a mes no tiene total');
  assert.equal(c.texto, '$2,400 cobrado');
  assert.equal(c.suscripcion?.estado, 'activa');
  assert.equal(c.suscripcion?.mensualidadTexto, '$800/mes');
  assert.equal(c.suscripcion?.proximaRenovacion, '2026-11-05');
  assert.equal(c.suscripcion?.sinRegistrar, 0);
});

test('⚠️ una renovación rechazada NO se pinta en verde, y la que volvió a entrar sí', () => {
  const base = { ventaTipo: 'suscripcion', suscripcionMontoUsd: 50, fechaCierre: '2026-09-01', pagos: [pago(50, true, '2026-09-01')] };
  const rechazada = cobradoDelLead(lead({ ...base, cobros: [{ tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa', motivo: `${PREFIJO_RENOVACION_FALLIDA}: tarjeta sin fondos` }] }));
  assert.deepEqual(rechazada.semaforo, { tono: 'rojo', texto: 'Falló la renovación' });
  assert.equal(rechazada.suscripcion?.fuente, 'pasarela');
  assert.match(rechazada.suscripcion?.renovacionFallida ?? '', /sin fondos/);
  // `aplicarPagoAprobado` borra el motivo cuando entra la siguiente: vuelve a estar al día.
  const repuesta = cobradoDelLead(lead({ ...base, pagos: [...base.pagos, pago(50, true, '2026-10-01')], cobros: [{ tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa', motivo: null }] }));
  assert.equal(repuesta.semaforo.tono, 'verde');
  // Otro motivo (un pago que no se pudo asentar) no es un rechazo de la tarjeta.
  assert.equal(esRenovacionFallida('El pago entró pero no pude asentarlo en el CRM: x'), false);
});

test('una suscripción cancelada (en la pasarela o la manual) es gris, y una de plazo fijo que terminó lo dice', () => {
  const pasarela = cobradoDelLead(lead({ ventaTipo: 'suscripcion', suscripcionMontoUsd: 50, fechaCierre: '2026-01-01', pagos: [pago(50, true, '2026-01-01')], cobros: [{ tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'cancelada', motivo: null }] }));
  assert.deepEqual(pasarela.semaforo, { tono: 'gris', texto: 'Cancelada' });
  const manual = cobradoDelLead(lead({ ventaTipo: 'suscripcion', suscripcionMontoUsd: 50, suscripcionMeses: 3, fechaCierre: '2026-07-01', suscripcionCanceladaAt: '2026-10-01T12:00:00Z', pagos: [pago(50, true, '2026-07-01')] }));
  assert.equal(manual.suscripcion?.estado, 'cancelada');
  assert.equal(manual.semaforo.texto, 'Cancelada');
  const termino = cobradoDelLead(lead({ ventaTipo: 'suscripcion', suscripcionMontoUsd: 100, suscripcionMeses: 3, fechaCierre: '2026-06-10', pagos: [pago(100, true, '2026-06-10'), pago(100, true, '2026-07-10'), pago(100, true, '2026-08-10')] }));
  assert.equal(termino.suscripcion?.estado, 'terminada');
  assert.deepEqual(termino.semaforo, { tono: 'gris', texto: 'Terminó el 10/09' });
  assert.equal(termino.totalUsd, 300, 'plazo fijo: el total es la mensualidad por los meses');
  assert.equal(termino.texto, '$300 cobrado de $300');
});

test('una suscripción manual con meses sin registrar avisa en ámbar («no lo sé» no es «al día»)', () => {
  const c = cobradoDelLead(lead({ ventaTipo: 'suscripcion', suscripcionMontoUsd: 80, fechaCierre: '2026-07-20', pagos: [pago(80, true, '2026-07-20')] }));
  // Empezaron julio, agosto, septiembre y octubre (20/07, 20/08, 20/09): 3 esperadas a hoy, 1 registrada.
  assert.deepEqual(c.semaforo, { tono: 'ambar', texto: 'Falta registrar 2 meses' });
  assert.equal(cobradoDelLead(lead({ ventaTipo: 'suscripcion', suscripcionMontoUsd: 80, fechaCierre: '2026-10-01' })).semaforo.texto, 'Sin cobros registrados');
});

test('⚠️ la plata de una suscripción es su mensualidad: un monto de cierre viejo no cuenta', () => {
  // El 08/10/2026 (ws11): «4.235,29 al mes» de un total de contrato. Leído pelado, el total salía del cierre.
  const c = cobradoDelLead(lead({ ventaTipo: 'suscripcion', montoCierreUsd: 4235.29, suscripcionMontoUsd: 444, suscripcionMeses: 12, fechaCierre: '2026-10-01', pagos: [pago(444, true, '2026-10-01')] }));
  assert.equal(c.totalUsd, 5328);
  assert.equal(c.suscripcion?.mensualidadUsd, 444);
  // Y al revés: un pago único no lee una mensualidad vieja de cuando era suscripción.
  const u = cobradoDelLead(lead({ ventaTipo: 'unico', montoCierreUsd: 1500, suscripcionMontoUsd: 444 }));
  assert.equal(u.totalUsd, 1500);
  assert.equal(u.suscripcion, null);
});

test('un becado no tiene cobrado: el bloque no se dibuja', () => {
  const c = cobradoDelLead(lead({ ventaTipo: 'sin_cobro' }));
  assert.equal(c.seDibuja, false);
  assert.equal(c.texto, 'Sin cobro');
  assert.equal(c.totalUsd, null);
});

test('pago único: pagado por completo, vencida, por vencer y al corriente', () => {
  const total = cobradoDelLead(lead({ montoCierreUsd: 1500, pagos: [pago(500, true, '2026-08-01'), pago(1000, true, '2026-09-01')] }));
  assert.deepEqual(total.semaforo, { tono: 'verde', texto: 'Pagado por completo' });
  assert.equal(total.texto, '$1,500 cobrado de $1,500');
  assert.equal(total.pct, 100);
  const vencida = cobradoDelLead(lead({ montoCierreUsd: 1500, pagos: [pago(500, true, '2026-08-01'), pago(1000, false, '2026-10-01', { id: 9 })] }));
  assert.deepEqual(vencida.semaforo, { tono: 'rojo', texto: 'Cuota vencida' });
  assert.equal(vencida.vencidoUsd, 1000);
  assert.deepEqual(vencida.proxima, { pagoId: 9, fecha: '2026-10-01', montoUsd: 1000 });
  const pronto = cobradoDelLead(lead({ montoCierreUsd: 1500, pagos: [pago(500, true, '2026-08-01'), pago(1000, false, '2026-10-20')] }));
  assert.deepEqual(pronto.semaforo, { tono: 'ambar', texto: 'Cuota por vencer' });
  const lejos = cobradoDelLead(lead({ montoCierreUsd: 1500, pagos: [pago(500, true, '2026-08-01'), pago(1000, false, '2026-12-20')] }));
  assert.deepEqual(lejos.semaforo, { tono: 'verde', texto: 'Al corriente' });
  assert.equal(lejos.pct, 33);
  assert.deepEqual(lejos.cuadra, { diferenciaUsd: 0, cuadra: true });
});

test('⚠️ un pago único sin cuotas NO está «al corriente», y un link cobrado de menos no está «pagado por completo»', () => {
  const sin = cobradoDelLead(lead({ montoCierreUsd: 1500 }));
  assert.deepEqual(sin.semaforo, { tono: 'ambar', texto: 'Sin cuotas cargadas' });
  assert.equal(sin.texto, '$0 cobrado de $1,500');
  // Un link de US$1.000 cobrado sobre un cierre de US$3.000, sin más cuotas.
  const parcial = cobradoDelLead(lead({ montoCierreUsd: 3000, pagos: [pago(1000, true, '2026-10-01', { proveedor: 'stripe', cobro_id: 4 })] }));
  assert.deepEqual(parcial.semaforo, { tono: 'ambar', texto: 'Falta cargar el resto' });
  assert.equal(parcial.totalUsd, 3000, 'el total es lo vendido cuando el plan suma menos');
  assert.deepEqual(parcial.cuadra, { diferenciaUsd: -2000, cuadra: false });
  // Sin venta ni cuotas, no se dibuja.
  assert.equal(cobradoDelLead(lead({})).seDibuja, false);
});

test('una cuota DEVUELTA (reembolso) no es deuda ni cobrado', () => {
  const c = cobradoDelLead(lead({ montoCierreUsd: 500, pagos: [pago(500, false, null, { proveedor: 'stripe', cobro_id: 7 }), pago(500, true, '2026-10-02')] }));
  assert.equal(c.pendienteUsd, 0);
  assert.equal(c.cobradoUsd, 500);
  assert.equal(c.cuotas.total, 1);
  // Una cuota a mano sin fecha SÍ es deuda (no tiene proveedor).
  assert.equal(cobradoDelLead(lead({ montoCierreUsd: 500, pagos: [pago(500, false, null)] })).pendienteUsd, 500);
});

test('lo cobrado en otra moneda se muestra en su moneda original', () => {
  const c = cobradoDelLead(lead({ montoCierreUsd: 1000, pagos: [
    pago(500, true, '2026-09-01', { moneda: 'MXN', monto_original: 8600 }),
    pago(250, true, '2026-10-01', { moneda: 'MXN', monto_original: 4300 }),
    pago(250, true, '2026-10-02', { moneda: 'USD', monto_original: 250 }),
  ] }));
  assert.deepEqual(c.monedas, [{ moneda: 'MXN', monto: 12900 }]);
  assert.equal(c.cobradoUsd, 1000, 'los totales siguen en dólares');
});

test('sumarMeses capa el día al último del mes', () => {
  assert.equal(sumarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(sumarMeses('2028-01-31', 1), '2028-02-29');
  assert.equal(sumarMeses('2026-10-05', 3), '2027-01-05');
});
