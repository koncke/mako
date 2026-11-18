// =============================================================================
// editor-video/plantillas-etiquetas — para qué negocio es cada plantilla de anuncio del Video Editor
// =============================================================================
// Lo que lee `ordenarConSugeridas` (lib/plantillas-sugeridas.ts) para poner primero, con un «Sugerido» sutil, las que
// le sirven a ESTE negocio (Martín, 16/10/2026: «en todos los lugares que usamos templates…»). Una fila por plantilla
// de PLANTILLAS (./plantillas.ts), y el test exige que estén TODAS (tests/plantillas-sugeridas-editores.test.ts). Cómo
// se enchufa una galería: docs/plantillas-sugeridas.md.
//
// Todas son anuncios verticales, así que «es un anuncio» no distingue a ninguna: se etiqueta por la PREGUNTA que
// contesta cada una. El gancho, «¿por qué frenar el scroll y dejar tus datos?» (los leads vienen de anuncios); el
// testimonio, «¿por qué confiar?» (el que cierra conversando, y el cuello en la conversión); el antes y después y los
// beneficios, «¿qué gano?» (el cuello en la oferta; los beneficios también para quien vende desde su página); la oferta,
// «¿por qué AHORA?» (el que cobra en un checkout o en un lanzamiento).
// Las seis del 18/11/2026 (docs/plantillas-reales/video.md, tanda 1 de la sección 5, con la fila que pide cada una):
// la respuesta a un comentario, de quien vende por chat; el caso con números, de quien vende por llamada y cobra una
// suscripción; la historia, del cuello en la conversión; los tres errores, de quien recibe mensajes; el tour, de quien
// cierra en persona. El clip de podcast va `{}`: es para recortar un video largo, y ninguna señal del negocio lo distingue.
// («Gancho escrito» y «Oferta con glitch» iban `{}` por ser variantes de su original; se retiraron ese día.)
// ⚠️ Y LA OFERTA NO LLEVA UN EJE GENÉRICO: es de quien cobra en un checkout o en un lanzamiento, y un cuello en la
//    conversión la sugeriría a quien vende por llamada (la regla de lib/graficos-plantillas-etiquetas.ts).
//
// Puro y sólo con tipos: lo leen la galería (en el navegador), la API de MaKo, el chat y los tests.
// =============================================================================

import type { EtiquetasPlantilla } from '../plantillas-sugeridas';

/** La galería del Video Editor (`PLANTILLAS`, ./plantillas.ts), por id. */
export const ETIQUETAS_VIDEO: Readonly<Record<string, EtiquetasPlantilla>> = {
  gancho: { entrada: ['formulario_anuncio', 'landing'] },
  'respuesta-comentario': { canal: ['conversaciones'], entrada: ['chat_entrante'] },
  beneficios: { entrada: ['landing'], cuello: ['oferta'] },
  testimonio: { canal: ['llamadas', 'conversaciones'], cuello: ['conversion'] },
  'caso-numeros': { canal: ['llamadas'], cobro: ['suscripcion'] },
  historia: { cuello: ['conversion'] },
  'tres-errores': { entrada: ['chat_entrante'] },
  'clip-podcast': {},
  oferta: { canal: ['carrito', 'webinar'], entrada: ['carrito'] },
  'tour-propiedad': { canal: ['presencial'] },
  'antes-despues': { cuello: ['oferta'] },
};
