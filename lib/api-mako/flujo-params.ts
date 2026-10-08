// =============================================================================
// api-mako/flujo-params — lo que un PASO de un flujo le pasa a una acción de MaKo
// =============================================================================
// Un flujo (el lienzo de /chatbot o el de /mensajes) puede tener un paso «⚡ Acción» que
// corre cualquier ACCIÓN del registro (decisión de Martín, 08/10/2026: «que pueda hacer
// todo, sin limitaciones»). Esto decide, puro y con test (tests/flujo-acciones.test.ts):
//   · qué parámetros llegan: los que fijó el paso, y el lead del EVENTO cuando la
//     operación pide `leadId` y el paso no puso uno — es el caso normal: «cuando entra
//     un lead, movelo a Contactado» no sabe de antemano qué lead;
//   · qué filas salen de una propuesta de leads (una persona o un lote).
// SIN `server-only`: lo importan los tests y el editor del lienzo.
// =============================================================================

import type { Parametro } from './tipos';

/** El valor que pone el editor para decir «el lead del evento», explícito. */
export const LEAD_DEL_EVENTO = 'evento';

export type DatosDelEvento = { leadId?: number | null };

/** ¿La operación recibe un lead? Es lo que hace que un paso se pueda alimentar del evento. */
export function pideLead(parametros: readonly Parametro[]): boolean {
  return parametros.some((p) => p.nombre === 'leadId');
}

/**
 * Los parámetros que viajan a la acción: los del paso (sin vacíos) y, si la operación pide
 * `leadId` y el paso no fijó uno (o pidió el del evento), el lead del evento.
 */
export function paramsDelPaso(
  parametros: readonly Parametro[],
  params: Record<string, unknown> | null | undefined,
  evento: DatosDelEvento,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) continue;
    out[k] = v;
  }
  if (pideLead(parametros) && (out.leadId === undefined || out.leadId === LEAD_DEL_EVENTO)) {
    if (evento.leadId != null) out.leadId = evento.leadId;
    else delete out.leadId;
  }
  return out;
}

export type FilaLead = { nombre: string; email: string | null; telefono: string | null; empresa: string | null };

const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Las personas de una propuesta de leads: una sola (`proponer_lead`) o un lote (`proponer_leads`). */
export function filasDeLeads(datos: Record<string, unknown> | null | undefined): FilaLead[] {
  const crudas = Array.isArray(datos?.leads) ? (datos!.leads as Array<Record<string, unknown>>) : datos ? [datos] : [];
  const filas: FilaLead[] = [];
  for (const c of crudas) {
    const nombre = txt(c?.nombre);
    if (!nombre) continue;
    filas.push({ nombre, email: txt(c.email)?.toLowerCase() ?? null, telefono: txt(c.telefono), empresa: txt(c.empresa) });
  }
  return filas;
}
