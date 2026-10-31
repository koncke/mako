// =============================================================================
// retencion-reglas — la marca de la oferta de retención de un negocio (lo puro; lib/retencion-plan.ts la aplica)
// =============================================================================
// Aparte para que la cobertura (lib/plan-acceso.ts) lea la PAUSA sin importar la pasarela (y sin un círculo de imports).
// =============================================================================


export const CLAVE_RETENCION = 'plan.retencion';

import type { Pasarela } from './cobros-tipos';

export type OpcionRetencion = 'descuento' | 'pausa' | 'bajar';

export type Guardada = {
  estado: 'aplicando' | 'aplicada' | 'error';
  opcion: OpcionRetencion;
  cobroId: number; pasarela: Pasarela;
  aplicadaAt: string; montoOriginal: number; moneda: string;
  pct?: number; meses?: number;
  /** La pausa: hasta cuándo cubre (fecha). */
  hasta?: string;
  /** El monto que tiene que quedar en la pasarela (descuento, bajar): con esto se concilia una marca trabada. */
  objetivo?: number;
  /** El plan al que se baja. */
  planDestino?: string;
  /** MP: el descuento se restaura al cobrarse `meses` cuotas desde este día (local, YYYY-MM-DD). */
  restaurarDesde?: string;
  /** Bajar: la capa nueva entra al terminar el período pagado (revisión del 23/10, R6). */
  capaPendiente?: { capa: string; desde: string } | null;
  restaurada?: boolean; error?: string;
};

export function leerRetencion(crudo: string | null | undefined): Guardada | null {
  try {
    const v = crudo ? (JSON.parse(crudo) as Guardada) : null;
    return v && typeof v.cobroId === 'number' ? { ...v, opcion: v.opcion ?? 'descuento' } : null;
  } catch { return null; }
}

/** Los meses que una PAUSA aceptada cubre sin cobro (lo lee la cobertura de lib/plan-acceso.ts). */
export function mesesDePausa(g: Guardada | null): Array<{ fecha: string; meses: number }> {
  if (!g || g.opcion !== 'pausa' || g.estado !== 'aplicada' || !g.meses) return [];
  return [{ fecha: g.aplicadaAt.slice(0, 10), meses: g.meses }];
}

