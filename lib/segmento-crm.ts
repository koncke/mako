// =============================================================================
// segmento-crm — /email a cualquier CRM o etapa (puro, 14/11/2026)
// =============================================================================
// La llamada con Julio Mazariegos (docs/relevo/llamada-julio-13-11.md): /email sólo ofrecía los segmentos fijos, las etiquetas y
// el CRM del newsletter. Éste es el de cualquier CRM: `crm:<funnelId>` (todos) o `crm:<funnelId>:<etapa>` (los de esa etapa).
// La FORMA se lee acá (con test); que el CRM y la etapa existan lo mira `validarSegmento` (lib/email-marketing.ts).
// =============================================================================

export const PREFIJO_SEGMENTO_CRM = 'crm:';
export type SegmentoCrm = { funnelId: number; etapa: string | null };

/** `crm:12` o `crm:12:lead` → el CRM y la etapa; cualquier otra cosa, null. */
export function segmentoCrm(s: unknown): SegmentoCrm | null {
  if (typeof s !== 'string' || !s.startsWith(PREFIJO_SEGMENTO_CRM)) return null;
  const m = /^crm:(\d{1,12})(?::([a-z0-9_-]{1,60}))?$/.exec(s);
  if (!m) return null;
  const funnelId = Number(m[1]);
  if (!Number.isSafeInteger(funnelId) || funnelId <= 0) return null;
  return { funnelId, etapa: m[2] ?? null };
}

export const segmentoDeCrm = (funnelId: number, etapa?: string | null): string => `${PREFIJO_SEGMENTO_CRM}${funnelId}${etapa ? `:${etapa}` : ''}`;
