-- =============================================================================
-- 0095_plan_propuestas_eliminar — MaKo también propone ELIMINAR/fusionar obsoletas
-- =============================================================================
-- En el mismo borrador (mig 0094), MaKo puede sugerir borrar tareas del plan que la
-- lista nueva deja obsoletas o que ya están duplicadas, con su motivo. El dueño/cliente
-- las confirma con checkbox en /plan/revisar. Guardamos la lista acá.
-- Forma: [{ id, titulo, motivo }] — `id` = id real de la tarea (de ver_plan).

begin;

alter table plan_propuestas add column if not exists eliminar jsonb not null default '[]'::jsonb;

commit;

notify pgrst, 'reload schema';
