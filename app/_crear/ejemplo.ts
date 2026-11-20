// =============================================================================
// El ejemplo de una plantilla de Create: el rótulo y el primer mensaje de MaKo (29/10/2026)
// =============================================================================
// Martín, 29/10/2026: «Los templates tienen que ser reales... deben ser ejemplos reales... así MaKo al entrar te da el
// template y te puede ir ayudando a crearlo». Cada plantilla nace con el ejemplo COMPLETO de un negocio ficticio del elenco
// (docs/plantillas-reales/README.md, 2.2), y las cinco tabs lo dicen con las mismas palabras (README, 2.3):
//   · el rótulo: «Ejemplo: <negocio> (negocio ficticio)» (lo usan la tarjeta de Create y el Lead Magnet Generator);
//   · el primer mensaje, armado acá y sin llamar a la IA (no gasta la IA del cliente sin que lo pida): la pregunta de la
//     oferta (abajo, desde el 5/11/2026) y el segundo botón de cada tab;
//   · Offer es la excepción: adaptar empieza por el documento de la oferta, así que pide eso, con «No tengo, pregúntame».
// Puro (sin React): lo leen sus tests (tests/crear-pantalla.test.ts, tests/iniciativa-create.test.ts).
// ⚠️ `primerMensajeDeEjemplo` NO TIENE QUIEN LA LLAME en app/ ni en lib/ (medido el 18/11/2026). Cada tab armó su primer
// mensaje por su lado: el Copywriter con lib/copywriter/iniciativa.ts (su página nace con la estructura, no con el ejemplo, así
// que «Es un ejemplo de…» ahí sería falso), Video e Image con lib/aperturas/, Offer con su chat. El único que la tenía en el
// plan es AI Avatar (T15 de docs/mako-iniciativa/plan.md), que puede armar lo mismo con `pasoOferta` y `quienDelEjemplo`.
//
// ⚠️ DESDE EL 5/11/2026 PREGUNTA LA OFERTA, NO «¿LO ADAPTO A TU NEGOCIO?» (docs/mako-iniciativa/plan.md T4 y §4): «¿Lo adapto…?»
// pregunta una ACCIÓN (lo atrapa `PREGUNTA_DE_ACCION`, lib/aperturas/reglas.ts). La primera pregunta es de HECHO: «¿Para cuál de
// tus ofertas es?», la MISMA de `pasoOferta` (lib/aperturas/comunes.ts), así que con una oferta sale «¿Es para «X»?» y sin
// ninguna «¿Qué vas a vender con esto?». Los botones son las ofertas y, al final, el segundo botón de la tab.
// =============================================================================

import { pasoOferta, type OfertaCorta } from '@/lib/aperturas/comunes';

/** Las tabs de Create que abren una plantilla con un ejemplo. */
export type TabConEjemplo = 'copywriter' | 'video' | 'image' | 'avatar' | 'offer';

export const NO_TENGO_PREGUNTAME = 'No tengo, pregúntame';

/** El segundo botón de cada tab (README, 2.3). En Offer es el único. */
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

/** La primera frase, común a las cinco tabs: «Es un ejemplo de Pulso Dental, un negocio ficticio.». */
export function quienDelEjemplo(negocio: string): string {
  return `Es un ejemplo de ${negocioDe(negocio)}, un negocio ficticio.`;
}

/**
 * El primer mensaje de MaKo al abrir una plantilla: el texto y sus botones, el primero es la recomendación. `ofertas`: las del
 * negocio (`listarOfertas`, la principal primero), para preguntar para cuál es.
 */
export function primerMensajeDeEjemplo(tab: TabConEjemplo, negocio: string, ofertas: readonly OfertaCorta[] = []): { texto: string; botones: string[] } {
  const quien = quienDelEjemplo(negocio);
  if (tab === 'offer') {
    return {
      texto: `${quien} Para adaptarlo a tu oferta, ¿tienes un documento, tu guion de ventas o el link de tu web? Súbelo o pégalo aquí.`,
      botones: [SEGUNDO_BOTON.offer],
    };
  }
  const paso = pasoOferta({ superficie: tab, ofertas, antes: quien });
  return { texto: paso.texto, botones: [...paso.botones.filter((b) => b.tipo !== 'callar').map((b) => b.rotulo), SEGUNDO_BOTON[tab]] };
}
