// =============================================================================
// fuentes-leads — la puerta de las FUENTES QUE AVISAN (Hotmart, Skool) al CRM
// =============================================================================
// El Leads Scraper (docs/diseno-leads-scraper.md, 14/10/2026) parte las fuentes en dos: las que
// AVISAN —el propio público del negocio: compró en Hotmart, pidió entrar a su Skool— entran solas
// al CRM; las que SE BUSCAN (la prospección en frío) van a una lista aparte. Esto es la primera.
//
// ⚠️ NO ES UNA SEGUNDA PUERTA DE LEADS: no escribe `leads` con un `.from()` propio. Busca a la
// persona con `findLeadByContacto` (la misma llave que Meta y Calendly: teléfono O email), y:
//   · si está, le COMPLETA lo vacío con `enriquecerLead` (lo cargado gana) y le anota el evento;
//   · si no está y el evento crea, la da de alta con `createLead` —con `permitirDuplicado`, porque
//     el chequeo por contacto ya se hizo acá, igual que los webhooks de Meta y Calendly—;
//   · si no está y el evento sólo anota (un módulo terminado en Hotmart), no inventa a nadie.
// Entra al funnel que DECLARA su entrada (decisión 9, lib/funnel-de-entrada.ts): una compra o un
// carrito de Hotmart, al de «Anuncios a carrito». Si no hay uno solo, al funnel del negocio. Un lead
// que ya estaba se AGREGA a ese funnel (mig 0207: se agrega, nunca se mueve).
//
// ⚠️ Y NO DECIDE NADA POR DETRÁS (AGENTS.md, «MaKo NADA por detrás»): no mueve de etapa, no marca
// ganado, no inscribe en automatizaciones ni manda mensajes. El evento queda en el historial, que
// es donde se ve; qué hacer con una compra lo decide el negocio en Automations.
//
// Corre adentro de `runWithWorkspace(ws)`: lo llama el webhook DESPUÉS de saber de quién es.

import 'server-only';
import { createLead, enriquecerLead, findLeadByContacto, logLeadEvent } from './leads';
import { agregarAProducto } from './lead-funnel';
import { funnelDeEntrada } from './funnel-de-entrada';
import type { EntradaId } from './pipeline';
import { getTenantDb } from './workspace';
import type { RespuestaOptin } from './optin-respuestas';
// Cuáles son y cómo se llaman: el catálogo puro, que también lee /integraciones.
import { NOMBRE_FUENTE, type FuenteQueAvisa } from './fuentes-leads-catalogo';
// El valor de `origen_lead` sale del catálogo de orígenes, el único lugar donde viven los posibles.
import { ORIGEN_LEAD } from '@/app/crm/origen-lead';

export type EntradaDeFuente = {
  fuente: FuenteQueAvisa;
  contacto: { nombre: string | null; email: string | null; telefono: string | null };
  /** La línea del historial. Es también la llave de que no se repita (ver `anotarUnaVez`). */
  linea: string;
  /** false = sólo anota en un lead que ya existe. */
  creaLead: boolean;
  /** La entrada que este evento ES (una compra de Hotmart: `carrito`). Decide el funnel. Sin ella, el del negocio. */
  entrada?: EntradaId;
  respuestas?: RespuestaOptin[];
  /** Una línea más para un lead que ya existía (las respuestas no pisan las que tenga). */
  lineaExtra?: string | null;
  utm?: { source?: string | null; content?: string | null };
};

export type ResultadoFuente =
  | { estado: 'creado'; leadId: number }
  | { estado: 'actualizado'; leadId: number; completados: string[]; anotado: boolean }
  | { estado: 'ignorado'; motivo: string };

/**
 * Anota el evento en el historial UNA vez. Hotmart reintenta un aviso que no recibió 200, y la
 * compra aprobada y la completada de la misma transacción arman el mismo texto: la línea ya
 * escrita no se repite. Si la consulta falla, se anota igual (una línea de más es mejor que
 * perder el evento).
 */
async function anotarUnaVez(leadId: number, campo: string, valor: string): Promise<boolean> {
  try {
    const { data, error } = await (await getTenantDb())
      .from('lead_audit').select('id').eq('lead_id', leadId).eq('campo', campo).eq('valor_nuevo', valor).limit(1);
    if (!error && (data ?? []).length) return false;
  } catch {
    // Sigue: ver arriba.
  }
  await logLeadEvent(leadId, campo, valor, 'MaKo');
  return true;
}

export async function ingresarDeFuente(e: EntradaDeFuente): Promise<ResultadoFuente> {
  const { nombre, email, telefono } = e.contacto;
  if (!email && !telefono) return { estado: 'ignorado', motivo: 'sin email ni teléfono' };
  const campo = NOMBRE_FUENTE[e.fuente];

  const funnelId = e.entrada ? await funnelDeEntrada(e.entrada) : null;
  const existente = await findLeadByContacto(email, telefono);
  if (existente) {
    const completados = await enriquecerLead(existente.id, { nombre, email, telefono }, campo);
    if (funnelId != null) {
      try {
        await agregarAProducto(existente.id, funnelId, { autor: 'MaKo' });
      } catch (err) {
        // El evento ya entró a su ficha: no poder sumarlo a ese funnel no lo pierde. Queda en el log.
        console.error(`[fuentes-leads] ${campo}: no se pudo agregar el lead ${existente.id} al funnel ${funnelId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const anotado = await anotarUnaVez(existente.id, campo, e.linea);
    if (e.lineaExtra) await anotarUnaVez(existente.id, campo, e.lineaExtra);
    return { estado: 'actualizado', leadId: existente.id, completados, anotado };
  }
  if (!e.creaLead) return { estado: 'ignorado', motivo: 'el evento sólo anota y la persona no está en el CRM' };

  const lead = await createLead({
    nombre: nombre?.trim() || (email ? email.split('@')[0] : `Contacto de ${campo}`),
    email, telefono,
    origen_lead: ORIGEN_LEAD[e.fuente].id,
    funnel_id: funnelId,
    utm_source: e.utm?.source ?? null,
    utm_content: e.utm?.content ?? null,
    optin_respuestas: e.respuestas?.length ? e.respuestas : null,
    // El chequeo por contacto ya se hizo arriba (`findLeadByContacto`), como en Meta y Calendly.
    permitirDuplicado: true,
  });
  await logLeadEvent(lead.id, campo, e.linea, 'MaKo');
  return { estado: 'creado', leadId: lead.id };
}
