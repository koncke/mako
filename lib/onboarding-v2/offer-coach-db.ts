import 'server-only';

// =============================================================================
// LA CONVERSACIÓN DE OFFER DEL OFFER COACH (onboarding V2, 19/11/2026)
// =============================================================================
// Martín (16/11, y el Cerebro el 18/11): «Offer Coach en la app = el MOTOR de Offer (el de la pestaña Offer): subir el documento, las
// piezas, la nota y el PDF en UN mensaje». Con el V2, el Offer Coach ya no es un chat del modelo que escribe el diagnóstico a mano:
// es UNA conversación de Offer (offer_sesiones) por negocio, atada al funnel principal, que el Ops Center sigue con el motor de Offer
// (app/second-brain/motor-offer.ts, el mismo de cualquier conversación de Offer en el Ops Center). Acá se guarda CUÁL es; la crea
// app/api/offer/route.ts ('coach').
// Es del NEGOCIO, como la oferta y el plan del funnel (lib/funnel-plan-db.ts): una fila de app_settings por workspace.
// =============================================================================

import { getSetting, setSetting } from '../settings';

export const CLAVE_OFFER_COACH = 'onboarding_v2.offer_coach';

/** El id de la conversación de Offer del Offer Coach, o null si todavía no tiene (o no se pudo leer). */
export async function sesionDelOfferCoach(): Promise<number | null> {
  const s = await getSetting(CLAVE_OFFER_COACH).catch(() => null);
  if (!s) return null;
  try {
    const id = (JSON.parse(s) as { id?: unknown } | null)?.id;
    return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function guardarSesionDelOfferCoach(id: number): Promise<void> {
  await setSetting(CLAVE_OFFER_COACH, JSON.stringify({ id }));
}
