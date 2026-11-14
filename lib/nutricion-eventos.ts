// =============================================================================
// nutricion-eventos — qué automatizaciones mira cada EVENTO del motor (puro)
// =============================================================================
// UNA tabla para los dos que la necesitan: el motor (`enrolarPorEvento`, lib/nutricion.ts) inscribe con ella, y el aviso
// de duplicada (`mismaCohorte`, lib/automatizacion-duplicada.ts) la usa para saber quién le escribe a la misma gente.
// ⚠️ (revisión del Cerebro de 10b52bcc3, 21/10/2026) Mientras vivía sólo en el motor, el aviso creía que «el mismo
// disparador» alcanzaba. Pero el motor junta disparadores DISTINTOS bajo un mismo evento: un lead nuevo de Meta entraba a
// «Dejó el formulario sin agendar» y a «Un Lead Entró» a la vez, y recibía las dos bienvenidas sin un aviso.
// Puro: lo importa también la pantalla (el aviso se calcula en la tab).
// =============================================================================

import { TRIGGER_ETAPA, TRIGGER_ENTREGA, TRIGGER_ETIQUETA } from './nutricion-etapa';
import { TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO } from './nutricion-familias';
import {
  TRIGGER_ETIQUETA_AGREGADA, TRIGGER_ETIQUETA_QUITADA, TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_EMAIL_RECIBIDO, TRIGGER_PAGO, TRIGGER_FORMULARIO,
} from './disparadores';

export type EventoNutricion =
  | 'lead_nuevo' | 'agenda_nueva' | 'etapa' | 'entrega' | 'etiqueta' | 'pago'
  | 'etiqueta_quitada' | 'instagram' | 'messenger' | 'email_recibido' | 'formulario';

// Qué triggers responden a cada evento. Los cohortes siguen siendo la fuente de
// verdad de A QUIÉN le toca: acá solo decidimos QUÉ secuencias mirar ya mismo.
export const TRIGGERS_POR_EVENTO: Record<EventoNutricion, string[]> = {
  lead_nuevo: ['instant_form_sin_agenda', 'vio_vsl_sin_agendar', 'vio_poco_vsl'],
  agenda_nueva: ['agendado_sin_confirmar', TRIGGER_AGENDA_CONOCIDO, TRIGGER_AGENDA_NUEVO],
  // ⚠️ ESTE NO ALCANZA SOLO, y es la diferencia con los dos de arriba: las secuencias de
  // etapa pueden ser muchas y cada una es de UNA etapa y de UN producto. El filtro fino
  // lo hace `secuenciasDeEtapa` en el motor; esta lista sólo acota qué mirar.
  etapa: [TRIGGER_ETAPA],
  // La ENTREGA de un servicio (el kanban de Customer Success). Trigger propio: ver
  // `secuenciasDeEntrega`.
  entrega: [TRIGGER_ENTREGA],
  // Le PUSIERON una etiqueta (08/10/2026, punto 12: «debería también poder salir acciones y
  // CRON desde etiquetas»). Lo dispara el choke point de las etiquetas (lib/etiquetas.ts). Como
  // el de etapa, no alcanza solo: `secuenciasDeEtiqueta` filtra por CUÁL. Y desde la sexta tanda
  // (CRON punto 3) también «Se agrega etiqueta a un lead», con su «Ignorar» (`disparaPorEvento`).
  etiqueta: [TRIGGER_ETIQUETA, TRIGGER_ETIQUETA_AGREGADA],
  // «Se elimina etiqueta a un lead» (CRON punto 3), con su «Ignorar».
  etiqueta_quitada: [TRIGGER_ETIQUETA_QUITADA],
  // Los canales (CRON puntos 6, 7 y 8): los emiten sus webhooks. `disparaPorEvento` pregunta por CUÁL evento.
  instagram: [TRIGGER_INSTAGRAM],
  messenger: [TRIGGER_MESSENGER],
  email_recibido: [TRIGGER_EMAIL_RECIBIDO],
  // Los pagos (Stripe / Mercado Pago, 11/10/2026): los emite el webhook de la pasarela por `enrolarPorPago`
  // (lib/pago-entrante.ts), DESPUÉS de asentar el pago en el CRM. `disparaPorEvento` pregunta por CUÁL evento.
  pago: [TRIGGER_PAGO],
  // «Envió el formulario» (14/11/2026): lo emite el opt-in de una landing (app/api/track/optin). `disparaPorEvento` pregunta por
  // CUÁL formulario (o cualquiera de su landing).
  formulario: [TRIGGER_FORMULARIO],
};

/**
 * CON ESTOS EVENTOS EL MOTOR INSCRIBE TAMBIÉN EN LA ETAPA EFECTIVA DEL LEAD (`conSuEtapa` de `enrolarPorEvento`): la
 * reserva de la R1 (undécima tanda, M1) y el lead nuevo (17/10/2026, #868). El motor lee la etapa de verdad
 * (`etapaDeLaReserva`); la de acá es la que el lead tiene casi siempre en ese momento (`deriveStageKey`, lib/pipeline.ts:
 * «lead» recién entrado, «agenda» con la R1), y es la que usa el aviso de duplicada.
 */
export const ETAPA_DEL_EVENTO: Partial<Record<EventoNutricion, string>> = { lead_nuevo: 'lead', agenda_nueva: 'agenda' };
