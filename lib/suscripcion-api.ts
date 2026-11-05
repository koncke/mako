// =============================================================================
// suscripcion-api — lo que la API de MaKo dice de una suscripción mes a mes (puro)
// =============================================================================
// La misma cuenta que la tab Pagos (lib/suscripcion-meses.ts), en el formato que lee un modelo: los meses con lo que
// tocaba y lo que pagó, y lo que cambió, con la unidad en el nombre del campo (AGENTS.md: lo que le devuelve una tool a
// un modelo es TODO lo que el modelo sabe). Lo usan `cobranza_lead` (lib/api-mako/areas/crm.run.ts) y
// `ver_suscripcion_lead` (lib/api-mako/areas/cobros.run.ts).
// =============================================================================

import { nombreDelMes, ROTULO_CAMBIO, ROTULO_ESTADO_MES, type HistoriaSuscripcion, type MesSuscripcion } from './suscripcion-meses';

const mesParaModelo = (m: MesSuscripcion, hoy: string) => ({
  mes: m.mes,
  nombre: nombreDelMes(m.mes, hoy),
  vence: m.vence,
  tocaba_usd: m.esperadoUsd,
  pagado_usd: m.pagadoUsd,
  falta_usd: m.faltaUsd,
  estado: ROTULO_ESTADO_MES[m.estado],
  ...(m.cambio ? { cambio: ROTULO_CAMBIO[m.cambio], ...(m.antesUsd != null ? { antes_usd: m.antesUsd } : {}) } : {}),
  pagos: m.pagos.map((p) => ({ pago_id: p.id, monto_usd: p.montoUsd, fecha: p.fecha, metodo: p.metodo, ...(p.totalUsd != null ? { parte_de_un_pago_de_usd: p.totalUsd } : {}) })),
  ...(m.ajustes.length ? { ajustes: m.ajustes.map((a) => ({ pago_id: a.id, monto_usd: a.montoUsd, fecha: a.fecha, concepto: a.concepto })) } : {}),
});

/**
 * Lo que `cobranza_lead` suma a la suscripción: los últimos meses y si la mensualidad es una estimación. `cambios`: lo que
 * devolvió `cambiosDeSuscripcion` (null si no se pidió).
 */
export function resumenMesAMes(
  s: { historia: HistoriaSuscripcion; mensualidadInferida: boolean },
  cambios: { leido: boolean; faltaMigracion: boolean } | null,
  o: { hoy?: string; ultimos?: number } = {},
): Record<string, unknown> {
  const hoy = o.hoy ?? new Date().toISOString().slice(0, 10);
  const h = s.historia;
  return {
    ...(s.mensualidadInferida ? { mensualidad_estimada: 'La mensualidad no está cargada: sale de lo que pagó el último mes. Cárgala con cambiar_suscripcion.' } : {}),
    ...(h.meses.length ? { meses: h.meses.slice(-(o.ultimos ?? 6)).map((m) => mesParaModelo(m, hoy)) } : {}),
    ...(cambios && !cambios.leido ? { cambios_sin_leer: 'No pude leer los cambios de monto: los meses usan la mensualidad de hoy.' } : {}),
  };
}

/** La respuesta entera de `ver_suscripcion_lead`. */
export function suscripcionParaModelo(e: {
  leadId: number; nombre: string | null; historia: HistoriaSuscripcion; estado: string; fuente: 'manual' | 'pasarela'; mensualidadInferida: boolean;
  cambios: Array<{ id: number; tipo: string; desde: string; montoUsd?: number | null; dia?: number | null; nota?: string | null }>;
  cambiosLeidos: boolean; faltaMigracion: boolean; hoy: string;
}): Record<string, unknown> {
  const h = e.historia;
  return {
    lead_id: e.leadId,
    nombre: e.nombre,
    estado: e.estado,
    cobra: e.fuente === 'pasarela' ? 'la pasarela (Stripe o Mercado Pago)' : 'a mano (se registra cada pago)',
    paga_hoy_usd: h.montoHoyUsd,
    ...(e.mensualidadInferida ? { paga_hoy_es_estimado: 'No está cargada: sale de lo que pagó el último mes.' } : {}),
    dia_de_cobro: h.diaDeCobro,
    proximo: h.proximo ? { mes: h.proximo.mes, vence: h.proximo.vence, falta_usd: h.proximo.faltaUsd, vencido: h.proximo.vencido } : null,
    pagado_en_total_usd: h.totalPagadoUsd,
    ajustes_usd: h.ajustesUsd,
    meses_sin_pagar: h.mesesSinPagar,
    meses_con_pago_parcial: h.mesesParciales,
    debe_usd: h.deudaUsd,
    ...(h.cortadaDesde ? { cortada_desde: h.cortadaDesde } : {}),
    ...(h.terminada ? { termino_el_plazo: true } : {}),
    meses: h.meses.map((m) => mesParaModelo(m, e.hoy)),
    cambios: e.cambios.map((c) => ({ id: c.id, tipo: c.tipo, desde: c.desde, ...(c.montoUsd != null ? { monto_usd: c.montoUsd } : {}), ...(c.dia != null ? { dia: c.dia } : {}), ...(c.nota ? { nota: c.nota } : {}) })),
    ...(e.faltaMigracion ? { nota: 'Los cambios de monto, los cortes y el mes de cada pago se guardan desde la migración 0401, que todavía no está aplicada: los meses usan la mensualidad de hoy.' } : {}),
    ...(!e.cambiosLeidos ? { cambios_sin_leer: 'No pude leer los cambios de monto: los meses usan la mensualidad de hoy.' } : {}),
  };
}
