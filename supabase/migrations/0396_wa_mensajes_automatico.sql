-- =============================================================================
-- 0396_wa_mensajes_automatico — quién mandó un WhatsApp saliente: una automatización o una persona
-- =============================================================================
-- Para el «tiempo hasta el primer contacto» (lib/primer-contacto.ts) que Martín le prometió a Código Inmobiliario
-- el 30/10/2026. `wa_mensajes` no sabía quién escribió un saliente (lo dice lib/cs-contacto.ts: «el camino es marcar los
-- envíos automáticos en la base, una columna que pongan los emisores automáticos, no adivinarlos»). Ésta es esa columna:
--
--  · `true`  = lo mandó una automatización (la nutrición, los recordatorios, el curso…): lo marca quien lo manda
--              (`enviarYEspejar` y sus hermanas con `quien: 'automatico'`, lib/evolution-envio.ts), con un UPDATE por el id
--              del mensaje DESPUÉS de mandar, así sobrevive al eco del webhook aunque llegue antes;
--  · `false` = lo escribió una persona (desde el teléfono, desde Chats o aprobando un borrador): el DEFAULT de toda fila nueva;
--  · `null`  = NO SE SABE: toda fila que ya existía. Sin backfill A PROPÓSITO: de los salientes viejos no hay de dónde saber
--              quién los mandó, y ponerles `false` diría que los escribió una persona. La métrica dice «No se sabe».
--
-- ⚠️ ORDEN DE DESPLIEGUE: DESPUÉS del deploy (al revés que una columna que el código lee para abrir). El código nuevo la
-- tolera ausente: la marca es un UPDATE aparte que ignora «la columna no existe», y el lector, sin la columna, dice «No se
-- sabe». Si se aplicara ANTES, entre la migración y el deploy la versión vieja mandaría automáticos sin marcarlos y quedarían
-- en `false` (escritos por una persona) con el default: justo lo que no se puede reescribir. Aplicarla después deja ese
-- hueco en cero.
--
-- Número elegido desde una sesión en la nube sin el Cerebro (5/11/2026): al aplicarla, comprobar que nadie más tomó la 0396.
-- Idempotente.
-- =============================================================================

begin;

alter table wa_mensajes add column if not exists automatico boolean;
-- El default va APARTE del add: con `add column … default false` Postgres llena las filas que ya existen con false.
alter table wa_mensajes alter column automatico set default false;

comment on column wa_mensajes.automatico is
  'Saliente: true = lo mandó una automatización (lo marca el emisor), false = una persona (default de las filas nuevas), null = no se sabe (filas de antes de la 0396).';

commit;
