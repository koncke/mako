// =============================================================================
// arranque-ui — lo que la pantalla del chat de arranque necesita, puro (sin React, con test)
// =============================================================================
// Las reglas del arranque (etapa, mensajes, respuestas) viven en lib/onboarding-arranque.ts. Acá sólo lo
// que traduce esa conversación al motor de Offer (app/offer/OfferApp.tsx, modo `arranque`).
// =============================================================================

import type { OfferMensaje, OfferSesionVista } from '@/lib/offer-marco';
import type { EtapaArranque, MensajeArranque, TarjetaArranque } from '@/lib/onboarding-arranque';
import { DIAL_DEFAULT, numeroTecleado } from '@/lib/paises';

/**
 * Con qué arranca la tarjeta del WhatsApp: el número que dio al pagar, partido en su país y el resto (31/10/2026). Viene de un
 * formulario público y no está probado, así que sólo se muestra: lo manda un toque. Un país que no se conoce arranca vacía:
 * `splitTelefono` le pondría el de por defecto, y el código saldría a otra persona.
 */
export function tarjetaConNumero(digitos: string | null | undefined): { lada: string; numero: string } {
  const vacia = { lada: DIAL_DEFAULT, numero: '' };
  if (!digitos || !/^\d{8,15}$/.test(digitos)) return vacia;
  const { lada, numero } = numeroTecleado(`+${digitos}`);
  return lada ? { lada, numero } : vacia;
}

/** Una conversación vacía: para dibujar los mensajes del arranque antes de que exista la de la oferta. */
export const SESION_VACIA: OfferSesionVista = {
  id: 0, titulo: '', estado: 'conversando', mensajes: [], piezas: {}, docs: [], conclusion: null, versiones: 0,
  ofertaId: null, puedeConcluir: false, updatedAt: '', funnelId: null, funnelNombre: '', ofertaBaseId: null,
  ofertaBaseNombre: '', modo: 'crear', ofertaGuardadaId: null, ligada: true, armando: null, leyendo: null, guardadaEn: [],
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
 * La pregunta que contesta lo que manda la pantalla: el texto del último mensaje de MaKo del arranque. Viaja con el toque y
 * con lo escrito, y el server lo compara con SU última pregunta (lib/onboarding-arranque.ts → leerRespuesta): todas las
 * confirmaciones tienen el mismo botón, y una pestaña vieja confirmaba una lectura que no mostró (cuarta revisión, 21/10).
 */
export function preguntaQueContesta(v: { antes: readonly MensajeArranque[]; despues: readonly MensajeArranque[] }): { pregunta?: string } {
  const ultimo = [...v.antes, ...v.despues].filter((m) => m.de === 'mako').pop();
  return ultimo ? { pregunta: ultimo.texto } : {};
}

/**
 * ¿El composer y las opciones van al ARRANQUE? Sí en todas las etapas menos la de lo que vende (contesta
 * Offer). Al final también va al arranque, y a propósito: un turno de Offer después de «¡Listo!» quedaría
 * ARRIBA de la tarjeta final (los mensajes del arranque van después de los de la oferta), así que ahí el chat
 * dice que la oferta sigue en Offer.
 */
export function mandaElArranque(etapa: EtapaArranque): boolean {
  return etapa !== 'oferta';
}

/** El PDF con lo que vende: el de la conversación, armado con sus piezas (GET /api/offer/pdf, `tipo`). */
export const linkPdfLoQueVende = (sesionId: number): string => `/api/offer/pdf?id=${sesionId}&tipo=lo-que-vendes`;

/** Las etapas en que ya no hay nada que contestar (la oferta sigue en su tab). */
export const terminoElArranque = (etapa: EtapaArranque): boolean => etapa === 'cierre' || etapa === 'listo';

/** El placeholder del composer en cada pregunta. Corto: es texto que se dibuja. */
export function placeholderDe(etapa: EtapaArranque): string | undefined {
  switch (etapa) {
    case 'nombre': return 'Tu nombre';
    case 'negocio': return 'El nombre de tu negocio';
    case 'origen': return 'Cómo llegaste';
    case 'objetivo': return 'Tu objetivo';
    case 'que_hace': return 'A qué se dedica';
    case 'telefono': return 'Tu WhatsApp, con el código de país';
    case 'codigo': return 'El código de 6 dígitos';
    case 'avisos': return 'Activa los avisos con el botón';
    // Las preguntas con opciones también se contestan escribiendo (20/10/2026, Florencia: no sabía que podía).
    case 'fase': case 'interes': return 'Elige una opción o escríbelo con tus palabras';
    case 'cierre': case 'listo': return 'Tu oferta sigue en Offer';
    default: return undefined;
  }
}

/**
 * Dónde va la respuesta optimista (el globito del dueño mientras se guarda): con la pregunta de la etapa,
 * antes o después de la conversación de la oferta.
 */
export function ladoDeLaPregunta(etapa: EtapaArranque, modo: 'oferta' | 'plan' = 'plan'): 'antes' | 'despues' {
  // El diagnóstico va antes en modo 'plan' (no hay oferta) y después en 'oferta' (después de lo que vende). «¿Cómo
  // llegaste?» y «¿Qué resolver primero?» van al final desde el 18/10/2026: en 'oferta', DESPUÉS de lo que vende. Si
  // este lado no es el de la pregunta, la respuesta optimista se dibuja arriba, fuera de la vista, y abajo sólo salen
  // los puntitos (Martín, punto 11). tests/onboarding-respuesta-visible.test.ts recorre todas las etapas.
  if (etapa === 'fase' || etapa === 'origen' || etapa === 'interes' || etapa === 'avisos') return modo === 'oferta' ? 'despues' : 'antes';
  return etapa === 'telefono' || etapa === 'codigo' || etapa === 'nombre' || etapa === 'negocio' || etapa === 'objetivo' || etapa === 'que_hace' ? 'antes' : 'despues';
}
