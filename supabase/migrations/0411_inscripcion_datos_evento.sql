-- =============================================================================
-- 0411 — Los datos del evento viajan en la inscripción (el CRON «Pagos» cita el monto)
-- =============================================================================
-- 6/11/2026, el pendiente 288 («Le Rechazaron el Pago»). Una tarjeta «MaKo en WhatsApp» de una
-- automatización cuyo CRON es «Pagos» no podía CITAR el monto ni el concepto del pago:
-- `{{pago_monto}}` tiene `alcance: 'pago'` (lib/variables-aviso.ts) y `alcanzaPara` lo da sólo con
-- `conPago`, que ponía únicamente el Evento de MaKo `pago_recibido` — su emisor los pasa en `datos`.
-- La otra puerta, `enrolarPorPago` (lib/pago-entrante.ts), mandaba `{ subtipo }` y nada más. El equipo
-- se enteraba de un pago rechazado sin saber de cuánto era.
--
-- Acá viven los datos que trajo el EVENTO que inscribió a ese lead, ya escritos (`valoresDelPago`:
-- «US$ 2.300», «Mentoría 1:1»). El motor los pone en el texto de la tarjeta cuando la manda.
--
-- ⚠️ POR QUÉ SE GUARDAN Y NO SE RELEEN AL MANDAR. Un pago rechazado NO deja fila en `pagos`
-- (lib/cobros.ts, `aplicarPagoFallido` sólo escribe `cobros.motivo`), así que no hay nada que releer; y
-- releer «el último pago del lead» diría el monto de otro pago —el que entró después, el que salió
-- bien— justo en el aviso que sale a cobrar. Lo que se cita es lo que la pasarela confirmó cuando
-- disparó el CRON, congelado en la inscripción.
--
-- ⚠️ VA ANTES DEL DEPLOY, como la 0228. El motor lee esta columna en el `select` de la cola
-- (lib/nutricion.ts, `procesarEnvios`): sin ella PostgREST rechaza la consulta ENTERA y no sale ningún
-- mensaje de ninguna automatización de ningún negocio.
--
-- ⚠️ Y UNA FILA REUSADA LA REESCRIBE (`camposDeReactivacion`, lib/nutricion-reinscripcion.ts): una
-- inscripción que vuelve a correr es una corrida NUEVA con el id viejo, y con los datos de antes puestos
-- el aviso de la renovación rechazada de marzo diría el monto de la de febrero.
-- =============================================================================

begin;

alter table nutricion_inscripciones
  add column if not exists datos_evento jsonb;

comment on column nutricion_inscripciones.datos_evento is
  'Los datos que trajo el evento que inscribió al lead, ya escritos y listos para citar ({"pago_monto": "US$ 2.300", "pago_concepto": "Mentoría 1:1"}). Los pone enrolarPorEvento desde CtxEvento.datos (hoy sólo el CRON «Pagos», lib/pago-entrante.ts) y el motor los pasa al texto de la tarjeta. NULL = el evento no trajo nada: sus tokens quedan crudos, y Publicar los frena antes (problemasDeTokens).';

commit;
