// =============================================================================
// MaKo vs. GoHighLevel: la tabla de la landing de MaKo Partners (18/11/2026)
// =============================================================================
// Martín por el Cerebro: «la idea es posicionar a MaKo por arriba de HighLevel… si vas a poner la X, pon simplemente la X, no
// aclares cosas abajo. Tampoco pongas datos de gohighlevel.com». La tabla va a la vista: sólo ✓ y ✕ (salvo el precio de entrada,
// que dice los dos montos), sin textos debajo de cada celda ni la nota de las fuentes.
// ⚠️ CADA ✕ ES VERDAD Y SE PUEDE COMPROBAR en el sitio oficial de GoHighLevel: la `fuente` es la página que lo dice (leída el
// 18/11/2026). No se muestra, pero queda acá y el test exige una por fila. Si GoHighLevel cambia, la fila se corrige o se va.
//   · WhatsApp: US$ 10 al mes aparte por cuenta, más cada mensaje (su guía de precios de WhatsApp).
//   · IA: los agentes de IA se pagan aparte, por uso o US$ 50/97 al mes por cuenta («AI Agents… remain paid»).
//   · Todo en el mismo precio: por lo de arriba, WhatsApp e IA son extras.
//   · Soporte: chat, Zoom, tickets y teléfono; WhatsApp no figura.
//   · Tutoriales en español: su centro de ayuda está en inglés (también /es/).
//   · Ayuda con anuncios y atención de contactos: a sus afiliados les da material (Brand Kit, Asset Library), no esa ayuda.
//   · Latinoamérica y los medios de pago: «We don't accept PayPal, checks» y el plan se paga con tarjeta; ni pesos, ni Binance, ni
//     Mercado Pago.
// Lo que NO va como ✕ porque sería falso (Martín lo pidió y el Cerebro lo descartó): «todo en una sola app» (GoHighLevel también lo
// es) y «material para vender» (también lo da). Las filas 4 y 7 lo dicen de una forma que sí es verdad. Tampoco la comisión (ellos
// pagan 40% recurrente; Martín compite por valor).
// Lo de MaKo sale del código: el WhatsApp y la IA vienen con el plan (`celdaDeMaKo`; el test lo verifica) y el precio, el de
// Essential. Aparte de LandingPartners.tsx porque son datos de OTRA app: en la landing no se escribe ningún número a mano.
// =============================================================================

import { COMPETIDORES, celdaDeMaKo } from '@/app/vsl/_sitio/competencia';

/** Una fila: ✓ para MaKo y ✕ para la otra; la del precio, con los dos montos. */
export type FilaVs = { nombre: string; precio?: { mako: string; otra: string }; fuente: string };

const GHL = COMPETIDORES.find((x) => x.slug === 'gohighlevel');
export const NOMBRE_OTRA = GHL?.nombre ?? 'GoHighLevel';
export const LOGO_OTRA = GHL?.logo ?? '/vsl-assets/logos/apps/gohighlevel.png';

export const COMPARACION_TITULO = `MaKo vs. ${NOMBRE_OTRA}`;

const AYUDA = 'https://help.gohighlevel.com/support/solutions/articles/';
const PRECIOS_IA = `${AYUDA}155000001156-highlevel-pricing-guide`;
const PAGOS = `${AYUDA}48001208376-common-billing-related-questions-for-agencies`;

export const COMPARACION: readonly FilaVs[] = [
  { nombre: 'Precio de entrada', precio: { mako: celdaDeMaKo('precio').v, otra: GHL?.celdas.precio?.v ?? '?' },
    fuente: GHL?.celdas.precio?.fuente ?? 'https://www.gohighlevel.com/pricing' },
  { nombre: 'WhatsApp incluido en el plan', fuente: `${AYUDA}155000001428-whatsapp-pricing-billing-and-rebilling-guide` },
  { nombre: 'IA incluida en el plan', fuente: PRECIOS_IA },
  { nombre: 'Todo incluido en el mismo precio, sin extras', fuente: PRECIOS_IA },
  { nombre: 'Soporte por WhatsApp', fuente: `${AYUDA}155000000969-24-7-customer-support-options` },
  { nombre: 'Fácil de usar, con tutoriales en español de cada pantalla', fuente: 'https://help.gohighlevel.com/support/home' },
  { nombre: 'Te ayudamos con tus anuncios y atendemos a tus contactos', fuente: 'https://www.gohighlevel.com/affiliate' },
  { nombre: 'Pensada para vender en Latinoamérica: WhatsApp, pesos y Binance', fuente: PAGOS },
  { nombre: 'Pagar con Mercado Pago, transferencia o Binance', fuente: PAGOS },
];
