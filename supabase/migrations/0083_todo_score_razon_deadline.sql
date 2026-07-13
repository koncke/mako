-- =============================================================================
-- 0083_todo_score_razon_deadline — paridad de campos board super-admin ↔ cliente
-- =============================================================================
-- El board del super-admin (localStorage) guarda el "por qué" del score que puso
-- el guardián y el deadline de cada PROYECTO; el board del cliente (DB) los perdía
-- (eran in-memory, se recomputaban por sesión). Agregamos las columnas para que
-- AMBOS boards persistan exactamente los mismos campos.
--   • experimento_tareas.score_razon (text)  — por qué el guardián dio ese score a la TAREA
--   • tarea_categorias.score_razon  (text)   — idem para el PROYECTO
--   • tarea_categorias.deadline     (date)   — deadline del proyecto
-- Por-workspace vía getTenantDb; acá solo agregamos columnas.
-- =============================================================================

begin;

alter table experimento_tareas
  add column if not exists score_razon text;

alter table tarea_categorias
  add column if not exists score_razon text,
  add column if not exists deadline    date;

comment on column experimento_tareas.score_razon is 'Por qué el guardián le puso ese score a la tarea (board /plan).';
comment on column tarea_categorias.score_razon is 'Por qué el guardián le puso esa prioridad al proyecto (board /plan).';
comment on column tarea_categorias.deadline is 'Deadline del proyecto (board /plan), YYYY-MM-DD.';

commit;
