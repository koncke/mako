// =============================================================================
// seleccion-difusion — a quién le manda el mensaje la DIFUSIÓN que se abre desde el tablero (28/10/2026, puro)
// =============================================================================
// Martín (28/10/2026, el pedido de Leila): elegir una columna entera o leads sueltos en el CRM y «mandar mensaje de
// difusión». La hoja es de Automations (app/automations/difusion/HojaDifusion.tsx); la barra en bloque
// (app/crm/AccionesLoteLeads.tsx) sólo pone la selección. Con una columna ENTERA va la columna y no los ids: la resuelve el
// server, sin el tope de lo que el tablero tenga cargado.
//
// Sin 'use client' ni 'server-only': lo ejecuta tests/crm-acciones-bloque.test.ts.

export type SeleccionDifusion = { leadIds: number[] } | { funnelId: number | null; etapa: string };

/**
 * La columna entera si lo tildado ES una columna (sin filtros), o los ids.
 * ⚠️ SIN EL FUNNEL, LOS IDS (29/10/2026): el server resuelve `{ funnelId: null, etapa }` como esa etapa en TODOS los funnels
 * (`ambitoDeFunnel(null)` → «todos», lib/nutricion.ts). Una difusión a «Contacto nuevo» del principal le llegaría a los de
 * los otros funnels. El principal va con SU id (`es_default` → el negocio: los NULL y los suyos); sin id, lo que se ve.
 */
export function seleccionDeDifusion(ids: readonly number[], columna: { etapa: string; funnelId: number | null } | null | undefined): SeleccionDifusion {
  return columna && columna.funnelId != null ? { funnelId: columna.funnelId, etapa: columna.etapa } : { leadIds: [...ids] };
}

/**
 * EL «⋯» DE UNA COLUMNA (29/10/2026, Martín: «lo que quería Leila de enviar un mensaje de difusión en los 3 puntitos de la
 * columna»): la columna ENTERA sin tildar nada, que resuelve el server sin el tope de lo cargado. Con un filtro puesto, la
 * columna no es lo que se ve: van «los N que se ven», igual que la casilla de la columna en la barra.
 */
export function seleccionDeColumna(
  columna: { etapa: string; funnelId: number | null },
  visibles: readonly number[],
  hayFiltros: boolean,
): SeleccionDifusion {
  return seleccionDeDifusion(visibles, hayFiltros ? null : columna);
}

/** Lo que dice el renglón del «⋯» (el mismo menú que el clic derecho de la cabecera). */
export function textoDifusionDeColumna(visibles: number, hayFiltros: boolean): string {
  if (!hayFiltros) return 'Mandar mensaje de difusión';
  return visibles === 1 ? 'Mandar mensaje al que se ve' : `Mandar mensaje a los ${visibles} que se ven`;
}
