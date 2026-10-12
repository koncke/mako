-- =============================================================================
-- 0250 — notificaciones CON workspace_id: el feed de «Avisos» del Inbox de MaKo Mobile
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae el lib/notificaciones.ts nuevo (el que
-- escribe `workspace_id`). Con la versión vieja desplegada, su insert SIN workspace_id choca contra el
-- NOT NULL y no escribe nada — que es exactamente lo que pasaba hasta hoy (la tabla no existía) y es lo
-- que tiene que pasar: una fila sin dueño es una fila que la campanita vieja le mostraría a todos.
--
-- La 0048 definió este feed SIN workspace_id y nunca se aplicó en producción (medido el 11/10/2026:
-- information_schema no la tenía; `crearNotificacion` escribía al vacío). Aplicada tal cual, cada
-- cliente habría visto los avisos de todos (docs/hallazgos-infra.md). Esta la reemplaza: el mismo
-- esquema + `workspace_id NOT NULL` SIN default — un escritor que se olvide el workspace tiene que
-- fallar, no caer en el ws1 (que es un CLIENTE).
--
-- El LEÍDO ya no es `leido` (un booleano por fila, compartido por todo el equipo): es por PERSONA, con
-- una marca de agua en `usuarios.perfil.notifVistoHasta` (lib/perfil.ts). `leido`, `leido_at` y
-- `canal_wa` quedan por compatibilidad con la 0048 y no los lee nadie.
--
-- ⚠️ Y VA A `TENANT_TABLES` (lib/workspace.ts) Y A `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts).
-- =============================================================================

begin;

create table if not exists notificaciones (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  tipo          text not null,
  severidad     text not null default 'info',  -- info | ok | warn | urgente
  titulo        text not null,
  descripcion   text,
  link          text,                          -- ruta de ESCRITORIO; el móvil la mapea con rutaMovil()
  entity_type   text,
  entity_id     text,
  payload       jsonb not null default '{}'::jsonb,
  leido         boolean not null default false, -- muerto: el leído es por persona (ver cabecera)
  leido_at      timestamptz,
  canal_wa      text not null default 'no',     -- muerto desde que se borró Chatwoot
  origen        text not null default 'sistema',
  created_at    timestamptz not null default now()
);

-- Por si algún entorno aplicó la 0048 (sin workspace_id): la columna se agrega, las filas viejas SIN
-- dueño se borran —no hay a quién mostrárselas sin repetir la fuga de la 0048— y recién ahí NOT NULL.
alter table notificaciones add column if not exists workspace_id bigint references workspaces(id) on delete cascade;
delete from notificaciones where workspace_id is null;
alter table notificaciones alter column workspace_id set not null;

create index if not exists idx_notificaciones_ws_created on notificaciones (workspace_id, created_at desc);
-- Los índices GLOBALES de la 0048 (leído y cola de WhatsApp sin workspace) no sirven con N inquilinos.
drop index if exists idx_notif_leido_created;
drop index if exists idx_notif_wa_pendiente;

comment on table notificaciones is 'Feed de avisos por workspace (Inbox de MaKo Mobile). El leído es por persona: usuarios.perfil.notifVistoHasta. leido/canal_wa: columnas muertas de la 0048.';

-- RLS on sin políticas = sólo server-side (service_role), igual que el resto.
alter table notificaciones enable row level security;
revoke all on notificaciones from anon, authenticated;

commit;
