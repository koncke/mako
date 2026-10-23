// =============================================================================
// subir-plan-reglas — «Pasar a Pro»: a qué plan, a qué precio, y si ya está (23/10/2026)
// =============================================================================
// Puro: lo usan lib/subir-plan.ts y tests/subir-plan.test.ts. Lo que pasa en la pasarela está en lib/subir-plan.ts.
// =============================================================================

import { precioEn, type PlanMako } from './planes-mako';

/** El plan al que se sube desde «Tu plan» y los carteles de tope (lib/topes-plan.ts, RUTA_CAMBIAR_PLAN). */
export const PLAN_PRO = 'pro';
/** La marca de «se está subiendo» (compare-and-set): dos clics, o dos pestañas, no cobran dos veces. */
export const CLAVE_SUBIDA = 'plan.subida';
/** Una subida que quedó «aplicando» más que esto (un corte a mitad de camino) se puede volver a intentar. */
export const SUBIDA_VENCE_MS = 5 * 60_000;

export type Subida =
  | { accion: 'subir'; destino: PlanMako; mensual: number; anual: number | null }
  | { accion: 'ya'; destino: PlanMako }
  | { accion: 'no'; motivo: string };

/**
 * Qué hacer al tocar «Pasar a Pro». `planActual` es el `plan_mako` del cobro; `capa`, la del negocio. Ya es Pro si su
 * cobro dice Pro (la capa sola no alcanza: un acuerdo a mano puede tener capa `agencia` y pagar otra cosa). El precio,
 * en la moneda que cobra la pasarela: USD en Stripe; la del sitio en Mercado Pago (sin ella, no se inventa una tasa).
 */
export function decidirSubida(p: { planActual: string | null; planes: readonly PlanMako[]; moneda: string; proveedor: 'stripe' | 'mercadopago' }): Subida {
  const destino = p.planes.find((x) => x.id === PLAN_PRO && x.activo);
  if (!destino) return { accion: 'no', motivo: 'MaKo Pro no está a la venta ahora. Escríbenos.' };
  if (p.planActual === PLAN_PRO) return { accion: 'ya', destino };
  const actual = p.planActual ? p.planes.find((x) => x.id === p.planActual) ?? null : null;
  const mensual = precioEn(destino, p.moneda);
  if (mensual == null) return { accion: 'no', motivo: `MaKo Pro no tiene precio en ${p.moneda.toUpperCase()}. Escríbenos y lo pasamos a mano.` };
  // Sólo se SUBE: a un plan que cuesta más que el de hoy (bajar es la retención, con su propia regla).
  const hoy = actual ? precioEn(actual, p.moneda) : null;
  if (hoy != null && hoy >= mensual) return { accion: 'no', motivo: `Tu plan ya cuesta lo mismo o más que ${destino.nombre}.` };
  // El anual sólo en Stripe (Mercado Pago cobra por mes) y sólo en USD.
  const anual = p.proveedor === 'stripe' && p.moneda.toUpperCase() === 'USD' ? destino.precioAnualUsd ?? null : null;
  return { accion: 'subir', destino, mensual, anual };
}

/** ¿Se puede reclamar la subida? Libre, con error, o una «aplicando» que venció. */
export function subidaLibre(guardada: string | null, ahoraMs: number): boolean {
  if (!guardada) return true;
  try {
    const g = JSON.parse(guardada) as { estado?: string; at?: string };
    if (g.estado !== 'aplicando') return true;
    const at = Date.parse(String(g.at ?? ''));
    return !Number.isFinite(at) || ahoraMs - at > SUBIDA_VENCE_MS;
  } catch {
    return true;
  }
}
