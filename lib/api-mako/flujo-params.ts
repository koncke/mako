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
/**
 * «Otro lead», todavía sin el id. Es un valor y no la ausencia del campo a propósito: ausente,
 * un `leadId` obligatorio se lee como «el del evento», y elegir «Otro» con el id vacío corría
 * la acción sobre el lead del evento (medido en la revisión del 08/10).
 */
export const LEAD_A_ELEGIR = 'a_elegir';

export type DatosDelEvento = { leadId?: number | null };

/** ¿La operación recibe un lead? Es lo que hace que un paso se pueda alimentar del evento. */
export function pideLead(parametros: readonly Parametro[]): boolean {
  return parametros.some((p) => p.nombre === 'leadId');
}

/** ¿El `leadId` de esta operación es obligatorio? Decide qué significa un paso que no lo fijó. */
export function leadObligatorio(parametros: readonly Parametro[]): boolean {
  return parametros.some((p) => p.nombre === 'leadId' && p.obligatorio === true);
}

/**
 * Los parámetros que viajan a la acción: los del paso (sin vacíos) y el lead del evento cuando
 * corresponde.
 *
 * ⚠️ EL LEAD DEL EVENTO SE PONE SÓLO SI LA OPERACIÓN LO EXIGE, O SI EL PASO LO PIDIÓ CON
 * `LEAD_DEL_EVENTO`. Un `leadId` OPCIONAL que el paso dejó vacío quiere decir «ninguno»: medido
 * en la revisión del 08/10, un «Proponer un WhatsApp» a un teléfono fijo (avisarle a un socio)
 * recibía además el lead del evento, y la operación contestaba «el teléfono no coincide» en cada
 * corrida, con alarma al dueño.
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
  const crudo = out.leadId;
  const pideElDelEvento = crudo === LEAD_DEL_EVENTO || (crudo === undefined && leadObligatorio(parametros));
  if (pideLead(parametros) && pideElDelEvento) {
    if (evento.leadId != null) out.leadId = evento.leadId;
    else delete out.leadId;
  } else if (pideLead(parametros) && crudo !== undefined) {
    // «Otro lead» sin un id que sea un número NO es el del evento: no viaja, y si es
    // obligatorio, `faltanEnPaso` lo dice.
    const id = typeof crudo === 'number' ? crudo : typeof crudo === 'string' && /^\d+$/.test(crudo) ? Number(crudo) : NaN;
    if (Number.isFinite(id) && id > 0) out.leadId = id; else delete out.leadId;
  }
  return out;
}

/**
 * Los parámetros OBLIGATORIOS que le faltan a un paso, con el lead del evento ya puesto. Un paso
 * a medio configurar ya está vivo (elegir la acción se guarda en el acto): con esto el motor de
 * avisos no lo corre y el saneo de las secuencias no lo guarda, en vez de fallar en cada evento.
 */
export function faltanEnPaso(
  parametros: readonly Parametro[],
  params: Record<string, unknown> | null | undefined,
  evento: DatosDelEvento,
): string[] {
  const input = paramsDelPaso(parametros, params, evento);
  return parametros
    .filter((p) => p.obligatorio === true)
    .filter((p) => {
      const v = input[p.nombre];
      return v === undefined || v === null || (Array.isArray(v) && !v.length);
    })
    .map((p) => p.nombre);
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
