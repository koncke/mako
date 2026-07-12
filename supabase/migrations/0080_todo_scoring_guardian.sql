-- =============================================================================
-- 0080_todo_scoring_guardian — puntuación del MaKo Perro Guardián
-- =============================================================================
-- MaKo dueño de la priorización: score 1-100 por TAREA (define la columna
-- Alta/Media/Baja/A futuro por rangos y ordena adentro) y 1-5 por PROYECTO
-- (categoría). El usuario no fija estos números: los asigna/razona el guardián.
--   • experimento_tareas.score    (int 0-100)
--   • tarea_categorias.prioridad  (int 1-5) — 5 = Objetivo Principal
-- Por-workspace vía getTenantDb; acá solo agregamos columnas.
-- =============================================================================

begin;

alter table experimento_tareas
  add column if not exists score integer not null default 0;

alter table tarea_categorias
  add column if not exists prioridad integer not null default 3;

comment on column experimento_tareas.score is
  'Score 1-100 del guardián: define la columna (rangos) y el orden. 0 = sin puntuar.';
comment on column tarea_categorias.prioridad is
  'Prioridad 1-5 del proyecto (guardián). El más alto = Objetivo Principal.';

commit;
