-- =============================================================================
-- 0101_propuestas_reunion — el borrador de tareas ahora también VIAJA entre personas
-- =============================================================================
-- Dos cosas nuevas sobre plan_propuestas (mig 0094):
--
-- 1) MaKo detecta SOLA una reunión de equipo nueva en Fathom, saca los compromisos
--    y deja el borrador PENDIENTE. No crea nada: la próxima vez que la persona entra
--    a su plan le salta el modal para confirmarlas. Para no re-procesar la misma
--    grabación en cada corrida del cron, guardamos su `ref` (fathom:<recording_id>)
--    con un índice único por workspace.
--
-- 2) De una reunión salen tareas de OTRA persona. Si esa persona tiene cuenta en la
--    app, el borrador se crea EN SU workspace y ella ve "Martín te envió estas
--    tareas de la reunión del 28/7". Para eso hace falta saber QUIÉN lo mandó
--    (`enviado_por`) y de qué reunión salió (`fuente_titulo` / `fuente_url`).
--
-- Seguro de re-ejecutar.
-- =============================================================================

begin;

alter table plan_propuestas add column if not exists ref           text;
alter table plan_propuestas add column if not exists enviado_por   text;
alter table plan_propuestas add column if not exists fuente_titulo text;
alter table plan_propuestas add column if not exists fuente_url    text;

comment on column plan_propuestas.ref is 'Clave del hecho que generó el borrador (ej. fathom:12345). Sirve de candado anti-duplicado del cron.';
comment on column plan_propuestas.enviado_por is 'Nombre de la persona que le mandó estas tareas (vacío = las generó MaKo sola).';

-- Candado: una misma grabación deja UN solo borrador por workspace (aunque el cron
-- corra cada hora o se re-dispare el webhook). Parcial: las propuestas sin ref
-- (WhatsApp, Claude Code) no se ven afectadas.
create unique index if not exists ux_plan_propuestas_ref
  on plan_propuestas (workspace_id, ref) where ref is not null;

commit;

notify pgrst, 'reload schema';
