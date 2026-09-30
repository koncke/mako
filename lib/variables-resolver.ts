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

import 'server-only';

import { APP_BASE_URL } from './app-url';
import { RUTA_DE_LINK, resolverVariables } from './variables-aviso';
import { tzDeWorkspace } from './timezone';
import { getWorkspace } from './workspace';
import { partesEn } from './cron-aviso';

export type CtxVariables = { ws: number; leadId?: number | null; leadNombre?: string | null };

/**
 * Los valores que este aviso puede resolver AHORA.
 *
 * Lo que no se puede resolver NO entra al mapa, y `resolverVariables` deja su token
 * intacto: un `{{lead_nombre}}` en un aviso que no habla de ningún lead sale crudo.
 * Es a propósito — se ve raro y se nota, mientras que borrarlo dejaría el mensaje
 * cojo sin que nadie se entere. Lo que evita que llegue ahí es que el selector no lo
 * OFRECE (`variablesPara`), y eso se decide en la pantalla.
 */
export async function valoresDeVariables(ctx: CtxVariables): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, ruta] of Object.entries(RUTA_DE_LINK)) out[k] = `${APP_BASE_URL}${ruta}`;
  if (ctx.leadId) out.link_lead = `${APP_BASE_URL}/crm/${ctx.leadId}/resumen`;
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
  return out;
}

/** El texto con los datos puestos. Azúcar sobre las dos de arriba. */
export async function conVariables(texto: string, ctx: CtxVariables): Promise<string> {
  if (!texto.includes('{{')) return texto;   // el 99% de los avisos, sin una sola lectura
  return resolverVariables(texto, await valoresDeVariables(ctx));
}
