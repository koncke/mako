// =============================================================================
// suscripcion-movimientos — la BASE de los cambios de una suscripción (mig 0401) y a qué mes va cada pago
// =============================================================================
// Las reglas son de lib/suscripcion-meses.ts (puras); esto lee y escribe. Lo usan la ficha (app/crm/[id]/suscripcion-
// actions.ts), el MRR (`getMrrActivo`), «A quién cobrar» (`getSuscripcionesPorCobrar`) y la API de MaKo.
//
// ⚠️ SIN LA 0401 NADA SE ROMPE: leer devuelve «sin cambios» (`faltaMigracion: true`) y todo cuenta como antes, con el monto
//    del lead. Escribir un cambio dice que falta la migración (`FALTA_0401`), y el mes de un pago va en un UPDATE APARTE que
//    no tira (el pago se registra igual: su mes sale por orden). Molde: `etiquetarPago` (lib/pagos.ts, mig 0292).
// ⚠️ SE AGREGA, NUNCA SE EDITA: un cambio nuevo no toca los de antes (no se reescribe el pasado). Lo único que se borra es
//    lo que se acaba de agregar, con el «Deshacer» de la pantalla (`quitarMovimientos`, por id y del lead).
// ⚠️ LA PRIMERA VEZ QUE CAMBIA EL MONTO, SE GUARDA EL DE ANTES (`conElMontoDeAntes`): sin eso, los meses de antes
//    quedarían sin monto (`montoDelMes` no inventa con el de hoy) y octubre de Código diría «sin monto» en vez de 146.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { esTipoMovimiento, mesDe, ordenarMovimientos, type MovimientoSuscripcion, type TipoMovimiento } from './suscripcion-meses';

export const TABLA_MOVIMIENTOS = 'suscripcion_movimientos';
export const FALTA_0401 = 'Todavía no se puede guardar: falta la migración 0401 (los cambios de una suscripción). No se escribió nada.';

/** ¿Falta la tabla (la 0401 sin aplicar)? */
export const faltaLaTabla = (e: { code?: string | null } | null | undefined): boolean => !!e && (e.code === '42P01' || e.code === 'PGRST205');
/** ¿Falta una columna (la 0401 sin aplicar, en `pagos`)? */
const faltaColumna = (e: { code?: string | null } | null | undefined): boolean => !!e && (e.code === '42703' || e.code === 'PGRST204');

type Fila = {
  id: number; lead_id: number; tipo: string; desde: string; monto_usd: number | string | null; moneda: string | null; monto_original: number | string | null;
  dia: number | null; nota: string | null; por: string | null; created_at: string | null;
};

export type MovimientoGuardado = MovimientoSuscripcion & { id: number; leadId: number; moneda: string | null; montoOriginal: number | null; por: string | null };

const deFila = (f: Fila): MovimientoGuardado | null => {
  if (!esTipoMovimiento(f.tipo)) return null;
  const monto = f.monto_usd == null ? null : Number(f.monto_usd);
  return {
    id: Number(f.id), leadId: Number(f.lead_id), tipo: f.tipo, desde: String(f.desde).slice(0, 10),
    montoUsd: monto != null && Number.isFinite(monto) ? monto : null, dia: f.dia == null ? null : Number(f.dia), nota: f.nota ?? null,
    moneda: f.moneda ?? null, montoOriginal: f.monto_original == null ? null : Number(f.monto_original), por: f.por ?? null, created_at: f.created_at ?? null,
  };
};

/**
 * Los cambios de varios leads, por lead. `leido: false` si la consulta falló (no es «sin cambios»: quien decide algo con
 * esto lo dice); `faltaMigracion: true` si la tabla no existe (eso SÍ es «sin cambios»: todo cuenta como antes).
 */
export async function leerCambiosDeSuscripcion(leadIds: readonly number[]): Promise<{ porLead: Map<number, MovimientoGuardado[]>; leido: boolean; faltaMigracion: boolean }> {
  const porLead = new Map<number, MovimientoGuardado[]>();
  const ids = [...new Set(leadIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return { porLead, leido: true, faltaMigracion: false };
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from(TABLA_MOVIMIENTOS)
      .select('id, lead_id, tipo, desde, monto_usd, moneda, monto_original, dia, nota, por, created_at')
      .in('lead_id', ids).order('desde', { ascending: true }).order('id', { ascending: true }).limit(5000);
    if (error) {
      if (faltaLaTabla(error)) return { porLead, leido: true, faltaMigracion: true };
      console.error('[suscripcion] leer los cambios:', error.message);
      return { porLead, leido: false, faltaMigracion: false };
    }
    for (const f of (data ?? []) as Fila[]) {
      const m = deFila(f);
      if (m) porLead.set(m.leadId, [...(porLead.get(m.leadId) ?? []), m]);
    }
    for (const [k, v] of porLead) porLead.set(k, ordenarMovimientos(v) as MovimientoGuardado[]);
    return { porLead, leido: true, faltaMigracion: false };
  } catch (e) {
    console.error('[suscripcion] leer los cambios:', e instanceof Error ? e.message : e);
    return { porLead, leido: false, faltaMigracion: false };
  }
}

/** Los cambios de UN lead. */
export async function cambiosDeSuscripcion(leadId: number): Promise<{ movimientos: MovimientoGuardado[]; leido: boolean; faltaMigracion: boolean }> {
  const r = await leerCambiosDeSuscripcion([leadId]);
  return { movimientos: r.porLead.get(leadId) ?? [], leido: r.leido, faltaMigracion: r.faltaMigracion };
}

export type MovimientoNuevo = {
  tipo: TipoMovimiento;
  /** YYYY-MM-DD o YYYY-MM: vale desde ese mes. */
  desde: string;
  montoUsd?: number | null;
  moneda?: string | null;
  montoOriginal?: number | null;
  dia?: number | null;
  nota?: string | null;
};

/** La fecha que se guarda: el día 1 del mes (o la fecha tal cual si es la venta: el primer mes vence ese día). */
export const desdeDe = (s: string): string => (/^\d{4}-\d{2}$/.test(s) ? `${s}-01` : s.slice(0, 10));

/**
 * ⚠️ LA PRIMERA VEZ QUE CAMBIA EL MONTO (no hay ningún cambio con monto guardado), se agrega antes el monto de ANTES desde
 * el inicio, así los meses de antes no se reescriben. Sin monto de antes o sin inicio, no hay nada que guardar: esos meses
 * se ven por lo que se pagó.
 */
export function conElMontoDeAntes(
  nuevos: readonly MovimientoNuevo[],
  e: { existentes: readonly MovimientoSuscripcion[]; montoAntes: number | null; inicio: string | null },
): MovimientoNuevo[] {
  const conMonto = (m: { tipo: string; montoUsd?: number | null }) => (m.tipo === 'monto' || m.tipo === 'vuelta') && m.montoUsd != null && m.montoUsd > 0;
  if (e.existentes.some(conMonto) || !nuevos.some(conMonto) || e.montoAntes == null || !(e.montoAntes > 0) || !e.inicio) return [...nuevos];
  const mesInicio = mesDe(e.inicio);
  // Si el cambio vale desde el primer mes, no hay un «antes» que guardar.
  if (nuevos.filter(conMonto).every((m) => mesDe(desdeDe(m.desde)) <= mesInicio)) return [...nuevos];
  return [{ tipo: 'monto', desde: e.inicio.slice(0, 10), montoUsd: e.montoAntes, nota: 'El monto de antes del primer cambio' }, ...nuevos];
}

/** Agrega cambios a la suscripción de un lead. Devuelve los ids (para el Deshacer). */
export async function agregarMovimientos(leadId: number, movs: readonly MovimientoNuevo[], por: string): Promise<{ ok: true; ids: number[] } | { ok: false; error: string; faltaMigracion?: boolean }> {
  if (!movs.length) return { ok: true, ids: [] };
  const db = await getTenantDb();
  const filas = movs.map((m) => ({
    lead_id: leadId, tipo: m.tipo, desde: desdeDe(m.desde), monto_usd: m.montoUsd ?? null, moneda: m.moneda ?? null, monto_original: m.montoOriginal ?? null,
    dia: m.dia ?? null, nota: m.nota?.slice(0, 300) ?? null, por: por.slice(0, 120),
  }));
  const { data, error } = await db.from(TABLA_MOVIMIENTOS).insert(filas).select('id');
  if (error) return faltaLaTabla(error) ? { ok: false, error: FALTA_0401, faltaMigracion: true } : { ok: false, error: `No pude guardar el cambio: ${error.message}` };
  return { ok: true, ids: ((data ?? []) as Array<{ id: number }>).map((r) => Number(r.id)) };
}

/** El «Deshacer» de lo que se acaba de agregar: borra esos ids, sólo si son de este lead (y de este negocio: getTenantDb). */
export async function quitarMovimientos(leadId: number, ids: readonly number[]): Promise<{ ok: boolean; error?: string }> {
  const limpios = ids.filter((n) => Number.isFinite(n) && n > 0);
  if (!limpios.length) return { ok: true };
  const db = await getTenantDb();
  const { error } = await db.from(TABLA_MOVIMIENTOS).delete().eq('lead_id', leadId).in('id', limpios);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * A qué mes va un pago de una suscripción, o si es un ajuste (mig 0401). UPDATE APARTE QUE NO TIRA: sin la migración,
 * el pago ya quedó registrado y su mes sale por orden. Devuelve si se guardó.
 */
export async function marcarMesDelPago(pagoId: number, leadId: number, d: { mes: string | null; ajuste: boolean }): Promise<boolean> {
  try {
    const db = await getTenantDb();
    const { error } = await db.from('pagos')
      .update({ suscripcion_mes: d.mes ? desdeDe(d.mes) : null, suscripcion_ajuste: d.ajuste })
      .eq('id', pagoId).eq('lead_id', leadId);
    if (error) {
      console.error(`[suscripcion] el mes del pago ${pagoId} no se guardó${faltaColumna(error) ? ' (falta la migración 0401)' : ''}: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[suscripcion] el mes del pago ${pagoId}:`, e instanceof Error ? e.message : e);
    return false;
  }
}
