-- =============================================================================
-- 0398_actividad_uso — Admin › Activity: qué pantallas abre cada persona y qué hace MaKo por ella (5/11/2026)
-- =============================================================================
-- Martín (13/10/2026): «Yo como SuperAdmin quiero tener registro de todas las acciones que hace un usuario». Y el 5/11: «qué
-- acciones hacen los usuarios dentro de MaKo, cuándo es que se conectan, qué no están utilizando, qué se están utilizando».
-- Hasta hoy sólo existía `usuarios.ultimo_login`. Copiado de PostHog (eventos por persona y por empresa), con dos tablas:
--
--   · `actividad_uso`: CONTADORES, una fila por persona, por tab y por día (cuántas pantallas abrió y cuántas acciones hizo
--     tocando la app). No crece con el uso sino con la gente: unas decenas de filas por día. La escribe `sumar_actividad`
--     (atómica: dos lotes a la vez no se pisan). Retención: 400 días (el cron `actividad-purga`).
--   · `actividad_acciones`: lo que hizo MaKo por cada persona (cada operación de la API de MaKo: el chat de la app, WhatsApp,
--     un flujo, HTTP), con su id, su área, el canal y si salió bien. Retención: 90 días.
--
-- ⚠️ SIN CONTENIDO: ni el texto de un lead, ni un mensaje, ni los parámetros de una operación. Qué se hizo, no qué decía. Un
--    borrado no guarda la foto de lo borrado acá (eso es la papelera, mig 0340): esto es uso, no auditoría.
-- ⚠️ El super admin global NO se mide (lib/actividad.ts): su uso no es de ningún negocio y, mirando a un cliente, ensuciaría
--    el del cliente.
--
-- EN PALABRAS: agrega dos tablas nuevas y una función que suma. No toca ninguna tabla que exista.
-- ORDEN: ANTES del deploy. Sin las tablas, `registrarActividad` falla en silencio (nunca rompe lo que la persona hacía) y
-- Admin › Activity dice que todavía no hay datos. ⚠️ EL NÚMERO SE CONFIRMA AL APLICAR: barrido el 5/11/2026 (main llega a
-- 0394; hay una 0396 en punta/codigo-primer-contacto y una 0397 propuesta para los recibos).
-- =============================================================================

create table if not exists actividad_uso (
  dia           date        not null,
  usuario_id    bigint      not null references usuarios(id) on delete cascade,
  workspace_id  bigint      references workspaces(id) on delete cascade,
  -- La key de la tab de la barra (app/_components/nav.ts), o 'otra'. Nunca la URL: puede traer ids.
  tab           text        not null check (char_length(tab) between 1 and 60),
  pantallas     integer     not null default 0 check (pantallas >= 0),
  acciones      integer     not null default 0 check (acciones >= 0),
  primera       timestamptz not null default now(),
  ultima        timestamptz not null default now(),
  primary key (dia, usuario_id, tab)
);

comment on table actividad_uso is 'Uso de la app por persona, tab y día (mig 0398, lib/actividad.ts): contadores, sin contenido. Retención 400 días.';

create index if not exists actividad_uso_ws_dia_idx on actividad_uso (workspace_id, dia desc);
create index if not exists actividad_uso_dia_idx on actividad_uso (dia desc);

alter table actividad_uso enable row level security;
revoke all on actividad_uso from anon, authenticated;

create table if not exists actividad_acciones (
  id            bigint generated always as identity primary key,
  creado        timestamptz not null default now(),
  usuario_id    bigint      references usuarios(id) on delete set null,
  workspace_id  bigint      references workspaces(id) on delete cascade,
  -- El id de la operación de la API de MaKo (lib/api-mako/registro.ts) y su área.
  operacion     text        not null check (char_length(operacion) between 1 and 80),
  area          text        check (area is null or char_length(area) <= 40),
  canal         text        not null check (char_length(canal) between 1 and 20),
  tipo          text        not null check (tipo in ('lectura', 'accion', 'control')),
  ok            boolean     not null
);

comment on table actividad_acciones is 'Lo que hizo MaKo por cada persona (mig 0398, lib/actividad.ts): la operación, el canal y si salió. Sin parámetros. Retención 90 días.';

create index if not exists actividad_acciones_creado_idx on actividad_acciones (creado desc);
create index if not exists actividad_acciones_ws_idx on actividad_acciones (workspace_id, creado desc);

alter table actividad_acciones enable row level security;
revoke all on actividad_acciones from anon, authenticated;

-- Suma un lote a los contadores del día, sin pisar otro lote que llegue a la vez.
create or replace function sumar_actividad(p_dia date, p_usuario bigint, p_ws bigint, p_tab text, p_pantallas integer, p_acciones integer)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into actividad_uso (dia, usuario_id, workspace_id, tab, pantallas, acciones, primera, ultima)
  values (p_dia, p_usuario, p_ws, p_tab, greatest(coalesce(p_pantallas, 0), 0), greatest(coalesce(p_acciones, 0), 0), now(), now())
  on conflict (dia, usuario_id, tab) do update set
    pantallas    = actividad_uso.pantallas + excluded.pantallas,
    acciones     = actividad_uso.acciones + excluded.acciones,
    workspace_id = coalesce(excluded.workspace_id, actividad_uso.workspace_id),
    ultima       = now();
$$;

revoke all on function sumar_actividad(date, bigint, bigint, text, integer, integer) from public, anon, authenticated;
grant execute on function sumar_actividad(date, bigint, bigint, text, integer, integer) to service_role;
