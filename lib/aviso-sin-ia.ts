// =============================================================================
// aviso-sin-ia — qué texto sale cuando la IA no redactó el aviso (06/11/2026)
// =============================================================================
// `generarMensajeAviso` (lib/plantillas.ts) le pide a la IA que escriba el aviso con la plantilla de referencia y los
// DATOS REALES del evento. Si la IA falla o contesta vacío, hasta el 06/11/2026 salía la referencia tal cual. Y la
// referencia de un negocio que nunca editó el texto es el EJEMPLO de fábrica del catálogo, con datos inventados
// («En 30 min tienes la R2 con Laura Gil… crm/482»): el grupo recibía una reunión que no existe, con el link a un lead
// de otro negocio (docs/relevo/automations-nube-2710.md, Leila 1). Un mensaje que sale solo no afirma lo que no pasó.
//
// La regla: si el negocio escribió su propio texto, sale ése (ya con sus variables resueltas: lo escribió una persona).
// Si no, salen los datos reales del evento —el contexto, feo pero cierto—, nunca el ejemplo.
// Sin `server-only`: lo prueba tests/aviso-sin-ia.test.ts.
// =============================================================================

export function textoSinIA(o: {
  /** La referencia como está guardada, antes de resolver variables. */
  referencia: string;
  /** La misma referencia con las variables ya resueltas. */
  resuelta: string;
  /** El ejemplo del catálogo para ese aviso (undefined si el aviso no es del catálogo). */
  deFabrica: string | undefined;
  /** Los datos reales del evento, como se le pasaron a la IA. */
  contexto: string;
}): string {
  const propia = o.referencia.trim() !== '' && o.referencia.trim() !== (o.deFabrica ?? '').trim();
  if (propia) return o.resuelta;
  return o.contexto.trim() || o.resuelta;
}
