// =============================================================================
// El tope de usuarios del plan al invitar a alguien al equipo (23/10/2026)
// =============================================================================
// Los planes de MaKo (docs/ofertas-mako.md): Esencial, 1 usuario; Pro, 5 (lib/topes-plan.ts → 'equipo.usuarios'). Lo hace
// cumplir el alta del equipo (/api/equipo → `invitar`), con un cartel corto y «Pasar a Pro». Las reglas del Cerebro:
//   · SÓLO a quien MaKo le cobra el plan por la pasarela (`suscripcionDeMakoDe(ws) != null`): nunca al ws1 ni a un acuerdo a
//     mano, que también tienen capa `completo`;
//   · nadie del equipo pierde el acceso por el tope: frena SÓLO lo nuevo (invitar), nunca a los que ya están.
// Puro: la ruta le pasa si MaKo le cobra, la capa y cuántos son.
// =============================================================================

import { RUTA_CAMBIAR_PLAN, cabeOtra, textoTope, topeDe } from './topes-plan';

/** Donde se ve el plan y se pasa a Pro: la de Planes, nunca una propia. */
export const HREF_PASAR_A_PRO = RUTA_CAMBIAR_PLAN;

export type TopeAlInvitar = { ok: true } | { ok: false; tope: number; error: string; pasarAPro: string };

/** ¿Se puede sumar a uno más? `miembros`: los que ya son del equipo (con el dueño). */
export function topeAlInvitar(p: { cobraMako: boolean; capa: string | null | undefined; miembros: number }): TopeAlInvitar {
  if (!p.cobraMako || !p.capa) return { ok: true };
  if (cabeOtra(p.capa, 'equipo.usuarios', p.miembros)) return { ok: true };
  const tope = topeDe(p.capa, 'equipo.usuarios');
  if (tope == null) return { ok: true };
  return { ok: false, tope, error: textoTope(tope), pasarAPro: HREF_PASAR_A_PRO };
}
