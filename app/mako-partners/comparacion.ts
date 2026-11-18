// =============================================================================
// MaKo frente a GoHighLevel: la tabla de la landing de MaKo Partners (18/11/2026)
// =============================================================================
// Martín por el Cerebro: «la idea es posicionar a MaKo por arriba de HighLevel… sacar ventaja para que elijan revender esto». La
// tabla va a la vista (sin desplegable) y la columna de MaKo gana: lo que GoHighLevel cobra aparte, en rojo; lo que no tiene, con
// una cruz.
// ⚠️ CADA FILA ES VERDAD Y SE PUEDE COMPROBAR en el sitio oficial de GoHighLevel: la `fuente` es la página que lo dice (leída el
// 18/11/2026). Si GoHighLevel cambia, la fila se corrige o se va; una fila sin fuente no entra (el test lo exige).
// Lo que NO va, porque no se puede decir con verdad: «material para recomendar» (ellos también lo dan: Brand Kit y Asset Library en
// gohighlevel.com/affiliate), «arranca sin conocimientos técnicos» y «el coach con IA y el reto de 7 días» (tienen su onboarding:
// no se les puede poner una cruz), «MaKo opera la cuenta desde WhatsApp» (no se puede afirmar la cruz), «en español» a secas (su
// app tiene la interfaz en español; lo que está en inglés es la ayuda) y la comisión (ellos pagan 40% recurrente; Martín compite
// por valor).
// Lo de MaKo sale del código: las líneas de WhatsApp vienen con el plan (se conecta por QR, lib/evolution-*, sin cobro por
// mensaje), el setter con IA es de Pro (`celdaDeMaKo`, de `FUNCIONES_SOLO_PRO`) y el precio, el de Essential.
// Aparte de LandingPartners.tsx porque son datos de OTRA app: en la landing no se escribe ningún número a mano.
// =============================================================================

import { COMPETIDORES, celdaDeMaKo, type ClaveFila } from '@/app/vsl/_sitio/competencia';

/** Una fila: lo de MaKo (vacío = sólo el tilde) y lo de la otra app: lo que cuesta aparte (`costo`) o lo que no tiene (`no`). */
export type FilaVs = { nombre: string; mako: string; otra: string; tipo: 'costo' | 'no'; fuente: string };

const GHL = COMPETIDORES.find((x) => x.slug === 'gohighlevel');
export const NOMBRE_OTRA = GHL?.nombre ?? 'GoHighLevel';
export const LOGO_OTRA = GHL?.logo ?? '/vsl-assets/logos/apps/gohighlevel.png';

/** Lo de MaKo de una fila de la matriz del sitio: «si» es el tilde solo; si no, lo que dice («En Pro»). */
const deMaKo = (clave: ClaveFila): string => { const v = celdaDeMaKo(clave).v; return v === 'si' ? '' : v; };

export const COMPARACION_TITULO = 'Lo que GoHighLevel te cobra aparte o ni siquiera tiene, en MaKo viene incluido';

export const COMPARACION: readonly FilaVs[] = [
  { nombre: 'WhatsApp incluido en el plan', mako: deMaKo('whatsapp'), otra: 'US$ 10 al mes aparte, más cada mensaje', tipo: 'costo',
    fuente: 'https://help.gohighlevel.com/support/solutions/articles/155000001428-whatsapp-pricing-billing-and-rebilling-guide' },
  { nombre: 'IA que contesta a tus clientes', mako: deMaKo('setter_ia'), otra: 'Aparte: por uso o desde US$ 50 al mes', tipo: 'costo',
    fuente: 'https://help.gohighlevel.com/support/solutions/articles/155000001156-highlevel-pricing-guide' },
  { nombre: 'Precio de entrada', mako: `Desde ${celdaDeMaKo('precio').v} al mes`, otra: `Desde ${GHL?.celdas.precio?.v ?? '?'} al mes`, tipo: 'costo',
    fuente: GHL?.celdas.precio?.fuente ?? '' },
  { nombre: 'Soporte por WhatsApp', mako: '', otra: 'Chat, Zoom, tickets y teléfono', tipo: 'no',
    fuente: 'https://help.gohighlevel.com/support/solutions/articles/155000000969-24-7-customer-support-options' },
  { nombre: 'Centro de ayuda en español', mako: '', otra: 'En inglés', tipo: 'no',
    fuente: 'https://help.gohighlevel.com/support/home' },
  // «We don't accept PayPal, checks» y el plan se paga con tarjeta; su transferencia (ACH) es sólo para recargar la billetera desde
  // US$ 1.000, no para el plan. «Sólo con tarjeta», aprobado por el Cerebro (18/11/2026).
  { nombre: 'Pagar con Mercado Pago, transferencia o Binance', mako: '', otra: 'Sólo con tarjeta', tipo: 'no',
    fuente: 'https://help.gohighlevel.com/support/solutions/articles/48001208376-common-billing-related-questions-for-agencies' },
];

/** Cuándo se leyeron las fuentes (se dice debajo de la tabla, así la comparación queda con fecha). */
export const COMPARACION_LEIDA = 'noviembre de 2026';
