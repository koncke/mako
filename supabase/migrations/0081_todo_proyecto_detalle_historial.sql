-- =============================================================================
-- 0081_todo_proyecto_detalle_historial — proyectos como entidad de primera clase
-- =============================================================================
-- Los proyectos (tarea_categorias) del board /todo pasan a tener, como las
-- tareas: un detalle y su propio change history. (La prioridad ya existe; ahora
-- se usa 1-10 en vez de 1-5, mismo tipo int, sin cambio de esquema.)
--   • tarea_categorias.detalle   (text)
--   • tarea_categorias.historial (jsonb) — {ts,actor,text} con actor user|ia
-- Por-workspace vía getTenantDb; acá solo agregamos columnas.
-- =============================================================================

begin;

alter table tarea_categorias
  add column if not exists detalle   text not null default '',
  add column if not exists historial jsonb not null default '[]'::jsonb;

comment on column tarea_categorias.detalle is 'Detalle/descripción del proyecto (board /todo).';
comment on column tarea_categorias.historial is 'Change history del proyecto [{ts,actor,text}] (board /todo).';

commit;
