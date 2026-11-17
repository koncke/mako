// =============================================================================
// P28 (17/11/2026): los bloques de Pagos que estaban en el catálogo y en las plantillas SIN componente
// =============================================================================
// El pendiente, verificado contra main el 17/11/2026 (docs/pendientes-verificados-17-11.md, «Toca la plata»): «a
// REGISTRO_PAGOS le faltan confirmacion-de-pago, recordatorios-de-cobro, excepciones y cliente-en-cs. Están en
// lib/ficha/catalogo.ts y en las plantillas, así que se saltean callados». Aquí se EJECUTA lo puro de tres de ellos
// (lib/pagos-bloques-lead.ts) y sus reglas, y se fija la regla que deja: ningún bloque que una plantilla pone puede
// quedarse sin componente, porque la ficha lo saltea sin decir nada. El cuarto, `cliente-en-cs`, tiene su propio test
// (tests/ficha-cliente-en-cs.test.ts); aquí sólo entra en la regla de las plantillas.
//
// Correr: node --import tsx --test tests/ficha-pagos-bloques-nuevos.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/11/2026, base 6/0), cada rotura restaurada antes de la siguiente:
//   · REGLAS_PAGOS sin `excepciones` (el bloque vuelve a saltearse)                       → 4 / 2 («plantillas» y «excepciones»)
//   · `confirmacionDePago` sin mirar el primer pago (siempre «no pagó»)                  → 5 / 1 («confirmación»)
//   · `confirmacionDePago` sin `sinCobro` (un becado con alerta)                         → 5 / 1 («confirmación»)
//   · `recordatoriosPorCuota` sin saltear las cuotas cobradas                            → 5 / 1 («recordatorios»)
//   · `recordatoriosPorCuota` ordenando por número y no por vencimiento                  → 5 / 1 («recordatorios»)
//   · `excepcionesDelLead` tomando `false` como puesta (`== null` en vez de `!== true`)  → 5 / 1 («excepciones»)
//   · `deLaCuota(0)` → «de la cuota 0»                                                   → 5 / 1 («recordatorios»)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIAS_CONFIRMADO_EN_ROJO, confirmacionDePago, deLaCuota, excepcionesDelLead, lineaAlQuitar, recordatoriosPorCuota,
  renglonDeRecordatorios, tieneExcepciones, valorAlQuitar,
} from '../lib/pagos-bloques-lead';
import { PLANTILLA_RESPALDO, PLANTILLAS_FICHA } from '../lib/ficha/plantillas';
import { PLANTILLAS_TAB_PAGOS } from '../lib/ficha/plantillas-pagos';
import { PLANTILLAS_TAB_RESUMEN } from '../lib/ficha/plantillas-resumen';
import type { BloqueId, TabFicha } from '../lib/ficha/catalogo';
import { reglasDe } from '../app/crm/lead-view/ficha/reglas';
import { REGLAS_PAGOS, conCuotasSinCobrar } from '../app/crm/lead-view/ficha/reglas-pagos';
import type { CtxFicha } from '../app/crm/lead-view/ficha/tipos';

const HOY = '2026-11-17';

test('plantillas: todo bloque que pone una plantilla tiene componente (si no, la ficha lo saltea callada)', () => {
  const tabs: TabFicha[] = ['resumen', 'tracking', 'reuniones', 'pagos'];
  const listas: Array<{ donde: string; ids: readonly BloqueId[] }> = [];
  for (const p of [PLANTILLA_RESPALDO, ...PLANTILLAS_FICHA]) for (const t of tabs) listas.push({ donde: `${p.id} · ${t}`, ids: p.tabs[t] ?? [] });
  for (const p of [...PLANTILLAS_TAB_PAGOS, ...PLANTILLAS_TAB_RESUMEN]) listas.push({ donde: p.id, ids: p.bloques.map((b) => b.id) });
  // Uno sin componente propio está bien si otro de la MISMA lista lo dibuja adentro (`incluye`: la cohorte va en la R1).
  const sinComponente = listas.flatMap(({ donde, ids }) => ids
    .filter((id) => !reglasDe(id) && !ids.some((otro) => reglasDe(otro)?.incluye?.includes(id)))
    .map((id) => ({ id, donde })));
  const dePagos = sinComponente.filter((x) => x.donde.endsWith('· pagos') || x.donde.startsWith('pagos-'));
  assert.deepEqual(dePagos.map((x) => `${x.id} (${x.donde})`), [], 'estos bloques de Pagos los pone una plantilla y no se dibujan');
  // ⚠️ LA MISMA FALLA FUERA DE PAGOS, medida el 17/11/2026 y fuera de P28 (docs/hallazgos-crm.md, «Bloques que una plantilla
  // pone y no se dibujan»): cuatro bloques de Reuniones y Tracking. Se fijan para que la lista no CREZCA callada; quien le dé
  // componente a uno, lo saca de aquí.
  const CONOCIDOS_SIN_COMPONENTE = ['anuncio-de-origen', 'ciclo-de-venta', 'cohorte', 'diagnostico-mako'];
  assert.deepEqual([...new Set(sinComponente.filter((x) => !dePagos.includes(x)).map((x) => x.id))].sort(), CONOCIDOS_SIN_COMPONENTE);
  for (const id of ['confirmacion-de-pago', 'recordatorios-de-cobro', 'excepciones', 'cliente-en-cs'] as const) {
    assert.ok(REGLAS_PAGOS[id], `${id} tiene sus reglas en Pagos`);
    assert.ok((REGLAS_PAGOS[id].disenos ?? []).length >= 2, `${id} dibuja al menos dos diseños (se ofrece «Diseño»)`);
  }
});

test('confirmación: cuántos días van sin el primer pago, y nada que alertar si pagó o es becado', () => {
  const c = (fechaConfirmacion: string | null, fechaPrimerPago: string | null, sinCobro = false) => confirmacionDePago({ fechaConfirmacion, fechaPrimerPago, sinCobro, hoy: HOY });
  assert.deepEqual(c(null, null), { fecha: null, linea: null, tono: 'gris', cobrar: false }, 'sin fecha: «—» para llenarla');
  const tres = c('2026-11-14', null);
  assert.equal(tres.linea, 'Confirmó hace 3 días y no pagó');
  assert.equal(tres.tono, 'ambar');
  assert.equal(tres.cobrar, true, 'sin el pago, se ofrece cobrar');
  assert.equal(c('2026-11-16', null).linea, 'Confirmó ayer y no pagó');
  assert.equal(c(HOY, null).linea, 'Confirmó hoy y todavía no pagó');
  assert.equal(c('2026-11-01', null).tono, 'rojo', `${DIAS_CONFIRMADO_EN_ROJO} días o más, en rojo`);
  assert.equal(c('2026-11-20', null).linea, 'Confirmó para el 20 de noviembre', 'una fecha que viene no es «hace -3 días»');
  const pago = c('2026-11-10', '2026-11-12');
  assert.deepEqual([pago.linea, pago.tono, pago.cobrar], ['Pagó 2 días después', 'verde', false]);
  assert.equal(c('2026-11-10', '2026-11-08').linea, 'Ya pagó', 'el pago antes de la confirmación cargada no es «-2 días»');
  assert.equal(c('2026-11-10', null, true).cobrar, false, 'un becado no tiene pago que esperar');
  assert.equal(c('2026-11-10', null, true).tono, 'gris');
  assert.equal(c('2026-11-10T15:00:00Z', null).fecha, '2026-11-10', 'un timestamp se lee como su día');
});

test('confirmación: sólo no aplica a quien salió sin confirmar', () => {
  const ctx = (lead: Record<string, unknown>) => ({ lead, data: { pagos: [] } } as unknown as CtxFicha);
  const vacio = REGLAS_PAGOS['confirmacion-de-pago'].estaVacio;
  assert.equal(vacio(ctx({ estado_lead: 'abierto' })), false, 'un lead abierto la llena aquí');
  assert.equal(vacio(ctx({ estado_lead: 'perdido' })), true);
  assert.equal(vacio(ctx({ estado_lead: 'perdido', fecha_confirmacion: '2026-11-01' })), false, 'si confirmó, se ve aunque haya salido');
});

test('recordatorios: las cuotas SIN COBRAR con algo corriendo, por la que vence primero', () => {
  const cuotas = [
    { id: 10, numero: 2, monto_usd: 500, fecha_esperada: '2026-12-05', pagado: false },
    { id: 11, numero: 3, monto_usd: '500', fecha_esperada: '2026-11-10', pagado: false },
    { id: 12, numero: 1, monto_usd: 500, fecha_esperada: '2026-10-05', pagado: true },
  ];
  const rs = recordatoriosPorCuota([
    { id: 1, pagoId: 10, titulo: 'Cobranza', proximaAt: '2026-12-04T15:00:00Z' },
    { id: 2, pagoId: 11, titulo: ' Cobranza de cuotas vencidas ', proximaAt: '2026-11-19T15:00:00Z' },
    { id: 3, pagoId: 11, titulo: null, proximaAt: null },
    { id: 4, pagoId: 12, titulo: 'ya cobrada', proximaAt: '2026-11-20T15:00:00Z' },
    { id: 5, pagoId: 99, titulo: 'de otra cuota', proximaAt: null },
  ], cuotas);
  assert.deepEqual(rs.map((r) => r.numero), [3, 2], 'la vencida primero; la cobrada y la ajena, afuera');
  assert.equal(rs[0].montoUsd, 500, 'el monto llega como texto desde la base');
  assert.deepEqual(rs[0].corridas.map((c) => c.id), [3, 2], 'lo que sale en la próxima vuelta (null) va antes');
  assert.equal(rs[0].proximaAt, null);
  assert.equal(rs[0].corridas[1].titulo, 'Cobranza de cuotas vencidas');
  const cuando = (iso: string | null) => (iso ? 'jue 19 nov, 09:00' : 'en unos minutos');
  assert.equal(renglonDeRecordatorios([rs[1]], cuando), 'MaKo avisa de la cuota 2 · jue 19 nov, 09:00');
  assert.equal(renglonDeRecordatorios(rs, cuando), 'MaKo avisa de 2 cuotas · la próxima, cuota 3 en unos minutos');
  assert.equal(renglonDeRecordatorios([], cuando), null);
  assert.equal(deLaCuota(0), 'del cobro inicial');
  assert.equal(deLaCuota(4), 'de la cuota 4');
  assert.ok(!/le recuerda|al cliente/i.test(renglonDeRecordatorios(rs, cuando) ?? ''), 'salen al grupo de MaKo, nunca al cliente');
});

test('recordatorios: sin cuotas sin cobrar, el bloque ni pide su lectura', () => {
  const ctx = (pagos: Array<{ pagado: boolean }>, tratos?: Array<{ pagos: Array<{ pagado: boolean }> }>) => ({ lead: {}, data: { pagos, tratos } } as unknown as CtxFicha);
  assert.equal(conCuotasSinCobrar(ctx([{ pagado: true }])), false);
  assert.equal(conCuotasSinCobrar(ctx([{ pagado: false }])), true);
  assert.equal(conCuotasSinCobrar(ctx([], [{ pagos: [{ pagado: false }] }])), true, 'la de un CRM agregado también cuenta');
  assert.equal(REGLAS_PAGOS['recordatorios-de-cobro'].estaVacio(ctx([])), true);
});

test('excepciones: las puestas, con su motivo si quedó en el historial, y cómo se quitan', () => {
  const lead = { sin_r1: true, sin_r2: false, fathom_omitido: true, comprobante_omitido: true, deal_fiscal_doc_omitido: null, r2_agenda_externa_motivo: '  la agendó por WhatsApp ' };
  const xs = excepcionesDelLead(lead, { 'Cierre sin R1': 'Ya venía decidido', 'Cierre sin R2': 'no está puesta' });
  assert.deepEqual(xs.map((x) => x.id), ['sin_r1', 'fathom_omitido', 'comprobante_omitido', 'r2_agenda_externa_motivo'], 'false y null no son excepciones');
  assert.equal(xs[0].motivo, 'Ya venía decidido');
  assert.equal(xs[1].motivo, null, 'sin motivo leído, ninguno inventado');
  assert.equal(xs[2].motivo, null, 'las omisiones de la 0069 no dejan motivo');
  assert.equal(xs[3].motivo, 'la agendó por WhatsApp', 'la R2 por fuera: el motivo es el valor');
  assert.equal(tieneExcepciones({}), false);
  assert.equal(tieneExcepciones({ r2_agenda_externa_motivo: '   ' }), false, 'un motivo vacío no es una excepción');
  assert.equal(tieneExcepciones({ sin_r2: true }), true);
  assert.equal(valorAlQuitar('sin_r1'), false);
  assert.equal(valorAlQuitar('r2_agenda_externa_motivo'), null);
  assert.equal(lineaAlQuitar('sin_r1'), 'Se quitó «Cerró sin R1»: el dato se vuelve a pedir');
  const ctx = (l: Record<string, unknown>) => ({ lead: l, data: { pagos: [] } } as unknown as CtxFicha);
  assert.equal(REGLAS_PAGOS.excepciones.estaVacio(ctx({})), true, 'sin ninguna, no se dibuja');
  assert.equal(REGLAS_PAGOS.excepciones.estaVacio(ctx({ fathom_omitido: true })), false);
});
