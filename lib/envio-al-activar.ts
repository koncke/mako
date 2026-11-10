// =============================================================================
// envio-al-activar — ACTIVAR una automatización prende el envío de WhatsApp del negocio (17/10/2026, tarjeta #851)
// =============================================================================
// Decisión de Martín en la Ticketera (`envio-whatsapp-al-activar`, 17/10 02:15): «B · Sí, y prenderlo ya».
//
// El envío de WhatsApp de un negocio es un interruptor aparte de la línea (`envio_whatsapp_enabled`, lib/envio-flags.ts),
// fail-closed para los clientes: sin la setting, apagado. Medido el 17/10: prendido sólo en ws1, ws11 y ws13. Un cliente
// conectaba su WhatsApp, activaba una automatización que le escribe al lead, la veía «Activa»… y no salía nada: el cartel
// amarillo «El envío de WhatsApp está apagado» que Martín vio en la revisión con la línea de Pablo conectada. Activar YA ES
// el consentimiento de mandar: dos interruptores para lo mismo es una regla escondida.
//
// Sólo PRENDE, y sólo al activar una que le escribe al lead por WhatsApp (un mensaje o un AI Step por WhatsApp). La
// tarjeta MaKo al grupo no depende de este interruptor (es una ⚡ Acción, por la línea de MaKo). Apagarlo sigue siendo
// a mano, en /whatsapp, y el cartel de /automations lo sigue diciendo.
//
// ⚠️ Y EL EMAIL TAMBIÉN, desde el 10/11/2026 (Martín: «que Leandro… lo estuvo intentando utilizar y no lo pudo»). El de
// email es el otro interruptor de canal (`envio_email_enabled`), también apagado para un cliente sin la setting: activar una
// automatización con emails dejaba cada email en «canal email apagado», reintentado cada 24 h, sin un aviso. Se extiende la
// MISMA decisión de #851 (no es otra). Un email sólo sale con el dominio y el remitente propios del negocio (`sendEmail` se
// niega sin ellos), así que prenderlo no hace hablar a MaKo por nadie. Por la API, lo que se prendió se DICE en la respuesta
// (`textoDeLoQuePrendio`). Si Martín no lo quiere para el email: `enviosQuePrender` con `email: false`, una línea.
// =============================================================================

import { esNodoMensaje, esPasoIA, medioDe, type PasoGrafo } from './flujo-grafo';

/** ¿Esta automatización le escribe al LEAD por WhatsApp? Un mensaje por WhatsApp, o un AI Step que contesta por ahí. */
export function leEscribeAlLeadPorWhatsapp(pasos: readonly PasoGrafo[]): boolean {
  return pasos.some((p) => !!p && ((esNodoMensaje(p) && (p.canal ?? 'whatsapp') === 'whatsapp') || (esPasoIA(p) && medioDe(p) === 'whatsapp')));
}

/**
 * ¿Esta automatización le escribe al LEAD por EMAIL? (10/11/2026, la auditoría de Automations para un usuario nuevo). La misma
 * decisión de Martín del 17/10 («Activar YA ES el consentimiento de mandar»), que hasta acá valía sólo para WhatsApp: el email
 * tenía su propio interruptor (`envio_email_enabled`, apagado para un cliente sin la setting), activar no lo tocaba, y un
 * negocio con su dominio conectado veía «Activada ✓» y el motor marcaba cada email «canal email apagado» cada 24 h, para siempre.
 * Activar ya exige el email conectado (`medioSinConectar`), así que prenderlo acá no manda por una cuenta que no existe.
 */
export function leEscribeAlLeadPorEmail(pasos: readonly PasoGrafo[]): boolean {
  return pasos.some((p) => !!p && esNodoMensaje(p) && p.canal === 'email');
}

/**
 * QUÉ ENVÍO PRENDER AL ACTIVAR, con lo que está prendido hoy: sólo el de un canal por el que la automatización le escribe al
 * lead, y sólo si está apagado. Nunca APAGA (apagarlo sigue siendo a mano, en /whatsapp y en /email).
 */
export function enviosQuePrender(pasos: readonly PasoGrafo[], prendidos: { whatsapp: boolean; email: boolean }): { whatsapp: boolean; email: boolean } {
  return {
    whatsapp: leEscribeAlLeadPorWhatsapp(pasos) && !prendidos.whatsapp,
    email: leEscribeAlLeadPorEmail(pasos) && !prendidos.email,
  };
}

/** La frase que dice lo que activar prendió solo (la respuesta por la API y por WhatsApp). Vacío si no prendió nada. */
export function textoDeLoQuePrendio(p: { whatsapp: boolean; email: boolean }): string {
  if (p.whatsapp && p.email) return 'Se prendió el envío real de WhatsApp y de email del negocio: sus mensajes salen de verdad.';
  if (p.whatsapp) return 'Se prendió el envío real de WhatsApp del negocio: sus mensajes salen de verdad.';
  if (p.email) return 'Se prendió el envío real de email del negocio: sus emails salen de verdad.';
  return '';
}
