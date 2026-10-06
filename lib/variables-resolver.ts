// =============================================================================
// Los valores de las variables, en el momento de mandar
// =============================================================================
// El catálogo (qué se ofrece) vive en `lib/variables-aviso.ts`, SIN `server-only`,
// para que lo importe la pantalla. Acá viven los VALORES, que necesitan el workspace
// y la zona horaria — o sea el server.
//
// ⚠️ LA SUSTITUCIÓN VA EN EL CALL SITE, NO ADENTRO DEL GENERADOR DE TEXTO. Hay tres
// retornos que se saltean el modelo (`out.trim() || ref`, el `catch → ref`, y el
// fallback de los pasos de un flujo): con la sustitución adentro, la variable falla
// exactamente cuando falla la IA, que es cuando menos se la mira.
//
// ⚠️ Y LA LECTURA DE LA FICHA DEL LEAD CUELGA DE QUE EL TEXTO LA NOMBRE. Es la regla de
// admisión del catálogo —una lectura por ENTIDAD que el texto nombra, y sólo si la
// nombra— y acá es donde se cumple: `necesitaFichaDelLead` mira los tokens que el
// mensaje trae de verdad, así que el 99% de los avisos (los que no nombran ningún dato
// del CRM) no tocan `leads`. Un `getLead` incondicional sería una lectura por aviso.

import 'server-only';

import { linkApp, APP_BASE_URL } from './app-url';
import { RUTA_DE_LINK, resolverVariables, necesitaFichaDelLead } from './variables-aviso';
import { tzDeWorkspace } from './timezone';
import { wsEnContexto, getWorkspace } from './workspace';
import { partesEn } from './cron-aviso';
import { valoresDelLead } from './variables-del-lead';

export type CtxVariables = { ws: number; leadId?: number | null; leadNombre?: string | null };

/**
 * Los valores que este aviso puede resolver AHORA.
 *
 * Lo que no se puede resolver NO entra al mapa, y `resolverVariables` deja su token
 * intacto: un `{{lead_nombre}}` en un aviso que no habla de ningún lead sale crudo.
 * Es a propósito — se ve raro y se nota, mientras que borrarlo dejaría el mensaje
 * cojo sin que nadie se entere. Lo que evita que llegue ahí es que el selector no lo
 * OFRECE (`variablesPara`), y eso se decide en la pantalla.
 *
 * `texto` es opcional y es lo que decide si se lee la ficha del lead. Sin él no se lee:
 * quien no pasa el texto no puede estar pidiendo un dato del CRM.
 */
export async function valoresDeVariables(ctx: CtxVariables, texto?: string, datos?: Record<string, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, ruta] of Object.entries(RUTA_DE_LINK)) out[k] = `${APP_BASE_URL}${ruta}`;
  if (ctx.leadId) out.link_lead = linkApp(`/crm/${ctx.leadId}/resumen`, wsEnContexto());
  if (ctx.leadNombre) out.lead_nombre = ctx.leadNombre;
  try {
    const tz = await tzDeWorkspace(ctx.ws);
    const p = partesEn(tz, new Date());
    out.fecha = `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}`;
    out.hora = `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
  } catch { /* sin zona no se inventa una hora: los dos tokens quedan crudos */ }
  try {
    const w = await getWorkspace(ctx.ws);
    if (w?.nombre) out.negocio = w.nombre;
  } catch { /* idem */ }
  // La ficha, una sola vez y sólo si el texto la nombra. Lo que viene del evento
  // (`leadNombre`) NO se pisa con lo de la base: el evento es más nuevo.
  if (ctx.leadId && texto && necesitaFichaDelLead(texto)) {
    try {
      const { getLead } = await import('./leads');
      const l = await getLead(ctx.leadId);
      if (l) Object.assign(out, valoresDelLead(l), ctx.leadNombre ? { lead_nombre: ctx.leadNombre } : {});
    } catch (e) {
      // Que no se pueda leer la ficha no puede tumbar el aviso: los tokens del CRM
      // salen crudos y el resto del mensaje sale igual. Es la misma regla que la zona.
      console.error('[variables] no pude leer la ficha del lead:', e instanceof Error ? e.message : String(e));
    }
  }
  // ⚠️ LO QUE PASA EL EMISOR GANA, y va último a propósito. Son los valores que ese
  // disparador ya tenía en la mano —el número y el monto de la cuota que el cron de
  // cobranza acaba de leer— y nadie los puede resolver mejor: ir a buscarlos otra vez
  // sería una lectura por un dato que estaba acá, y dejar que un default los pise sería
  // mandar el monto de otra cuota.
  if (datos) for (const [k, v] of Object.entries(datos)) if (v) out[k] = v;
  return out;
}

/** El texto con los datos puestos. Azúcar sobre las dos de arriba. */
export async function conVariables(texto: string, ctx: CtxVariables, datos?: Record<string, string>): Promise<string> {
  if (!texto.includes('{{')) return texto;   // el 99% de los avisos, sin una sola lectura
  return resolverVariables(texto, await valoresDeVariables(ctx, texto, datos));
}
