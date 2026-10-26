-- =============================================================================
-- Migración 0338 (la numeró el Cerebro el 26/10/2026; se aplica con el sí de Martín): grabador_reuniones
-- =============================================================================
-- Pedido de Martín (26/10/2026): «implementa otras integraciones de grabadores de reuniones, como Loom, etc... Así no
-- solo se puede grabar con fathom».
--
-- Las tablas que ya guardan reuniones las guardan por un número (`closing_analyses.recording_id`,
-- `plan_reuniones_descartadas.recording_id`, `curso_progreso.ia_recording_id`, las marcas del Plan en app_settings):
-- el recording_id de Fathom. Para no migrar todo eso, una reunión de otro grabador lleva una clave NEGATIVA derivada de
-- «grabador:id» (lib/grabadores/reunion.ts, `claveDeReunion`); las de Fathom siguen con su número, idénticas.
-- Esta tabla es la vuelta: de la clave al grabador y a su id, para lo que tiene SÓLO el número («Leer igual» de una
-- descartada, «Volver a analizar» en el Closing, la transcripción de una llamada). La escribe UN lugar: la capa de
-- grabadores al listar (lib/grabadores/index.ts, `anotarReuniones`), best-effort.
--
-- ORDEN DE DESPLIEGUE: da igual (aditiva: una tabla nueva, nada se toca). Sin ella todo lo que lee reuniones anda
-- (el cron, el webhook, el modal llevan la ref entera); lo único que no puede es volver a abrir por su número una
-- reunión de un grabador que no es Fathom, y lo dice (`ReunionSinRefError`).
-- Idempotente: se puede correr dos veces.
-- =============================================================================

begin;

create table if not exists grabador_reuniones (
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  -- La clave de MaKo: siempre negativa (las de Fathom no se anotan, su número ya ES su id).
  clave         bigint not null check (clave < 0),
  grabador      text not null check (grabador in ('loom', 'tldv', 'fireflies', 'zoom', 'meet', 'readai', 'otter')),
  -- El id de la reunión en el grabador, tal cual.
  grabacion_id  text not null check (char_length(grabacion_id) between 1 and 200),
  titulo        text not null default '' check (char_length(titulo) <= 300),
  inicio        timestamptz,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, clave),
  unique (workspace_id, grabador, grabacion_id)
);

alter table grabador_reuniones enable row level security;
revoke all on grabador_reuniones from anon, authenticated;

comment on table grabador_reuniones is
  'De la clave numérica de una reunión (negativa) al grabador que la tiene y su id. Las de Fathom no van: su recording_id es la clave. La escribe lib/grabadores/index.ts (anotarReuniones). Por negocio.';

commit;
