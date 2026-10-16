// =============================================================================
// arranque-ui — lo que la pantalla del chat de arranque necesita, puro (sin React, con test)
// =============================================================================
// Las reglas del arranque (etapa, mensajes, respuestas) viven en lib/onboarding-arranque.ts. Acá sólo lo
// que traduce esa conversación al motor de Offer (app/offer/OfferApp.tsx, modo `arranque`).
// =============================================================================

import type { OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';
import type { EtapaArranque, MensajeArranque, TarjetaArranque } from '@/lib/onboarding-arranque';

/** Una conversación vacía: para dibujar los mensajes del arranque antes de que exista la de la oferta. */
export const SESION_VACIA: OfferSesionVista = {
  id: 0, titulo: '', estado: 'conversando', mensajes: [], piezas: {}, docs: [], conclusion: null, versiones: 0,
  ofertaId: null, puedeConcluir: false, updatedAt: '', funnelId: null, funnelNombre: '', ofertaBaseId: null,
  ofertaBaseNombre: '', modo: 'crear', ofertaGuardadaId: null, ligada: true, armando: null,
};

/** Un mensaje del arranque como mensaje del chat de Offer (sin hora: no la tiene). */
export function aMensajeOffer(m: MensajeArranque): OfferMensaje {
  return { id: m.id, de: m.de, texto: m.texto, at: '', ...(m.opciones?.length ? { opciones: m.opciones } : {}) };
}

/** Las tarjetas por id de mensaje (las dibuja la pantalla adentro de la burbuja). */
export function tarjetasDe(lista: MensajeArranque[]): Map<string, TarjetaArranque> {
  const m = new Map<string, TarjetaArranque>();
  for (const x of lista) if (x.tarjeta) m.set(x.id, x.tarjeta);
  return m;
}

/**
 * ¿El composer y las opciones van al ARRANQUE? Sí en todas las etapas menos la de la oferta (contesta Offer)
 * y mientras se termina de armar. Al final también va al arranque, y a propósito: un turno de Offer
 * después de «¡Listo!» quedaría ARRIBA de la tarjeta final (los mensajes del arranque van después de los de
 * la oferta), así que ahí el chat dice que la oferta sigue en Offer.
 */
export function mandaElArranque(etapa: EtapaArranque): boolean {
  return etapa !== 'oferta' && etapa !== 'armando';
}

/** Las etapas en que ya no hay nada que contestar (la oferta sigue en su tab). */
export const terminoElArranque = (etapa: EtapaArranque): boolean => etapa === 'cierre' || etapa === 'listo';

/** El placeholder del composer en cada pregunta. Corto: es texto que se dibuja. */
export function placeholderDe(etapa: EtapaArranque): string | undefined {
  switch (etapa) {
    case 'nombre': return 'Tu nombre';
    case 'negocio': return 'El nombre de tu negocio';
    case 'objetivo': return 'Tu objetivo';
    case 'que_hace': return 'A qué se dedica';
    case 'codigo': return 'El código de 6 dígitos';
    case 'cierre': case 'listo': return 'Tu oferta sigue en Offer';
    default: return undefined;
  }
}

/**
 * Dónde va la respuesta optimista (el globito del dueño mientras se guarda): con la pregunta de la etapa,
 * antes o después de la conversación de la oferta.
 */
export function ladoDeLaPregunta(etapa: EtapaArranque, modo: 'oferta' | 'plan' = 'plan'): 'antes' | 'despues' {
  // El diagnóstico va antes en modo 'plan' (no hay oferta) y después en 'oferta' (lo que faltó tras armarla).
  if (etapa === 'fase') return modo === 'oferta' ? 'despues' : 'antes';
  return etapa === 'nombre' || etapa === 'negocio' || etapa === 'objetivo' || etapa === 'que_hace' ? 'antes' : 'despues';
}
