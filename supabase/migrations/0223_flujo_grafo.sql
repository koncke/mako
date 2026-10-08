-- =============================================================================
-- 0223_flujo_grafo — una secuencia del chatbot como FLUJO CON RAMAS (08/10/2026)
-- =============================================================================
-- Pedido de Martín (08/10/2026, punto 9): «Yo debería poder crear CONDICIONALES... hoy en día
-- no es un flujo, es solamente una secuencia lineal». El modelo vive en lib/flujo-grafo.ts y
-- el contrato entre las partes en docs/chatbot-flujo-ramas-diseno.md.
--
-- EL DATO SIGUE SIENDO `nutricion_secuencias.pasos`: cada elemento es un NODO, con un `id`
-- estable y su `siguiente`. Lo que suma esta migración es dónde está cada lead y qué salió:
--
--  · `nutricion_inscripciones.nodo_actual` — el `id` del nodo en el que está la inscripción.
--    `paso_actual` es un ÍNDICE del array y con ramas deja de decir algo: insertar una tarjeta
--    en el medio le mandaba a un lead el paso de OTRO. NULL = una fila de antes: el motor cae a
--    `pasos[paso_actual]`, que es exactamente lo que leía hasta hoy. `paso_actual` se sigue
--    escribiendo (= el índice del nodo): lo leen las estadísticas y el residuo.
--  · `nutricion_envios.nodo_id` — qué nodo dejó esa fila. `paso` (int) se queda: lo agrupan las
--    estadísticas por paso de /email y el resumen de envíos.
--  · `nutricion_secuencias.etiqueta_id` — el disparador «le pusieron la etiqueta X»
--    (`trigger_tipo = 'etiqueta_puesta'`). SIN FK a propósito: la tabla de etiquetas
--    (`crm_etiquetas`) la crea la 0224, que escribe otra parte del rediseño en paralelo, y una
--    FK acá ataría el orden de las dos. La validación vive en el código que guarda el
--    disparador (lib/setting-secuencias.ts → `setTriggerSecuencia`), que lee la etiqueta en ESTE
--    workspace. El índice es parcial: casi ninguna secuencia la tiene.
--  · `wa_borradores.audio_id` y `adjunto_id` — un borrador de un paso de NOTA DE VOZ o de
--    ARCHIVO guarda la referencia a la biblioteca (`setting_audios` / `setting_adjuntos`, la
--    0225). Sin esto, el borrador de un audio guardaba el texto «🎙 Nota de voz: …» y, al
--    aprobarlo, al lead le llegaba ESE texto en vez del audio. Por referencia y nunca el
--    binario (AGENTS.md: «un adjunto va por referencia»).
--
-- SIN BACKFILL: medido el 08/10/2026, 0 inscripciones activas en toda la base. Las filas de
-- antes quedan con `nodo_actual` NULL y el motor las lee como siempre.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY. El código nuevo LEE `nodo_actual` en la cola del
-- motor (`procesarEnvios`), `etiqueta_id` en TODA lectura de secuencias y `audio_id`/
-- `adjunto_id` al mandar un borrador, y PostgREST rechaza la consulta ENTERA si una columna no
-- existe. Con el deploy adelantado, el cron de nutrición falla en cada corrida ANTES de
-- mandar nada (falla cerrado: no se duplica ningún mensaje), la pantalla de /chatbot no carga
-- y los borradores no salen. Nada se pierde, pero nada anda hasta aplicarla.
-- =============================================================================

begin;

alter table nutricion_inscripciones
  add column if not exists nodo_actual text;

comment on column nutricion_inscripciones.nodo_actual is
  'El id del nodo (pasos[].id) en el que está la inscripción. NULL = fila de antes del flujo con ramas: el motor usa pasos[paso_actual]. Se escribe siempre junto con paso_actual (= el índice del nodo).';

alter table nutricion_envios
  add column if not exists nodo_id text;

comment on column nutricion_envios.nodo_id is
  'Qué nodo de la secuencia (pasos[].id) dejó esta fila. `paso` (int) se conserva: lo agrupan las estadísticas por paso.';

alter table nutricion_secuencias
  add column if not exists etiqueta_id bigint;

comment on column nutricion_secuencias.etiqueta_id is
  'Sólo con trigger_tipo = ''etiqueta_puesta'': la etiqueta (crm_etiquetas.id, mig 0224) que dispara la secuencia. Sin FK: la valida setTriggerSecuencia (lib/setting-secuencias.ts).';

create index if not exists nutricion_secuencias_etiqueta_idx
  on nutricion_secuencias (workspace_id, etiqueta_id)
  where etiqueta_id is not null;

alter table wa_borradores
  add column if not exists audio_id bigint,
  add column if not exists adjunto_id bigint;

comment on column wa_borradores.audio_id is
  'El borrador es una NOTA DE VOZ de la biblioteca (setting_audios.id): al aprobarlo sale el audio, no el texto.';
comment on column wa_borradores.adjunto_id is
  'El borrador es un ARCHIVO de la biblioteca (setting_adjuntos.id, mig 0225): al aprobarlo sale el archivo con el texto como pie.';

commit;
