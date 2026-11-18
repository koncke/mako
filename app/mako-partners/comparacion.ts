// =============================================================================
// MaKo frente a GoHighLevel: la tabla de la landing de MaKo Partners (18/11/2026)
// =============================================================================
// Aparte de LandingPartners.tsx porque son datos de OTRA app, con su fuente cada uno: en la landing no se escribe ningún número
// a mano (los de MaKo salen de sus constantes), y los de acá no son nuestros sino de lo que GoHighLevel publica.
// =============================================================================

import type { FilaPropia } from '@/app/vsl/_sitio/Comparaciones';
import { COMPETIDORES, celdaDeMaKo } from '@/app/vsl/_sitio/competencia';

/** La app con la que se compara (su slug en app/vsl/_sitio/competencia-datos.ts: logo, comentario, «Elige X si», su precio). */
export const COMPARACION_CON = 'gohighlevel';
const GHL = COMPETIDORES.find((x) => x.slug === COMPARACION_CON);

/**
 * MaKo FRENTE A GoHighLevel (18/11/2026, Martín: «una tablita de comparación contra otras aplicaciones como GoHighLevel»).
 * ⚠️ CADA FILA ES VERDAD Y SE PUEDE COMPROBAR en el sitio oficial de GoHighLevel: la `fuente` es la página que lo dice (leída
 * el 18/11/2026). Si GoHighLevel cambia, la fila se corrige o se va; una fila sin fuente no entra (el test lo exige).
 * Lo que NO va, porque no se puede decir con verdad: «material para recomendar» (ellos también lo dan: Brand Kit y Asset Library
 * en gohighlevel.com/affiliate), «arranca sin conocimientos técnicos» (también tienen onboarding), «en español» a secas (su app
 * tiene la interfaz en español; lo que está en inglés es la ayuda) y la comisión (ellos pagan 40% recurrente; Martín compite
 * por valor). Lo de MaKo: las líneas de WhatsApp vienen con el plan (se conecta por QR, lib/evolution-*, sin cobro por mensaje)
 * y el setter con IA es de MaKo Pro (`FUNCIONES_SOLO_PRO`, lib/topes-plan.ts).
 * La dibuja el MISMO componente de las comparaciones del sitio (`TarjetasVs`, app/vsl/_sitio/Comparaciones.tsx: la tarjeta
 * «MaKo vs GoHighLevel» que abre su panel con la tabla), con estas filas en lugar de la matriz.
 */
export const COMPARACION: readonly FilaPropia[] = [
  { nombre: 'Soporte por WhatsApp', mako: { v: 'si' },
    otra: { v: 'Chat, Zoom, tickets y teléfono', fuente: 'https://help.gohighlevel.com/support/solutions/articles/155000000969-24-7-customer-support-options' } },
  { nombre: 'Centro de ayuda en español', mako: { v: 'si' },
    otra: { v: 'En inglés', fuente: 'https://help.gohighlevel.com/support/home' } },
  { nombre: 'WhatsApp incluido en el plan', mako: celdaDeMaKo('whatsapp'),
    otra: { v: 'US$ 10 al mes aparte, más cada mensaje', fuente: 'https://help.gohighlevel.com/support/solutions/articles/155000001428-whatsapp-pricing-billing-and-rebilling-guide' } },
  { nombre: 'IA que contesta a tus clientes', mako: celdaDeMaKo('setter_ia'),
    otra: { v: 'Aparte: por uso o desde US$ 50 al mes', fuente: 'https://help.gohighlevel.com/support/solutions/articles/155000001156-highlevel-pricing-guide' } },
  // El precio de entrada, de los mismos datos que la página de comparaciones: MaKo, el de Essential; GoHighLevel, el relevado.
  { nombre: 'Precio de entrada', mako: { v: `Desde ${celdaDeMaKo('precio').v} al mes` },
    otra: { v: `Desde ${GHL?.celdas.precio?.v ?? '?'} al mes`, fuente: GHL?.celdas.precio?.fuente ?? '' } },
];

/** Cuándo se leyeron las fuentes de la tabla (se dice debajo, así la comparación queda con fecha). */
export const COMPARACION_LEIDA = 'noviembre de 2026';
