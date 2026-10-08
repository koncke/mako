// =============================================================================
// meta-pixel-mako — el píxel de Meta de MaKo EN SU PROPIA LANDING (hola-mako.com)
// =============================================================================
// No confundir con el Pixel de MaKo que se le da a los CLIENTES (lib/landing-token.ts):
// éste es el de Meta, para que los anuncios que vende MaKo midan y optimicen. Vive en
// el conjunto de datos «MaKo» (1869323014511830) del portafolio de Meta de MaKo,
// creado el 08/10/2026.
//
// SIN `server-only` y sin 'use client' a propósito: decide cuándo se mide y qué
// mensaje de Calendly cuenta como agenda, y eso tiene que poder importarlo un test.
//
// La identidad de la plataforma va en el código (AGENTS.md → «OWNER_WS NO es la
// plataforma»): el ID de un píxel no es un secreto, viaja igual en el HTML.

/** El conjunto de datos «MaKo» del portafolio de Meta de MaKo. */
export const PIXEL_META_MAKO = '1869323014511830';

/**
 * Sólo se mide en el dominio de producción. En local y en los previews de Vercel
 * (`mako-*.vercel.app`) cada visita de prueba entraría a las audiencias y a la
 * optimización de los anuncios como si fuera un visitante real.
 */
const HOSTS_QUE_MIDEN = new Set(['hola-mako.com', 'www.hola-mako.com']);

export function debeMedir(hostname: string): boolean {
  return HOSTS_QUE_MIDEN.has(hostname.toLowerCase());
}

/**
 * ¿Este `message` del navegador es Calendly avisando que se agendó una reunión?
 *
 * El origen se compara EXACTO: un `message` lo puede mandar cualquier iframe o
 * ventana, y un evento falso de agenda le enseñaría a Meta a buscar a quien no
 * agendó. Calendly manda `{ event: 'calendly.event_scheduled', payload }` desde
 * https://calendly.com (su documentación de eventos del widget embebido).
 */
export function esAgendaDeCalendly(origin: string, data: unknown): boolean {
  if (origin !== 'https://calendly.com') return false;
  if (!data || typeof data !== 'object') return false;
  return (data as { event?: unknown }).event === 'calendly.event_scheduled';
}
