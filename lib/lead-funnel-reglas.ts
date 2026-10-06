// =============================================================================
// lead-funnel-reglas — en qué productos está un lead, y qué se puede hacer (puro)
// =============================================================================
// «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026). El modelo vive
// en la mig 0207: la CASA es leads.funnel_id (NULL = el producto del negocio) y cada OTRO
// producto es una fila de `lead_funnel` con su propia etapa. Acá están las reglas, sin base,
// para que un test las EJECUTE (tests/lead-funnel.test.ts). La escritura vive en
// lib/lead-funnel.ts.
//
// Sin 'use client' ni 'server-only': lo leen el server, el tablero y la ficha.

/** Un producto donde está el lead. `funnelId` es SIEMPRE un id real (la casa NULL ya resuelta al del negocio). */
export type ProductoDelLead = {
  funnelId: number;
  /** ¿Es su casa (leads.funnel_id)? La casa no tiene fila: su etapa es la del lead. */
  esCasa: boolean;
  /** La etapa EN ESE producto. Para la casa, `null`: la decide el lead (pipeline_stage o derivada). */
  etapa: string | null;
  /** Para ordenar y para elegir a quién se promueve si se quita la casa. */
  desde: string | null;
};

export type FilaLeadFunnel = { funnel_id: number | string; etapa: string; etapa_desde?: string | null; created_at?: string | null; id?: number | string };

/**
 * ⚠️ EL ID DEL PRODUCTO DEL NEGOCIO SE ESCRIBE COMO NULL EN `leads.funnel_id`. El tablero del
 * negocio pide sus leads con `.is('funnel_id', null)`, así que un lead con el id del default
 * escrito no aparecía en NINGÚN tablero (lo hacía el desplegable de la ficha al «devolver» un
 * lead, y el rescate de eliminarFunnelDefinitivo). Toda escritura de la casa pasa por acá.
 */
export function casaParaEscribir(funnelId: number | null, defaultId: number | null): number | null {
  if (funnelId == null) return null;
  return defaultId != null && funnelId === defaultId ? null : funnelId;
}

/** La casa como id real: NULL es el producto del negocio. */
export function casaReal(funnelIdDelLead: number | null | undefined, defaultId: number | null): number | null {
  return funnelIdDelLead == null ? defaultId : Number(funnelIdDelLead);
}

/**
 * Los productos de UN lead: la casa primero, después las filas por antigüedad. Una fila que
 * nombra a la casa se ignora (no debería existir: la regla es «nunca hay fila para la casa»).
 */
export function productosDe(
  funnelIdDelLead: number | null | undefined,
  filas: readonly FilaLeadFunnel[],
  defaultId: number | null,
): ProductoDelLead[] {
  const casa = casaReal(funnelIdDelLead, defaultId);
  const out: ProductoDelLead[] = [];
  if (casa != null) out.push({ funnelId: casa, esCasa: true, etapa: null, desde: null });
  const vistas = new Set(out.map((p) => p.funnelId));
  const ordenadas = [...filas].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || Number(a.id ?? 0) - Number(b.id ?? 0));
  for (const f of ordenadas) {
    const id = Number(f.funnel_id);
    if (!Number.isFinite(id) || vistas.has(id)) continue;
    vistas.add(id);
    out.push({ funnelId: id, esCasa: false, etapa: f.etapa, desde: f.etapa_desde ?? f.created_at ?? null });
  }
  return out;
}

/** La X aparece sólo con DOS productos o más: sacarlo del único lo dejaría sin tablero. */
export const puedeQuitar = (productos: readonly ProductoDelLead[]): boolean => productos.length >= 2;

/**
 * Si se quita la CASA, otra fila pasa a ser la casa: la más vieja. La casa no se puede dejar
 * vacía con una marca de «fuera» (como hace Customer Success): leads.funnel_id es lo que leen la
 * nutrición, las confirmaciones de MaKo, Customer Success y el dedup, y todos lo seguirían
 * tratando como de ese producto.
 */
export function aQuienPromover(productos: readonly ProductoDelLead[]): ProductoDelLead | null {
  return productos.find((p) => !p.esCasa) ?? null;
}

/** La etapa por la que se entra a un producto: la declarada como entrada, o la primera. */
export function etapaDeEntrada(stages: readonly { key: string; kind?: string | null }[]): string | null {
  return (stages.find((s) => s.kind === 'entrada') ?? stages[0])?.key ?? null;
}
