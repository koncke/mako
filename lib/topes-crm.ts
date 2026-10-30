// =============================================================================
// Los topes del plan en el CRM: leads y CRMs (23/10/2026)
// =============================================================================
// La tabla es lib/topes-plan.ts (MaKo Esencial: 1 CRM y 2.000 leads; Pro, sin tope). Acá se hace cumplir en el CRM, con
// tres reglas del pedido del Cerebro:
//   · SÓLO a los negocios que MaKo cobra por la pasarela (`suscripcionDeMakoDe(ws) != null`): nunca al ws1 ni a un
//     acuerdo a mano, que también tienen la capa `completo`;
//   · al llegar al tope, un cartel corto (`textoTope`) y «Pasar a Pro», sin borrar ni esconder nada;
//   · un lead que entra SOLO (un anuncio, un webhook, una reserva) nunca se pierde por el tope: entra, y el tablero avisa.
//     Por eso el freno (`frenarAltaPorTope`) se llama SÓLO desde las altas a mano (la pantalla y MaKo), no desde createLead.
// Si algo no se puede leer, no hay tope: un error nuestro no le corta el trabajo a un cliente.
// =============================================================================

import 'server-only';
import { aplicanTopes } from './topes-plan-server';
import { getTenantDb, getWorkspace } from './workspace';
import { listarFunnels } from './funnels';
import { textoTope, topeDe } from './topes-plan';
import { pasaElTope, type EstadoTope, type TopeCrm } from './topes-crm-reglas';

export { enElTope, pasaElTope, type EstadoTope, type TopeCrm } from './topes-crm-reglas';

/** El alta a mano que pasaría el tope del plan. El mensaje es el cartel; `pasarAPro` le dice a la pantalla que lo ofrezca. */
export class TopeDelPlanError extends Error {
  readonly pasarAPro = true;
  constructor(readonly tope: number) {
    super(textoTope(tope));
    this.name = 'TopeDelPlanError';
  }
}

/** Cuántos tiene hoy: los leads del negocio (contados sin traerlos) o sus CRMs activos. */
async function usados(cual: TopeCrm): Promise<number> {
  if (cual === 'crm.funnels') return (await listarFunnels()).length;
  const { count, error } = await (await getTenantDb()).from('leads').select('id', { count: 'exact', head: true });
  if (error) throw new Error(`No pude contar los leads: ${error.message}`);
  return count ?? 0;
}

/**
 * El tope de ese negocio y cuánto usa, o null si no se le aplica: sin plan cobrado por la pasarela, con un plan sin ese
 * tope (Pro), o si algo no se pudo leer.
 */
export async function estadoTopeCrm(ws: number, cual: TopeCrm): Promise<EstadoTope> {
  try {
    if (!(await aplicanTopes(ws))) return null;
    const capa = (await getWorkspace(ws))?.capa ?? 'completo';
    const tope = topeDe(capa, cual);
    if (tope == null) return null;
    return { capa, tope, usadas: await usados(cual) };
  } catch (e) {
    console.error(`[topes-crm] ${cual} del ws ${ws}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Frena un alta A MANO que pasaría el tope (`nuevos`: cuántos se crean). Lo que entra solo nunca pasa por acá. */
export async function frenarAltaPorTope(ws: number, cual: TopeCrm, nuevos = 1): Promise<void> {
  const e = await estadoTopeCrm(ws, cual);
  if (e && pasaElTope(e, cual, nuevos)) throw new TopeDelPlanError(e.tope);
}
