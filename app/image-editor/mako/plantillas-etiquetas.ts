// =============================================================================
// Para qué negocio es cada plantilla del Image Editor (el panel «Plantillas»)
// =============================================================================
// Lo que lee `ordenarConSugeridas` (lib/plantillas-sugeridas.ts) para poner primero, con un «Sugerido» sutil, las que
// le sirven a ESTE negocio (Martín, 16/10/2026: «en todos los lugares que usamos templates…»). Una fila por plantilla
// de ./plantillas.ts, por su slug, y el test exige que estén TODAS (tests/plantillas-sugeridas-editores.test.ts).
// Cómo se enchufa una galería: docs/plantillas-sugeridas.md.
//
// Son las 10 de Doory, y la mitad no dice nada de cómo VENDE un negocio: una frase, una presentación para inversores,
// un póster de concierto, una invitación de boda, un currículum y una miniatura de YouTube son `{}` (no se sugieren
// nunca: es una decisión, no un olvido). Las otras, por la pregunta que contestan:
//   · el anuncio de oferta (descuento y botón), al que cobra en un checkout;
//   · la historia de evento (fecha, lugar y «confirmar»), al que vende en un webinar o cierra en persona;
//   · el volante de inauguración y la tarjeta de presentación, al que cierra en persona (un local, el trato cara a cara).
// ⚠️ Ninguna lleva un eje genérico (un cuello, un cobro): todas son de UN modo de vender, y un eje genérico las
//    sugeriría a quien vende de otro (la regla de lib/graficos-plantillas-etiquetas.ts).
//
// Puro y sólo con tipos: lo leen el panel (en el navegador), la API de MaKo y los tests.
// =============================================================================

import type { EtiquetasPlantilla } from '@/lib/plantillas-sugeridas';

/** Las plantillas del Image Editor (`PLANTILLAS`, ./plantillas.ts), por slug. */
export const ETIQUETAS_IMAGEN: Readonly<Record<string, EtiquetasPlantilla>> = {
  'bold-sale-announcement': { canal: ['carrito'], entrada: ['carrito'] },
  'serif-quote-card': {},
  'rooftop-event-story': { canal: ['webinar', 'presencial'] },
  'modern-pitch-deck': {},
  'night-bloom-concert-poster': {},
  'grand-opening-flyer': { canal: ['presencial'] },
  'botanical-celebration-invitation': {},
  'modern-resume': {},
  'bold-youtube-thumbnail': {},
  'clean-business-card': { canal: ['presencial'] },
};
