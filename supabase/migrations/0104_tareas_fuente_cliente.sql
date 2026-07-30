-- =============================================================================
-- 0104_tareas_fuente_cliente — de dónde salió la tarea, también en el board del cliente
-- =============================================================================
-- El board del super-admin (plan_tareas) ya guarda `fuente` {tipo, etiqueta, url}: es
-- lo que pinta el chip "Fathom · Sync semanal ↗" en el detalle de la tarjeta. El board
-- del cliente (experimento_tareas) no lo tenía, así que una tarea que salió de una
-- reunión llegaba sin rastro de cuál.
--
-- Con esto, la MISMA tarjeta muestra el origen en los dos tableros — y con el minuto
-- exacto en la url (…?timestamp=754), tocarla te lleva a escuchar dónde se dijo.
--
-- Seguro de re-ejecutar.
-- =============================================================================

begin;

alter table experimento_tareas add column if not exists fuente jsonb;

comment on column experimento_tareas.fuente is 'De dónde salió: {tipo, etiqueta, url}. url puede llevar ?timestamp=<seg> para abrir la grabación en el momento exacto en que se dijo.';

commit;

notify pgrst, 'reload schema';
