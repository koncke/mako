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
// =============================================================================

import { esNodoMensaje, esPasoIA, medioDe, type PasoGrafo } from './flujo-grafo';

/** ¿Esta automatización le escribe al LEAD por WhatsApp? Un mensaje por WhatsApp, o un AI Step que contesta por ahí. */
export function leEscribeAlLeadPorWhatsapp(pasos: readonly PasoGrafo[]): boolean {
  return pasos.some((p) => !!p && ((esNodoMensaje(p) && (p.canal ?? 'whatsapp') === 'whatsapp') || (esPasoIA(p) && medioDe(p) === 'whatsapp')));
}
