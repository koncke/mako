-- =============================================================================
-- 0110 — archivar una secuencia de mensajes en vez de borrarla
-- =============================================================================
-- Hasta ahora el sistema sembraba ~23 secuencias por defecto en cada workspace,
-- y el cron las re-creaba en cada corrida. El dueño abría su Chat Agent y veía
-- dos docenas de secuencias que no habia escrito, con copy [placeholder], sin
-- saber cuales estaban enviando algo. Borrarlas a mano no servia: volvian solas.
--
-- Se corto la siembra (ver lib/secuencias-huecos.ts). Para las que YA existen
-- hace falta poder sacarlas de en medio, y ARCHIVAR es mejor que borrar por dos
-- razones concretas:
--   1. nutricion_inscripciones y nutricion_envios apuntan a la secuencia por FK.
--      Un delete arrastraria el historial de a quien se le escribio.
--   2. Es reversible. Una limpieza que no se puede deshacer no se ofrece.
--
-- Una secuencia archivada no se lista, no enrola y no envia; su etapa vuelve a
-- contar como hueco (que es justo lo que el dueño quiere ver: "esto falta").

alter table nutricion_secuencias
  add column if not exists archivada_at timestamptz;

comment on column nutricion_secuencias.archivada_at is
  'Cuando el dueño la saco de en medio. NULL = vigente. No se borra: las inscripciones y los envios la referencian.';

-- El listado normal filtra por archivada_at is null, y esa es la consulta que
-- corre en cada carga de la tab.
create index if not exists idx_nutricion_secuencias_vigentes
  on nutricion_secuencias (workspace_id)
  where archivada_at is null;
