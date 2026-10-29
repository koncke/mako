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

/** La columna entera si lo tildado ES una columna (sin filtros), o los ids. */
export function seleccionDeDifusion(ids: readonly number[], columna: { etapa: string; funnelId: number | null } | null | undefined): SeleccionDifusion {
  return columna ? { funnelId: columna.funnelId, etapa: columna.etapa } : { leadIds: [...ids] };
}
