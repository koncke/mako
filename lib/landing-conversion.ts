// =============================================================================
// landing-conversion — ¿qué hace la gente en ESTA página? (el paso final del probador del Pixel)
// =============================================================================
// Pedido de Martín (23/10/2026, 22:52), textual: «Tienes que auditar el Pixel de MaKo punta a punta... Porque no es
// personalizable según qué funnel... Debería serlo. [...] Piensa en todos los casos de uso, y que se pueda personalizar
// fácil. Hay eventos que sobran... como «Deja sus datos». La landing de Mauricio no recopila datos...».
//
// Hasta el 24/10/2026 el último paso del probador era «Agenda una llamada» si la página tenía agenda y no formulario, y
// «Deja sus datos» en CUALQUIER otro caso: una página de venta con checkout (el «Sprint 3 días» de un cliente) le pedía
// un formulario que no tiene, en «falta» para siempre. El paso sale ahora de lo que la página HACE, por página (un funnel
// tiene la página del VSL, la de venta y la de gracias), en este orden:
//   1. la página de gracias (ahí no se convierte: se llega después de comprar). Va ANTES de lo elegido: la pregunta
//      se esconde al marcarla, y una elección vieja no puede pedir «toca tu botón de compra» en la de gracias;
//   2. lo que eligió la persona en el paso 2 del Pixel (`conversion` en landing.config);
//   3. el funnel de ESTA página (el producto del paso 2; su tipo es su ENTRADA, lib/pipeline.ts `TIPOS_FUNNEL`):
//      «Compran en el carrito» → Compra, «Te escriben» → WhatsApp, «Agendan llamada» → Agenda. «Llenan un formulario»
//      no cuenta acá: es la entrada que traen casi todos los funnels por default y no dice que ESTA página pida datos;
//   4. lo MEDIDO (un hecho gana a una lectura de HTML que puede estar vieja): un clic a un checkout, una reserva, un
//      opt-in, un clic a WhatsApp;
//   5. lo que el analizador vio en la página (una agenda embebida, un formulario, un link de WhatsApp);
//   6. el funnel del NEGOCIO, cuando la página no tiene uno propio. Va después de lo medido y de lo visto a propósito:
//      dice cómo vende el negocio, no qué hace ESTA página (la de gracias y la del VSL comparten el mismo funnel);
//   7. si no queda nada, NO se inventa un paso: se pide elegirlo en el paso 2.
// Puro y sin server-only: lo leen el diagnóstico (lib/landing-token.ts), la pantalla y la API de MaKo. Con test
// (tests/landing-conversion.test.ts).
// =============================================================================

/** Lo que la gente hace en una página para convertir. `ninguna` = sólo se mira (o es la de gracias). */
export const CONVERSIONES = ['agenda', 'compra', 'datos', 'registro', 'whatsapp', 'ninguna'] as const;
export type Conversion = (typeof CONVERSIONES)[number];
export const esConversion = (v: unknown): v is Conversion => typeof v === 'string' && (CONVERSIONES as readonly string[]).includes(v);

/** Cómo se dice en pantalla (la pregunta del paso 2 y el renglón del probador). */
export const NOMBRE_CONVERSION: Readonly<Record<Conversion, string>> = {
  agenda: 'Agenda una llamada',
  compra: 'Compra',
  datos: 'Deja sus datos',
  registro: 'Se registra',
  whatsapp: 'Te escribe por WhatsApp',
  ninguna: 'Solo mira',
};

/** De dónde salió: lo dice la pantalla en una línea («por tu funnel»), y la API lo devuelve. */
export type PorqueConversion = 'elegida' | 'gracias' | 'funnel' | 'medido' | 'pagina' | 'negocio' | 'nada';

/**
 * Un clic que va a un CHECKOUT (el Pixel lo manda como `click` con el href en `detalle`). La compra en sí pasa en el
 * dominio de la pasarela, donde el Pixel no corre: esto es «fue a pagar», no «compró».
 */
export const RE_CHECKOUT = /\b(?:buy\.stripe\.com|checkout\.stripe\.com|pay\.hotmart\.com|mpago\.la|link\.mercadopago\.com|mercadopago\.com(?:\.[a-z]{2})?\/checkout)/i;
/** Un clic que abre una conversación de WhatsApp. */
export const RE_WHATSAPP = /\b(?:wa\.me\/|wa\.link\/|api\.whatsapp\.com\/send|whatsapp\.com\/send)/i;
/**
 * El sello del EDITOR con el que se armó la página («Edit with Lovable»): no es un botón del negocio. En la landing de
 * un cliente era el 43 % de los clics de 30 días (auditoría del 24/10/2026), y daba verde «hace clic en tus botones».
 */
export const esClicDelEditor = (detalle: string | null | undefined): boolean => /lovable\.dev|edit with lovable/i.test(detalle ?? '');

export type SenalesConversion = {
  /** Lo que eligió la persona en el paso 2 (landing.config), o null. */
  elegida?: Conversion | null;
  /** La página está marcada como la de gracias. */
  gracias?: boolean;
  /** Las entradas del funnel de ESTA página (landing.config), o vacío si no tiene uno propio. */
  entradas: readonly string[];
  /** Las del funnel del negocio: cuentan sólo después de lo medido y de lo visto en la página. */
  entradasDelNegocio?: readonly string[];
  /** Las piezas que vio el analizador; null = no hubo análisis (no sé). */
  piezas: readonly string[] | null;
  hayAgendo: boolean;
  hayOptin: boolean;
  hayClicCheckout: boolean;
  hayClicWhatsapp: boolean;
};

/** La conversión de la página y de dónde salió. `null` = no se puede saber: se pide elegirla, no se inventa. */
export function conversionDeLaPagina(s: SenalesConversion): { conversion: Conversion | null; porque: PorqueConversion } {
  if (s.gracias) return { conversion: 'ninguna', porque: 'gracias' };
  if (s.elegida && esConversion(s.elegida)) return { conversion: s.elegida, porque: 'elegida' };
  const piezas = s.piezas ?? [];
  const tieneForm = piezas.includes('formulario');
  const propio = deEntradas(s.entradas, tieneForm);
  if (propio) return { conversion: propio, porque: 'funnel' };
  // Una agenda sin formulario es una agenda; con los dos, lo que entra al CRM es el formulario.
  const soloAgenda = piezas.includes('embed-agenda') && !tieneForm;
  // Lo medido: el orden es el del embudo más fuerte primero (pagar > agendar > dejar datos > escribir).
  if (s.hayClicCheckout) return { conversion: 'compra', porque: 'medido' };
  if (s.hayAgendo) return { conversion: 'agenda', porque: 'medido' };
  // ⚠️ En una página que es SÓLO una agenda, el opt-in es el de la reserva (desde la v15 una reserva manda el evento Y
  // el contacto): no dice que la página pida datos. Sin esto, la agenda de un cliente salía «Deja sus datos».
  if (s.hayOptin && !soloAgenda) return { conversion: 'datos', porque: 'medido' };
  if (s.hayClicWhatsapp) return { conversion: 'whatsapp', porque: 'medido' };
  // Lo que se ve en la página.
  if (soloAgenda) return { conversion: 'agenda', porque: 'pagina' };
  if (tieneForm) return { conversion: 'datos', porque: 'pagina' };
  if (piezas.includes('link-whatsapp')) return { conversion: 'whatsapp', porque: 'pagina' };
  const delNegocio = deEntradas(s.entradasDelNegocio ?? [], tieneForm);
  if (delNegocio) return { conversion: delNegocio, porque: 'negocio' };
  return { conversion: null, porque: 'nada' };
}

/** Lo que dicen las entradas de un funnel. El orden es el de la lista: el tipo es la PRIMERA que es un tipo (`tipoDeFunnel`). */
function deEntradas(entradas: readonly string[], tieneForm: boolean): Conversion | null {
  for (const e of entradas) {
    if (e === 'carrito') return 'compra';
    if (e === 'chat_entrante') return 'whatsapp';
    // «Agendan llamada» convive con «Llenan un formulario» en muchos funnels: si ESTA página tiene un formulario, lo que
    // entra al CRM es el formulario, y eso lo deciden lo medido o la página.
    if (e === 'agenda_sola' && !tieneForm) return 'agenda';
  }
  return null;
}
