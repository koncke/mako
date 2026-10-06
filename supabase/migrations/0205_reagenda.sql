-- =============================================================================
-- 0205_reagenda — la reunión que prepara cada inscripción (#789)
-- =============================================================================
-- Proyecto «Feature: Chatbot» del plan (06/10/2026), tarea #789.
--
-- `nutricion_inscripciones` tiene `unique (lead_id, secuencia_id)` (mig 0034): un lead entra
-- UNA vez en la vida a cada secuencia. En la post-agenda eso dejaba afuera para siempre a
-- quien vuelve a agendar. Decisión de Martín (06/10/2026): «b: también con reunión nueva» —
-- la post-agenda le vuelve a salir si la vez anterior no le llegó nada, Y TAMBIÉN si ya le
-- llegó pero es una reunión NUEVA. La fila vieja no se vuelve a insertar: se REUSA
-- (lib/nutricion-reinscripcion.ts → `reactivarInscripcion`).
--
-- Para saber si la reunión de hoy es «nueva» hace falta saber cuál preparaba la inscripción,
-- y eso no estaba en ningún lado: `leads.fecha_junta_1` se PISA cuando el lead reprograma.
--
--  · `reunion_at` — la reunión que esta inscripción prepara. Se escribe al inscribir y al
--    reactivar, y se re-anota en cada paso que el motor procesa (si el lead reprogramó a mitad
--    de la corrida, los pasos que siguen ya hablan de la nueva). Sólo en la familia que prepara
--    una reunión (`preparaUnaReunion`, lib/nutricion-familias.ts). NULL = NO SE SABE (las filas
--    de antes de esta migración, o una que se inscribió con la reunión ya pasada), y la regla
--    del reuso lo lee así: «no sé cuál era» no autoriza a afirmar que era otra.
--
-- SIN BACKFILL, a propósito: la reunión que preparaba cada fila vieja no se puede reconstruir
-- (justamente porque `fecha_junta_1` se pisa), y un backfill desde la agenda de HOY le pondría
-- a cada fila la reunión nueva — o sea que el reuso nunca vería una reunión distinta. Y no hace
-- falta: medido el 06/10/2026 en producción, de las 65 inscripciones del producto ninguna tiene
-- un envío 'enviado' (los 12 envíos de toda la tabla están en 'fallo') ni un borrador colgado,
-- así que todas caen en la regla de «no le llegó nada», que no necesita la columna.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. El código nuevo LEE y ESCRIBE esta columna en la
-- familia que prepara una reunión (el `select` de las inscripciones, el insert, la
-- reactivación y el avance de cada paso), y PostgREST rechaza la consulta ENTERA si una
-- columna no existe: sin la migración puesta, la post-agenda no inscribe a nadie y el cron de
-- nutrición falla en cada corrida. Las demás secuencias no la piden y siguen andando, y la
-- re-anotación de cada paso va en un update APARTE del avance, para que el avance de un paso
-- que ya salió no se pierda (y el paso no se vuelva a mandar). Eso es la red, no el plan.
-- =============================================================================

begin;

alter table nutricion_inscripciones
  add column if not exists reunion_at timestamptz;

comment on column nutricion_inscripciones.reunion_at is
  'La reunión que prepara esta inscripción (sólo la familia que prepara una: lib/nutricion-familias.ts → preparaUnaReunion). NULL = no se sabe. Decide si una agenda posterior es una reunión NUEVA y la inscripción se reusa (lib/nutricion-reinscripcion.ts, #789).';

commit;
