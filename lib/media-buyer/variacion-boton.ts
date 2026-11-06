// =============================================================================
// Media Buyer — la variación de BOTÓN (el CTA) de un anuncio ganador (PURO: lo prueban los tests)
// =============================================================================
// Lo prometido a la agencia de Thiago (llamada del 29/10/2026, docs/promesas/2910-llamada-thiago.md, [33:00]): «variaciones
// de hooks y de CTA, publicadas solas». Las variaciones del Ganador eran 4 textos nuevos sobre el mismo creativo; el botón
// (`call_to_action` de Meta) no se probaba nunca.
//
// El botón alternativo lo elige el CÓDIGO, no la IA: un botón que no corresponde al destino (un «Comprar» en un formulario
// instantáneo, un «Reservar» que lleva a un formulario) Meta lo rechaza o, peor, lo publica y confunde al que hace clic. Así
// que se cambia SÓLO entre los botones que sirven para el mismo destino, y SÓLO uno por tanda: el texto queda igual, así que
// si gana, lo que ganó es el botón (un test que cambia dos cosas a la vez no dice cuál funcionó).
//
// Lo que NO se varía nunca:
//   · el de WhatsApp (WHATSAPP_MESSAGE) y el sin botón: los ata el destino del anuncio, no es una preferencia;
//   · un anuncio cuyo botón no se pudo leer (Zernio no lo devuelve): sin saber cuál tiene, no se sabe qué probar.
//
// ⚠️ La pantalla de las variaciones (app/ads-manager/Autopilot.tsx) todavía no conoce `cta`: dibuja `gancho` en negrita,
//    y por eso la variación de botón lleva en `gancho` qué botón prueba. El relevo para Marketing CoPilot lo dice
//    (docs/relevo/nube-thiago-anuncios.md). `hooks-video.ts` la saltea: no hay nada que filmar en un botón.
// =============================================================================

import type { Variacion } from './tipos';

/** Los nombres que ve la persona (los mismos de Meta en español). */
export const NOMBRE_BOTON: Record<string, string> = {
  LEARN_MORE: 'Más información', SIGN_UP: 'Registrarte', APPLY_NOW: 'Solicitar ahora', BOOK_NOW: 'Reservar', CONTACT_US: 'Contactarnos',
  GET_QUOTE: 'Pedir cotización', SHOP_NOW: 'Comprar', SUBSCRIBE: 'Suscribirte', DOWNLOAD: 'Descargar', WHATSAPP_MESSAGE: 'Enviar WhatsApp',
};

/**
 * Con un formulario instantáneo: los botones que Meta acepta para un anuncio de clientes potenciales y que dicen lo mismo
 * («dejame tus datos»). Comprar o Reservar no van: el formulario no vende ni agenda.
 */
const CON_FORMULARIO: Record<string, string> = { SIGN_UP: 'APPLY_NOW', APPLY_NOW: 'SIGN_UP', LEARN_MORE: 'SIGN_UP', GET_QUOTE: 'SIGN_UP', SUBSCRIBE: 'SIGN_UP', DOWNLOAD: 'SIGN_UP' };

/**
 * A una página: el contraste más simple, «Más información» contra el botón que pide la acción. Comprar o Reservar no se
 * PROPONEN desde otro botón (la página puede no vender ni agendar), pero sí se prueban contra «Más información».
 */
const A_UNA_PAGINA: Record<string, string> = { LEARN_MORE: 'SIGN_UP', SIGN_UP: 'LEARN_MORE', APPLY_NOW: 'LEARN_MORE', BOOK_NOW: 'LEARN_MORE', SHOP_NOW: 'LEARN_MORE', CONTACT_US: 'LEARN_MORE', GET_QUOTE: 'LEARN_MORE', SUBSCRIBE: 'LEARN_MORE', DOWNLOAD: 'LEARN_MORE' };

/** El botón a probar contra el que tiene hoy, o null si este anuncio no se prueba con otro botón. */
export function botonAlternativo(actual: string | null | undefined, conFormulario: boolean): string | null {
  const a = (actual ?? '').trim().toUpperCase();
  if (!a || a === 'NO_BUTTON' || a === 'WHATSAPP_MESSAGE') return null;
  return (conFormulario ? CON_FORMULARIO : A_UNA_PAGINA)[a] ?? null;
}

export type OriginalConBoton = {
  textoPrincipal: string | null;
  titulo: string | null;
  /** El botón de Meta (`cta_type`), tal cual lo devuelve el creativo. null = no se pudo leer. */
  cta: string | null;
  /** ¿Lleva a un formulario instantáneo? */
  conFormulario: boolean;
};

/**
 * La variación de botón: el MISMO texto y otro botón. null si no hay un botón para probar o no hay texto que conservar
 * (una copia sin texto saldría como un anuncio vacío).
 */
export function variacionDeBoton(o: OriginalConBoton, idBase: string): Variacion | null {
  const nuevo = botonAlternativo(o.cta, o.conFormulario);
  const texto = (o.textoPrincipal ?? '').trim();
  if (!nuevo || !texto) return null;
  const antes = NOMBRE_BOTON[(o.cta ?? '').toUpperCase()] ?? o.cta;
  return {
    id: `${idBase}-boton`,
    gancho: `Mismo texto, botón «${NOMBRE_BOTON[nuevo]}» (hoy: «${antes}»)`,
    textoPrincipal: texto,
    ...(o.titulo?.trim() ? { titulo: o.titulo.trim() } : {}),
    cta: nuevo,
    elegida: true,
  };
}

/** ¿Es una variación de botón? (la que no se filma ni se reescribe). */
export const esVariacionDeBoton = (v: Pick<Variacion, 'cta'>): boolean => !!v.cta;
