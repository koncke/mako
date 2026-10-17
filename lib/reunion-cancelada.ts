// =============================================================================
// reunion-cancelada — los datos de la reunión que el lead canceló en Calendly (puro, con test)
// =============================================================================
// «Nada por detrás», lote 2 (docs/inventario-nada-por-detras.md, 17/10/2026): el aviso «Se canceló la R1 con…»
// (`reunion-cancelada`) lo mandaba el webhook de Calendly con su texto escrito en el código, y sin ningún freno: una
// reentrega de Calendly lo repetía. Pasa a ser una automatización de la plataforma (el evento `reunion_cancelada`), con
// el texto literal en su fila. El webhook (app/api/webhooks/calendly/route.ts) pasa estos datos; aparte porque aquél no
// se puede importar desde un test.

/** Los datos por nombre: «{{cancelada_reunion}}» y «{{cancelada_cuando}}» (lib/variables-aviso.ts). */
export function datosCancelada(input: { reunion: 'R1' | 'R2'; cuando: string }): { cancelada_reunion: string; cancelada_cuando: string } {
  return { cancelada_reunion: input.reunion, cancelada_cuando: input.cuando };
}

/**
 * LA CLAVE DEL FRENO: una cancelación es UNA reunión (su URI de Calendly) a UNA hora. Calendly reentrega el webhook si no
 * le contestamos a tiempo, y sin esto el grupo recibía el aviso dos veces (el inventario: «NINGUNO»). Es la misma clave
 * con que ya se frenaba el flujo del store (`lead.cancelo`).
 */
export const claveCancelada = (uri: string | null | undefined, leadId: number, inicioIso: string): string =>
  `calendly-cancelo:${uri || leadId}|${inicioIso}`;

/** Cuánto vale el freno: un día (una reentrega llega en minutos; dos cancelaciones de la MISMA reunión, nunca). */
export const DEDUP_CANCELADA_MIN = 24 * 60;
