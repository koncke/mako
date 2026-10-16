// =============================================================================
// oferta-lista — los datos del aviso «tu oferta está lista» (puro, con test)
// =============================================================================
// Pedido de Martín en la llamada con Leila (12/10/2026, 00:37:00): que MaKo arme la oferta sin que la persona se
// quede esperando en la pestaña, «te mando una notificación cuando esté listo». Desde el 16/10 la oferta se arma en
// el SERVIDOR (app/api/offer/route.ts, `armarPorDetras`) y al terminar se emite el evento de la plataforma
// `oferta_lista` con estos datos. Qué se manda y por dónde lo decide la automatización del SuperAdmin (la plantilla
// «Oferta Lista de un Negocio», lib/plantillas-automatizaciones.ts): este código no decide a quién avisar.
// Aparte del emisor (lib/oferta-lista-server.ts) porque aquél es `server-only`.

import { MARCA_COMPLETAR } from './offer-marco';

/**
 * LOS DATOS DE LA OFERTA QUE QUEDÓ LISTA, por nombre: «{{oferta_lista_nombre}}», «{{oferta_lista_version}}» y
 * «{{oferta_lista_link}}» (lib/variables-aviso.ts). Un nombre con «[completar]» adentro no va: el renglón del nombre
 * se va solo (un dato que falta saca su renglón; uno vacío lo dejaría con el emoji solo).
 */
export function datosOfertaLista(input: { nombre: string | null | undefined; version: number; link: string }): {
  oferta_lista_nombre?: string; oferta_lista_version: string; oferta_lista_link: string;
} {
  const nombre = (input.nombre ?? '').trim();
  const sirve = nombre && !nombre.includes(MARCA_COMPLETAR);
  return {
    ...(sirve ? { oferta_lista_nombre: nombre.slice(0, 120) } : {}),
    oferta_lista_version: String(input.version),
    oferta_lista_link: input.link,
  };
}

/**
 * Adónde lleva el link del aviso: a la tab Offer. Mientras el onboarding está pendiente, la tab manda al chat de
 * arranque (que tiene la oferta adentro); después, abre la conversación más reciente, que es ésta.
 */
export const RUTA_OFERTA_LISTA = '/offer';
