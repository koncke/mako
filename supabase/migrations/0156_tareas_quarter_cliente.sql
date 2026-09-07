-- =============================================================================
-- 0156 — el Quarter también en el tablero del CLIENTE
-- =============================================================================
-- La 0155 le puso `quarter` a `plan_tareas`, que es el board del super-admin. Este
-- repo tiene DOS tableros que renderiza el mismo `<BoardShell>`: aquél y
-- `experimento_tareas`, que es el de cada cliente.
--
-- ⚠️ AGREGARLO EN UNO SOLO ES EXACTAMENTE LA REGLA QUE ESTE REPO YA PAGÓ: «nunca
-- owner-only, todo workspace-aware». Un filtro por Quarter que funciona en el
-- tablero del dueño y no en el de sus clientes no es media feature — es una feature
-- que se ve en las demos y no existe en el producto.
--
-- Mismo formato que en la 0155: texto `2026-Q3`, porque un «Q3» sin año es ambiguo
-- apenas cruza diciembre. NULL = sin asignar, que es un estado legítimo.
--
-- ⚠️ Y NO SE BACKFILLEA DESDE `deadline`. Una tarea con fecha para marzo no es una
-- tarea que alguien haya PLANIFICADO para el Q1: derivar el plan de una fecha que
-- puso otra cosa —el Perro, un import, una reunión— es inventar una decisión que
-- nadie tomó, y después nadie puede distinguir la inventada de la real.
-- =============================================================================

begin;

alter table experimento_tareas add column if not exists quarter text;

comment on column experimento_tareas.quarter is 'Quarter planificado, formato `2026-Q3`. null = sin asignar. NO se deriva del deadline (mig 0156).';

commit;

notify pgrst, 'reload schema';
