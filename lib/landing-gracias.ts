import 'server-only';

// =============================================================================
// landing-gracias — quien llega a la página de GRACIAS pasa a Ganado
// =============================================================================
// Pedido de Martín (07/10/2026, por la sesión de Customer Success): «automatice mediante el
// pixel de MaKo que si alguien cae en una TKY Page, se pueda automatizar pasar al lead a Ganado
// directamente... y a su vez si se tiene activado la invitación del curso automático, que sea
// todo automático». Las reglas, sin base, en lib/landing-gracias-reglas.ts (con test).
//
// Cómo encadena: el beacon del Pixel registra la visita (app/api/track/vsl/route.ts) y llama a
// `alVisitarPagina`; si la página está marcada como de gracias (`gracias` en `landing.config`,
// lib/landing-config.ts), se busca el lead por su `visitor_id` y se lo pasa a Ganado por los
// MISMOS caminos que el tablero: `setPipelineStage` en su casa y `moverEtapaEnProducto` en un
// producto agregado. Los dos llaman al enganche «al ganar», así que si el embudo invita al curso
// (lib/crm-curso-al-ganar.ts), el mail sale solo. No hay un segundo camino a Ganado.
//
// ⚠️ LA VISITA NO PRUEBA LA COMPRA. Quien tenga la URL de la página de gracias la puede abrir sin
// pagar, y con la invitación prendida eso le da el curso. Es la regla que se pidió («cae en esa
// TKY Page → Ganado») y nace APAGADA; lo que la hace segura es que la URL no se publique (la
// plataforma de pago redirige ahí después de cobrar). Está escrito en docs/hallazgos-landing.md.
//
// ⚠️ NUNCA TIRA HACIA EL BEACON: un fallo acá no puede costar la visita, que ya se guardó.
// =============================================================================

import { after } from 'next/server';
import { getTenantDb, runWithWorkspace } from './workspace';
import { getSetting, setSetting } from './settings';
import { CONFIG_KEY, parsearConfig } from './landing-config';
import { funnelsDeLanding } from './landing-funnel';
import { agregarAProducto, moverEtapaEnProducto, productosDelLead } from './lead-funnel';
import { casaReal } from './lead-funnel-reglas';
import { getLead, logLeadEvent, setPipelineStage } from './leads';
import {
  RECHAZOS_GRACIAS_KEY, conRechazo, paginaDeGracias, parsearRechazos, pasosDeGracias, quienLlegoALaGracias,
  type PorQueNoGana, type RechazoGracias,
} from './landing-gracias-reglas';

const MAKO = 'MaKo';
const MOTIVO = 'Llegó a la página de gracias';
/**
 * La clave de Ganado. Es la MISMA en todos los embudos: es una de las cuatro terminales, que se
 * renombran y no se borran (`terminalEstadoFor`, lib/pipeline.ts). Y si un producto no la tuviera,
 * `moverEtapaEnProducto` lo dice («Esa etapa no existe en ese producto») en vez de inventarla.
 */
const GANADO = 'ganado';

/**
 * Lo llama el beacon en CADA pageview, así que la primera pregunta es barata: ¿esta página es
 * de gracias? Una lectura de un setting, y casi siempre sale ahí. El trabajo va por detrás
 * (`after`): el beacon le contesta a la página del cliente y no espera a nadie.
 */
export async function alVisitarPagina(p: { ws: number; visitorId: string; landingUrl: string | null }): Promise<void> {
  try {
    if (!p.landingUrl) return;
    // Por la RUTA, sin los parámetros que agrega la plataforma de pago (ver `paginaDeGracias`).
    const cfg = paginaDeGracias(parsearConfig(await getSetting(CONFIG_KEY)), p.landingUrl);
    if (!cfg) return;
    const url = cfg.url;
    const trabajo = async () => {
      try {
        await runWithWorkspace(p.ws, () => ganarPorGracias(p.ws, p.visitorId, url));
      } catch (e) {
        console.error(`[gracias] ${url}: no pude pasar la visita a Ganado:`, e instanceof Error ? e.message : e);
      }
    };
    try {
      after(trabajo);
      return;
    } catch { /* sin request: en línea */ }
    await trabajo();
  } catch (e) {
    console.error('[gracias] no pude leer si la página es de gracias:', e instanceof Error ? e.message : e);
  }
}

/**
 * La visita a la página de gracias, resuelta. Exportada para poder correrla a mano sobre un
 * workspace de prueba; la llama `alVisitarPagina`.
 */
export async function ganarPorGracias(ws: number, visitorId: string, url: string): Promise<{ leadId: number; movidos: number } | { motivo: PorQueNoGana }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id').eq('visitor_id', visitorId).limit(2);
  if (error) throw new Error(error.message);
  const quien = quienLlegoALaGracias((data ?? []) as Array<{ id: number }>);
  if ('motivo' in quien) {
    await anotarRechazo({ at: new Date().toISOString(), url, motivo: quien.motivo });
    return quien;
  }
  const { leadId } = quien;
  const lead = await getLead(leadId);
  if (!lead) throw new Error(`no encontré el lead ${leadId}`);

  const [destinosCrudos, delLead] = await Promise.all([funnelsDeLanding(ws, url), productosDelLead(leadId)]);
  const destinos = destinosCrudos
    .map((f) => casaReal(f, delLead.defaultId))
    .filter((f): f is number => f != null);
  const pasos = pasosDeGracias({
    destinos,
    productos: delLead.productos,
    casaGanada: lead.estado_lead === 'ganado',
    ganado: GANADO,
  });

  let movidos = 0;
  for (const paso of pasos) {
    try {
      if (paso.tipo === 'casa') {
        // Sin formulario: los requisitos de Ganado (el monto) se saltean DICIÉNDOLO, y el motivo
        // queda en el historial al lado del movimiento. ⚠️ NO es `moverLeadAuto` (que valida y no
        // mueve si falta algo): la visita a la página de gracias ES la venta, y la decisión del
        // 17/09/2026 es que mover nunca se bloquea — lo que falta queda pendiente en el CRM.
        await setPipelineStage(leadId, GANADO, { autor: MAKO, requisitos: { omitir: MOTIVO } });
      } else {
        if (paso.tipo === 'agregar') await agregarAProducto(leadId, paso.funnelId, { autor: MAKO });
        await moverEtapaEnProducto(leadId, paso.funnelId, GANADO, { autor: MAKO });
        await logLeadEvent(leadId, 'Ganado', MOTIVO, MAKO);
      }
      movidos++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[gracias] lead ${leadId}: no pude pasarlo a Ganado (${paso.tipo} ${paso.funnelId}):`, msg);
      await logLeadEvent(leadId, 'Ganado', `Llegó a la página de gracias y no lo pude pasar a Ganado: ${msg}`.slice(0, 300), MAKO);
    }
  }
  return { leadId, movidos };
}

/**
 * Una visita que no movió a nadie queda escrita: sin esto, «la página de gracias no hace nada» y
 * «llegó gente que nunca dejó sus datos» se ven igual. Sin datos de la persona: la URL, el motivo
 * y la hora.
 */
async function anotarRechazo(r: RechazoGracias): Promise<void> {
  console.warn(`[gracias] visita a ${r.url} sin mover a nadie: ${r.motivo}`);
  try {
    const lista = parsearRechazos(await getSetting(RECHAZOS_GRACIAS_KEY));
    const nueva = conRechazo(lista, r);
    if (nueva[0] !== lista[0]) await setSetting(RECHAZOS_GRACIAS_KEY, JSON.stringify(nueva));
  } catch (e) {
    console.error('[gracias] no pude anotar el rechazo:', e instanceof Error ? e.message : e);
  }
}

/** Las visitas que no movieron a nadie, para la pantalla del Pixel. `null` = no se pudo leer. */
export async function rechazosDeGracias(): Promise<RechazoGracias[] | null> {
  try {
    return parsearRechazos(await getSetting(RECHAZOS_GRACIAS_KEY));
  } catch {
    return null;
  }
}
