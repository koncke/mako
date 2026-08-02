-- =============================================================================
-- 0112 — desenlace de una inscripcion: se logro o no
-- =============================================================================
-- Hasta ahora una secuencia no sabia parar: mandaba pasos hasta quedarse sin
-- pasos y ahi la inscripcion pasaba a 'completada'. Pero "completada" solo dice
-- que se terminaron los mensajes, no si SIRVIO — y sin eso dos cosas eran
-- imposibles:
--   1. Saber si una secuencia funciona. No habia con que medirla.
--   2. Encadenar. "Reactivacion" y "seguimiento" son trabajos distintos que
--      empiezan donde termina el anterior; sin un desenlace no hay donde.
--
-- `ultimo_paso_at` existe porque el reloj del fallo se cuenta desde el ULTIMO
-- mensaje enviado, no desde que el lead se inscribio: una secuencia con pasos a
-- los 30 dias se daria por fallida antes de terminar de mandarlos.

alter table nutricion_inscripciones
  add column if not exists desenlace text,
  add column if not exists desenlace_at timestamptz,
  add column if not exists ultimo_paso_at timestamptz;

comment on column nutricion_inscripciones.desenlace is
  'logrado | fallo | cancelado. NULL = todavia corriendo. Lo escribe el evaluador del cron o el cierre por respuesta.';
comment on column nutricion_inscripciones.ultimo_paso_at is
  'Cuando salio el ultimo mensaje. Es el reloj del fallo por silencio: se cuenta desde aca, no desde la inscripcion.';

-- La consulta del evaluador: inscripciones sin desenlace que ya mandaron algo.
create index if not exists idx_nutri_insc_sin_desenlace
  on nutricion_inscripciones (workspace_id, ultimo_paso_at)
  where desenlace is null;
