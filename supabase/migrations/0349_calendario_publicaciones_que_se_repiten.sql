-- =============================================================================
-- 0349_calendario_publicaciones_que_se_repiten — una Publicación del Calendario que se repite (29/10/2026)
-- =============================================================================
-- Martín, en la llamada con Thiago (29/10, [19:25]): «podés programarte publicaciones recurrentes». Una Publicación con su
-- red, su cuenta, su archivo y su texto se marca «Se repite» con una regla (la MISMA RRULE del Plan, lib/plan-recurrentes.ts),
-- y el cron (/api/cron/calendario-recurrentes) le crea cada vez una Publicación igual, con la misma hora, y la programa en la
-- red por Zernio. La de la regla es el «molde» y la primera vez.
--
--   · `repetir`   — la regla (RRULE). Sólo en una Publicación: una llamada o un bloque no se programan en una red.
--   · `serie_de`  — en cada Publicación que nace de una regla, el id del molde. Con su `inicio`, único: dos pasadas del cron a la
--                   vez no crean la misma vez dos veces (la segunda choca acá y no se programa). Una vez NO lleva regla: «Repetir»
--                   en una vez armaba una segunda serie, dos posts por día (revisión de privacidad, 29/10, A2).
--   · `repetir_hasta` — en el molde, el último día de la serie que el cron ya atendió (nació, o su hora ya había pasado). Nunca
--                   se crea un día anterior: sin esto, las veces se contaban por las filas que EXISTEN, y borrar o mover una la
--                   hacía renacer y se programaba sola (A1).
--
-- Sólo agrega: ninguna fila cambia y nada que hoy anda deja de andar. Idempotente.
-- =============================================================================

alter table calendario_eventos add column if not exists repetir text;
alter table calendario_eventos add column if not exists serie_de text;
alter table calendario_eventos add column if not exists repetir_hasta date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_repetir_ok') then
    alter table calendario_eventos add constraint calendario_eventos_repetir_ok
      check (repetir is null or (tipo = 'publicacion' and char_length(repetir) between 1 and 200));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_serie_de_ok') then
    alter table calendario_eventos add constraint calendario_eventos_serie_de_ok
      check (serie_de is null or char_length(serie_de) between 1 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'calendario_eventos_vez_sin_regla') then
    alter table calendario_eventos add constraint calendario_eventos_vez_sin_regla
      check (repetir is null or serie_de is null);
  end if;
end $$;

create unique index if not exists calendario_eventos_serie_vez_uidx
  on calendario_eventos (workspace_id, serie_de, inicio) where serie_de is not null;
create index if not exists calendario_eventos_repetir_idx
  on calendario_eventos (workspace_id) where repetir is not null;

comment on column calendario_eventos.repetir is
  'La regla de una Publicación que se repite (RRULE, lib/plan-recurrentes.ts). El cron le crea cada vez una igual y la programa (mig 0349).';
comment on column calendario_eventos.serie_de is
  'En una Publicación que nació de una regla: el id de la Publicación con la regla (mig 0349).';
comment on column calendario_eventos.repetir_hasta is
  'En el molde: el último día de la serie que el cron ya atendió. Borrar o mover una vez no la hace renacer (mig 0349).';
