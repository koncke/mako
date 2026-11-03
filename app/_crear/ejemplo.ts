// =============================================================================
// El ejemplo de una plantilla de Create: el rótulo y el primer mensaje de MaKo (29/10/2026)
// =============================================================================
// Martín, 29/10/2026: «Los templates tienen que ser reales... deben ser ejemplos reales... así MaKo al entrar te da el
// template y te puede ir ayudando a crearlo». Cada plantilla nace con el ejemplo COMPLETO de un negocio ficticio del elenco
// (docs/plantillas-reales/README.md, 2.2), y las cinco tabs lo dicen con las mismas palabras (README, 2.3):
//   · el rótulo: «Ejemplo: <negocio> (negocio ficticio)»;
//   · el primer mensaje, armado acá y sin llamar a la IA (no gasta la IA del cliente sin que lo pida), con «Adaptar a mi
//     negocio» primero y el segundo botón de cada tab;
//   · Offer es la excepción: adaptar empieza por el documento de la oferta, así que pide eso, con «No tengo, pregúntame».
// Puro (sin React): lo leen los chats de cada tab y sus tests (tests/crear-pantalla.test.ts).
// =============================================================================

/** Las tabs de Create que abren una plantilla con un ejemplo. */
export type TabConEjemplo = 'copywriter' | 'video' | 'image' | 'avatar' | 'offer';

export const ADAPTAR_A_MI_NEGOCIO = 'Adaptar a mi negocio';
export const NO_TENGO_PREGUNTAME = 'No tengo, pregúntame';

/** El segundo botón de cada tab (README, 2.3). Offer no tiene «Adaptar a mi negocio»: su único botón es este. */
const SEGUNDO_BOTON: Readonly<Record<TabConEjemplo, string>> = {
  copywriter: 'Solo la estructura',
  video: 'Lo edito yo',
  image: 'Lo edito yo',
  avatar: 'Ver el ejemplo completo',
  offer: NO_TENGO_PREGUNTAME,
};

const negocioDe = (negocio: string) => negocio.trim() || 'un negocio';

/** «Ejemplo: Pulso Dental (negocio ficticio)». */
export function rotuloDeEjemplo(negocio: string): string {
  return `Ejemplo: ${negocioDe(negocio)} (negocio ficticio)`;
}

/** El primer mensaje de MaKo al abrir una plantilla: el texto y sus botones, el primero es la recomendación. */
export function primerMensajeDeEjemplo(tab: TabConEjemplo, negocio: string): { texto: string; botones: string[] } {
  const quien = `Es un ejemplo de ${negocioDe(negocio)}, un negocio ficticio.`;
  if (tab === 'offer') {
    return {
      texto: `${quien} Para adaptarlo a tu oferta, ¿tienes un documento, tu guion de ventas o el link de tu web? Súbelo o pégalo aquí.`,
      botones: [SEGUNDO_BOTON.offer],
    };
  }
  return { texto: `${quien} ¿Lo adapto a tu negocio?`, botones: [ADAPTAR_A_MI_NEGOCIO, SEGUNDO_BOTON[tab]] };
}
