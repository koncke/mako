-- =============================================================================
-- 0078_todo_checklist_historial — checklist + historial de cambios en el To-do
-- =============================================================================
-- El tablero /todo (experimento_tareas) suma, para llevar el board del cliente a
-- la paridad con el de planificación (PlanBoard):
--   • checklist (jsonb) — array de ítems {id,text,done} por tarjeta
--   • historial (jsonb) — "change history": array de {ts,actor,text} donde
--     actor = 'user' | 'ia' (distingue si el cambio lo hizo el usuario o MaKo).
-- La tabla ya es por-workspace (getTenantDb la scopea); acá solo agregamos columnas.
-- =============================================================================

begin;

alter table experimento_tareas
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists historial jsonb not null default '[]'::jsonb;

comment on column experimento_tareas.checklist is
  'Ítems de checklist [{id,text,done}] de la tarjeta (board /todo).';
comment on column experimento_tareas.historial is
  'Change history [{ts,actor,text}] con actor user|ia (usuario vs MaKo).';

commit;
