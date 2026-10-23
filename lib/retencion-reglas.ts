// =============================================================================
// retencion-reglas — la marca de la oferta de retención de un negocio (lo puro; lib/retencion-plan.ts la aplica)
// =============================================================================
// Aparte para que la cobertura (lib/plan-acceso.ts) lea la PAUSA sin importar la pasarela (y sin un círculo de imports).
// =============================================================================

export const CLAVE_RETENCION = 'plan.retencion';

export type OpcionRetencion = 'descuento' | 'pausa' | 'bajar';

export type Guardada = {
  estado: 'aplicando' | 'aplicada' | 'error';
  opcion: OpcionRetencion;
  cobroId: number; pasarela: 'stripe' | 'mercadopago';
  aplicadaAt: string; montoOriginal: number; moneda: string;
  pct?: number; meses?: number;
  /** La pausa: hasta cuándo (ISO). */
  hasta?: string;
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

