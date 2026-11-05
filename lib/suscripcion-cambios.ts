// =============================================================================
// suscripcion-cambios — cambiar una suscripción: el monto desde un mes, cortarla, retomarla y registrar un pago
// =============================================================================
// UNA implementación para las dos puertas: la tab Pagos (app/crm/[id]/suscripcion-actions.ts) y la API de MaKo
// (`cambiar_suscripcion` y `registrar_pago_suelto` con `mes`, lib/api-mako/areas/). Las reglas son puras
// (lib/suscripcion-meses.ts); la base, lib/suscripcion-movimientos.ts.
//
// ⚠️ NO SE REESCRIBE EL PASADO. Un cambio se AGREGA con la fecha desde la que vale; la primera vez que cambia el monto se
//    guarda antes el de antes desde el inicio (`conElMontoDeAntes`). Lo único que se borra es lo recién agregado (Deshacer).
// ⚠️ LO DEL LEAD SE MANTIENE EN SINTONÍA, para los que todavía lo leen solo: `suscripcion_monto_usd` pasa a la mensualidad
//    de HOY (un cambio para diciembre no la toca en noviembre), y un corte de este mes (o de antes) cancela con
//    `cambiarEstadoSuscripcionManual` (la marca vieja que miran el MRR viejo, «A quién cobrar» y Customers), y una vuelta
//    la reactiva. Un corte para un mes que viene no cancela hoy: cuenta hasta ese mes (el MRR mira los cambios).
// ⚠️ UNA SUSCRIPCIÓN QUE COBRA LA PASARELA NO SE CAMBIA DESDE ACÁ: la cobra Stripe o Mercado Pago y su monto es el de su
//    cobro. Quien llama lo pregunta antes (`laCobraLaPasarela`).
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getLead, logLeadChanges, logLeadEvent } from './leads';
import { hoyEnWorkspace } from './timezone';
import { anotarEnHistorial, cambiarEstadoSuscripcionManual, registrarPagoSuelto, type DatosDeMoneda } from './pagos';
import { mesesTranscurridos } from './cobros-reglas';
import { agregarMovimientos, cambiosDeSuscripcion, conElMontoDeAntes, marcarMesDelPago, quitarMovimientos, type MovimientoNuevo } from './suscripcion-movimientos';
import { mesDe, montoVigente, nombreDelMes, ordenarMovimientos, type MovimientoSuscripcion, type TipoMovimiento } from './suscripcion-meses';

const usd = (n: number) => `US$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const esMes = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(s);

export type CambioSuscripcion = {
  tipo: TipoMovimiento;
  /** YYYY-MM (o una fecha): desde qué mes vale. */
  desde: string;
  /** `monto`: la mensualidad nueva en dólares. `vuelta`: con cuánto vuelve (sin él, con la de antes). */
  montoUsd?: number | null;
  /** El día de cobro desde ese mes (1-31). */
  dia?: number | null;
  nota?: string | null;
};

type Resultado = { ok: true; ids: number[]; resumen: string; yaEstaba?: boolean } | { ok: false; error: string; faltaMigracion?: boolean };

/** ¿Está cortada en ese mes, con los cambios guardados y la cancelación vieja? */
function cortadaEn(mes: string, movs: readonly MovimientoSuscripcion[], canceladaAt: string | null): boolean {
  const cortes = movs.filter((m) => m.tipo === 'corte' || m.tipo === 'vuelta');
  if (!cortes.some((m) => m.tipo === 'corte') && canceladaAt) return mesDe(canceladaAt) <= mes;
  let c = false;
  for (const m of cortes) if (mesDe(m.desde) <= mes) c = m.tipo === 'corte';
  return c;
}

/** Valida un cambio (puro, para la pantalla, la API y el test): devuelve el error o null. */
export function problemaDelCambio(c: Partial<CambioSuscripcion>): string | null {
  if (!c.tipo || !['monto', 'corte', 'vuelta'].includes(c.tipo)) return 'El cambio va: monto, corte o vuelta.';
  if (!esMes(c.desde)) return 'Falta desde qué mes (AAAA-MM).';
  if (c.tipo === 'monto' && !(Number(c.montoUsd) > 0)) return 'Falta la mensualidad nueva, en dólares.';
  if (c.montoUsd != null && !(Number(c.montoUsd) > 0 && Number(c.montoUsd) <= 10_000_000)) return 'La mensualidad tiene que ser mayor a cero.';
  if (c.dia != null && !(Number.isInteger(Number(c.dia)) && Number(c.dia) >= 1 && Number(c.dia) <= 31)) return 'El día de cobro va del 1 al 31.';
  return null;
}

/** Deja `suscripcion_monto_usd` en la mensualidad de hoy, con su diff en el historial. */
async function sincronizarMonto(leadId: number, hoy: string, autor: string): Promise<void> {
  const [lead, cambios] = await Promise.all([getLead(leadId), cambiosDeSuscripcion(leadId)]);
  if (!lead || !cambios.leido) return;
  const hoyVale = montoVigente(lead.suscripcion_monto_usd ?? null, cambios.movimientos, hoy);
  if (hoyVale == null || Number(lead.suscripcion_monto_usd) === hoyVale) return;
  const db = await getTenantDb();
  const { error } = await db.from('leads').update({ suscripcion_monto_usd: hoyVale }).eq('id', leadId).eq('venta_tipo', 'suscripcion');
  if (error) { console.error(`[suscripcion] la mensualidad de hoy del lead ${leadId}: ${error.message}`); return; }
  await logLeadChanges(leadId, lead, await getLead(leadId).catch(() => null), autor);
}

/** El corte o la vuelta de hoy, en la marca vieja (`suscripcion_cancelada_at`). */
async function sincronizarCancelacion(leadId: number, hoy: string, autor: string): Promise<void> {
  const [lead, cambios] = await Promise.all([getLead(leadId), cambiosDeSuscripcion(leadId)]);
  if (!lead || !cambios.leido || !cambios.movimientos.some((m) => m.tipo === 'corte' || m.tipo === 'vuelta')) return;
  const canceladaAt = ((lead as unknown as { suscripcion_cancelada_at?: string | null }).suscripcion_cancelada_at) ?? null;
  const cortadaHoy = cortadaEn(mesDe(hoy), cambios.movimientos, null);
  if (cortadaHoy === !!canceladaAt) return;
  await cambiarEstadoSuscripcionManual(leadId, cortadaHoy ? 'cancelada' : 'activa', { hoy, mesesAlCancelar: mesesTranscurridos(lead.fecha_cierre ?? null, hoy), mesesAlReactivar: null, autor });
}

/** CAMBIAR UNA SUSCRIPCIÓN: el monto desde un mes, cortarla o retomarla. Devuelve los ids agregados (para el Deshacer). */
export async function cambiarSuscripcion(leadId: number, c: CambioSuscripcion, autor: string): Promise<Resultado> {
  const problema = problemaDelCambio(c);
  if (problema) return { ok: false, error: problema };
  const lead = await getLead(leadId);
  if (!lead) return { ok: false, error: 'No encontré ese lead en este negocio.' };
  if (lead.venta_tipo !== 'suscripcion') return { ok: false, error: `${lead.nombre} no es una suscripción.` };
  const [hoy, cambios] = await Promise.all([hoyEnWorkspace(), cambiosDeSuscripcion(leadId)]);
  if (cambios.faltaMigracion) return { ok: false, error: 'Todavía no se puede guardar: falta la migración 0398 (los cambios de una suscripción). No se escribió nada.', faltaMigracion: true };
  if (!cambios.leido) return { ok: false, error: 'No pude leer los cambios de esta suscripción. Prueba de nuevo en un rato.' };
  const mes = mesDe(c.desde.length === 7 ? `${c.desde}-01` : c.desde);
  const existentes = ordenarMovimientos(cambios.movimientos);
  const canceladaAt = ((lead as unknown as { suscripcion_cancelada_at?: string | null }).suscripcion_cancelada_at) ?? null;
  const inicio = lead.fecha_cierre ? String(lead.fecha_cierre).slice(0, 10) : null;
  if (inicio && mes < mesDe(inicio)) return { ok: false, error: `La suscripción empezó en ${nombreDelMes(mesDe(inicio), hoy)}: el cambio tiene que ser desde ese mes o después.` };

  if (c.tipo === 'corte' && cortadaEn(mes, existentes, canceladaAt)) return { ok: true, ids: [], resumen: `Ya estaba cortada en ${nombreDelMes(mes, hoy)}.`, yaEstaba: true };
  if (c.tipo === 'vuelta' && !cortadaEn(mes, existentes, canceladaAt)) return { ok: false, error: `No está cortada en ${nombreDelMes(mes, hoy)}: no hay nada que retomar.` };
  if (c.tipo === 'monto') {
    const hoyVale = montoVigente(lead.suscripcion_monto_usd ?? null, existentes, `${mes}-01`);
    if (hoyVale != null && Math.abs(hoyVale - Number(c.montoUsd)) < 0.005 && c.dia == null) return { ok: true, ids: [], resumen: `Desde ${nombreDelMes(mes, hoy)} ya era ${usd(hoyVale)}.`, yaEstaba: true };
  }

  const nuevo: MovimientoNuevo = {
    tipo: c.tipo, desde: `${mes}-01`, montoUsd: c.montoUsd != null ? Math.round(Number(c.montoUsd) * 100) / 100 : null,
    dia: c.dia != null ? Number(c.dia) : null, nota: c.nota?.trim() || null,
  };
  // La cancelación vieja, si la había y no hay cortes guardados, queda escrita como corte antes de la vuelta.
  const previos: MovimientoNuevo[] = [];
  if (c.tipo === 'vuelta' && canceladaAt && !existentes.some((m) => m.tipo === 'corte')) {
    previos.push({ tipo: 'corte', desde: `${mesDe(canceladaAt)}-01`, nota: 'La cancelación de antes' });
  }
  const filas = conElMontoDeAntes([...previos, nuevo], {
    existentes, montoAntes: Number(lead.suscripcion_monto_usd) > 0 ? Number(lead.suscripcion_monto_usd) : null, inicio,
  });
  const r = await agregarMovimientos(leadId, filas, autor);
  if (!r.ok) return r;
  await sincronizarMonto(leadId, hoy, autor);
  await sincronizarCancelacion(leadId, hoy, autor);
  const desde = nombreDelMes(mes, hoy);
  const resumen = c.tipo === 'monto'
    ? `Desde ${desde}: ${usd(Number(c.montoUsd))} por mes${c.dia ? `, cobra el día ${c.dia}` : ''}.`
    : c.tipo === 'corte' ? `Cortada desde ${desde}: no se le cobra desde ese mes.`
    : `Vuelve desde ${desde}${c.montoUsd ? ` con ${usd(Number(c.montoUsd))} por mes` : ''}.`;
  await anotarEnHistorial(leadId, [{ campo: 'Suscripción', valor_anterior: null, valor_nuevo: resumen }], autor);
  return { ok: true, ids: r.ids, resumen };
}

/** DESHACER un cambio recién hecho: borra esos ids y vuelve a dejar el monto y la cancelación de hoy. */
export async function deshacerCambioSuscripcion(leadId: number, ids: readonly number[], autor: string): Promise<{ ok: boolean; error?: string }> {
  const r = await quitarMovimientos(leadId, ids);
  if (!r.ok) return r;
  const hoy = await hoyEnWorkspace();
  await sincronizarMonto(leadId, hoy, autor);
  await sincronizarCancelacion(leadId, hoy, autor);
  await anotarEnHistorial(leadId, [{ campo: 'Suscripción', valor_anterior: null, valor_nuevo: 'Se deshizo el último cambio' }], autor);
  return { ok: true };
}

export type PagoDeSuscripcionNuevo = {
  /** Dólares (lo que suma a los reportes). */
  monto: number;
  fecha: string;
  hora?: string | null;
  /** YYYY-MM: el mes que paga. null = el más viejo que falta. Ignorado si es un ajuste. */
  mes?: string | null;
  /** Un ajuste (un diferencial, un prorrateo): suma a lo cobrado y no paga ningún mes. */
  ajuste?: boolean;
} & DatosDeMoneda;

/**
 * REGISTRAR UN PAGO de una suscripción: entra como un pago cobrado (`registrarPagoSuelto`, el mismo camino que cualquier
 * cobro: suma al cash y corta los recordatorios) y después se le dice su mes o que es un ajuste (UPDATE aparte que no
 * tira: sin la 0398 el pago queda igual y su mes sale por orden). `mesGuardado: false` = se registró sin su mes.
 */
export async function registrarPagoDeSuscripcion(leadId: number, d: PagoDeSuscripcionNuevo, autor: string): Promise<{ pagoId: number; monto: number; mesGuardado: boolean; texto: string }> {
  const hoy = await hoyEnWorkspace();
  const ajuste = !!d.ajuste;
  const mes = !ajuste && esMes(d.mes) ? mesDe(d.mes.length === 7 ? `${d.mes}-01` : d.mes) : null;
  const concepto = d.concepto?.trim() || (ajuste ? 'Ajuste' : mes ? `Mensualidad de ${nombreDelMes(mes, hoy)}` : 'Mensualidad');
  const r = await registrarPagoSuelto(leadId, { monto: d.monto, fecha: d.fecha, hora: d.hora ?? null, mensualidad: !ajuste, moneda: d.moneda ?? null, montoOriginal: d.montoOriginal ?? null, metodo: d.metodo ?? null, concepto });
  const mesGuardado = mes || ajuste ? await marcarMesDelPago(r.pagoId, leadId, { mes, ajuste }) : true;
  const texto = `${usd(r.monto)} · ${concepto}`;
  await logLeadEvent(leadId, 'Pago registrado', `${texto} el ${d.fecha}`, autor);
  return { pagoId: r.pagoId, monto: r.monto, mesGuardado, texto };
}
