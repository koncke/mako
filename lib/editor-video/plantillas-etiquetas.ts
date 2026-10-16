// =============================================================================
// editor-video/plantillas-etiquetas — para qué negocio es cada plantilla de anuncio del Video Editor
// =============================================================================
// Lo que lee `ordenarConSugeridas` (lib/plantillas-sugeridas.ts) para poner primero, con un «Sugerido» sutil, las que
// le sirven a ESTE negocio (Martín, 16/10/2026: «en todos los lugares que usamos templates…»). Una fila por plantilla
// de PLANTILLAS (./plantillas.ts), y el test exige que estén TODAS (tests/plantillas-sugeridas-editores.test.ts). Cómo
// se enchufa una galería: docs/plantillas-sugeridas.md.
//
// Las siete son anuncios verticales, así que «es un anuncio» no distingue a ninguna: se etiqueta por la PREGUNTA que
// contesta cada una. El gancho, «¿por qué frenar el scroll y dejar tus datos?» (los leads vienen de anuncios); el
// testimonio, «¿por qué confiar?» (el que cierra conversando, y el cuello en la conversión); el antes y después y los
// beneficios, «¿qué gano?» (el cuello en la oferta; los beneficios también para quien vende desde su página); la oferta,
// «¿por qué AHORA?» (el que cobra en un checkout o en un lanzamiento).
// ⚠️ LAS VARIANTES SON `{}`, a propósito. «Gancho escrito» y «Oferta con glitch» contestan lo mismo que su original, y
//    con la misma fila saldrían de a dos: dos de las tres «Sugerido» para una sola idea. Se sugiere la original; la
//    variante sigue en su lugar de siempre.
// ⚠️ Y LA OFERTA NO LLEVA UN EJE GENÉRICO: es de quien cobra en un checkout o en un lanzamiento, y un cuello en la
//    conversión la sugeriría a quien vende por llamada (la regla de lib/graficos-plantillas-etiquetas.ts).
//
// Puro y sólo con tipos: lo leen la galería (en el navegador), la API de MaKo, el chat y los tests.
// =============================================================================

import type { EtiquetasPlantilla } from '../plantillas-sugeridas';

/** La galería del Video Editor (`PLANTILLAS`, ./plantillas.ts), por id. */
export const ETIQUETAS_VIDEO: Readonly<Record<string, EtiquetasPlantilla>> = {
  gancho: { entrada: ['formulario_anuncio', 'landing'] },
  'gancho-escrito': {},
  testimonio: { canal: ['llamadas', 'conversaciones'], cuello: ['conversion'] },
  'antes-despues': { cuello: ['oferta'] },
  beneficios: { entrada: ['landing'], cuello: ['oferta'] },
  oferta: { canal: ['carrito', 'webinar'], entrada: ['carrito'] },
  'oferta-glitch': {},
};
