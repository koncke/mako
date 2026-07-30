-- =============================================================================
-- 0105_propuestas_aplicadas — el borrador SOBREVIVE a cargar tus tareas
-- =============================================================================
-- Hasta acá, confirmar un borrador de reunión lo marcaba 'aplicada' entero y
-- desaparecía. Problema: de la misma reunión salen compromisos de OTRAS personas,
-- que no entran a tu plan y se reparten aparte (mandárselos, o dejárselos en su
-- plan). Si todavía no hiciste nada con ellos cuando cargaste los tuyos, se
-- perdían: el modal ya no se podía abrir y esas tareas no existían en ningún lado.
--
-- Ahora el borrador queda PENDIENTE mientras le quede algo de otros, y guarda acá
-- las que ya se crearon: título + id de la tarea. Con eso el mismo modal muestra
-- "ya cargaste estas" con un link que abre la tarjeta real en el board.
--
-- Seguro de re-ejecutar.
-- =============================================================================

begin;

alter table plan_propuestas add column if not exists aplicadas jsonb not null default '[]'::jsonb;

comment on column plan_propuestas.aplicadas is 'Tareas de este borrador que YA se crearon: [{titulo, tareaId, minutos}]. Sirve para volver a abrirlo (por las de otras personas) sin ofrecer de nuevo lo ya cargado, y para linkear a la tarjeta real.';

commit;

notify pgrst, 'reload schema';
