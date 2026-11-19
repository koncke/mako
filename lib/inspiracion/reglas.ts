// =============================================================================
// INSPIRACIÓN: ¿la pieza va sola a su carpeta o a la bandeja? (19/11/2026, docs/inspiracion/diseno.md §4)
// =============================================================================
// Martín, 19/11: «Cuando no sabes dónde ponerlo, tenés que preguntar, no determinarlo automáticamente… si sospechas que debería
// ir en tal carpeta pero no estás 100 % seguro, lo preguntas… La idea es que le acierte».
//
// Por eso la vara es alta Y se gana: va sola sólo con confianza ≥ 90 y en una carpeta donde la persona ya confirmó 3 piezas
// (con eso la IA sabe qué quiere decir esa carpeta para ESE negocio). Al principio pregunta todo; con cada «Sí», menos.
// Puro: lo usa el servidor y lo prueba tests/inspiracion-reglas.test.ts.
// =============================================================================

/** La confianza mínima (0-100) para ordenar sin preguntar. */
export const CONFIANZA_PARA_ORDENAR = 90;
/** Cuántas piezas confirmadas por la persona necesita una carpeta para que MaKo ordene sola en ella. */
export const CONFIRMADAS_PARA_ORDENAR = 3;

export interface VeredictoIA {
  /** La carpeta que sospecha, o null si no hay ninguna que le cierre. */
  carpetaId: number | null;
  /** 0-100. */
  confianza: number;
  /** Si no hay carpeta que le cierre: el nombre de una nueva que propondría. */
  carpetaNueva?: string | null;
}

export type Destino =
  | { estado: 'ordenada'; carpetaId: number }
  | { estado: 'por_revisar'; sugeridaId: number | null; carpetaNueva: string | null };

/**
 * A dónde va la pieza. `confirmadas` = cuántas piezas confirmó la persona en cada carpeta (por id). Sin veredicto (falló la
 * lectura, no había saldo) o con una carpeta que no existe: a la bandeja sin sugerencia. Nunca se pierde un link.
 */
export function destinoDe(v: VeredictoIA | null | undefined, carpetas: ReadonlyArray<{ id: number }>, confirmadas: ReadonlyMap<number, number>): Destino {
  if (!v) return { estado: 'por_revisar', sugeridaId: null, carpetaNueva: null };
  const existe = v.carpetaId != null && carpetas.some((c) => c.id === v.carpetaId);
  const sugeridaId = existe ? (v.carpetaId as number) : null;
  const confianza = Number.isFinite(v.confianza) ? v.confianza : 0;
  if (sugeridaId != null && confianza >= CONFIANZA_PARA_ORDENAR && (confirmadas.get(sugeridaId) ?? 0) >= CONFIRMADAS_PARA_ORDENAR) {
    return { estado: 'ordenada', carpetaId: sugeridaId };
  }
  const nueva = sugeridaId == null ? (String(v.carpetaNueva ?? '').trim().slice(0, 60) || null) : null;
  return { estado: 'por_revisar', sugeridaId, carpetaNueva: nueva };
}

/** La pregunta de la tarjeta de la bandeja. */
export function preguntaDe(d: { sugerida?: string | null; carpetaNueva?: string | null; tipoLink?: string | null }): string {
  const que = d.tipoLink === 'cuenta' ? 'Esta cuenta' : d.tipoLink === 'reel' ? 'Este reel' : 'Esta pieza';
  if (d.sugerida) return `¿Va en «${d.sugerida}»?`;
  if (d.carpetaNueva) return `¿Creo la carpeta «${d.carpetaNueva}» para ${que.toLowerCase()}?`;
  return `${que}, ¿dónde va?`;
}
