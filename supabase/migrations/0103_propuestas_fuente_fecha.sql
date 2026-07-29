-- =============================================================================
-- 0103_propuestas_fuente_fecha — CUÁNDO fue la reunión (no cuándo corrió el cron)
-- =============================================================================
-- El borrador ya sabía de qué reunión salió (fuente_titulo/fuente_url, mig 0101),
-- pero no CUÁNDO ocurrió: la pantalla mostraba created_at, que es la hora a la que
-- el cron la leyó. Con dos reuniones del mismo día eso no distingue nada, y el
-- WhatsApp no podía decir "reunión del miércoles 15:30".
--
-- Seguro de re-ejecutar.
-- =============================================================================

begin;

alter table plan_propuestas add column if not exists fuente_fecha timestamptz;

comment on column plan_propuestas.fuente_fecha is 'Inicio REAL de la reunión de la que salió el borrador (recording_start_time de Fathom). Distinto de created_at, que es cuándo lo leyó MaKo.';

commit;

notify pgrst, 'reload schema';
