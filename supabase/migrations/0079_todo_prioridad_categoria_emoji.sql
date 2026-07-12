-- =============================================================================
-- 0079_todo_prioridad_categoria_emoji — paridad del board /todo con PlanBoard
-- =============================================================================
-- Para que el board del cliente sea idéntico al del super-admin:
--   • experimento_tareas.en_prioridad (bool) — el flag "En prioridad" (la vista
--     Prioridades muestra hasta 3 tareas marcadas). Reemplaza al viejo "foco".
--   • tarea_categorias.emoji (text) — las etiquetas ahora tienen emoji editable
--     (como los "proyectos" del PlanBoard), elegible con un picker.
-- Ambas por-workspace vía getTenantDb; acá solo agregamos columnas.
-- =============================================================================

begin;

alter table experimento_tareas
  add column if not exists en_prioridad boolean not null default false;

alter table tarea_categorias
  add column if not exists emoji text not null default '🏷';

comment on column experimento_tareas.en_prioridad is
  'Marcada "En prioridad" (vista Prioridades del board /todo, máx 3).';
comment on column tarea_categorias.emoji is
  'Emoji de la etiqueta/proyecto (board /todo).';

commit;
