-- =============================================================================
-- 0285 — el Centro de Operaciones: la cola de pedidos y el estado del cartero (15/10/2026)
-- =============================================================================
-- Pedido de Martín: «continua y termina el centro de operaciones, es lo que más me interesa
-- ahora». El diseño, en docs/diseno-centro-de-operaciones.md.
--
-- Dos tablas de la PLATAFORMA, sin workspace_id a propósito: son de Martín y su PC, no de un
-- cliente. No van en TENANT_TABLES; las lee y escribe sólo el servidor (lib/operaciones.ts),
-- detrás de la guarda de plataforma (lib/operaciones-reglas.ts → `puedeOperar`).
--
-- operaciones_pedidos — un pedido para un chat de Claude Code. ⚠️ La verdad del pedido es
--   `firmado` + `firma`: el texto y el destino que el cartero entrega salen de `firmado`
--   (firmado en el navegador de Martín con una clave que el servidor no tiene), NUNCA de las
--   columnas `texto` / `destino_*`, que existen para listar y filtrar. El id lo pone el
--   navegador y va adentro de la firma: un pedido no se puede reenviar con otro id sin otra firma.
--
-- operaciones_carteros — una fila POR CUENTA de Claude: hay un cartero por cuenta (las tres corren a
--   la vez, decisión de Martín del 15/10), y cada uno sube cuándo pasó, qué chats ve en su
--   directorio de configuración y qué claves de firma acepta. Las escribe sólo el cartero.
-- operaciones_token — UNA fila: el token de los carteros, por hash.
--
-- ORDEN DE DESPLIEGUE: ANTES del deploy. La pantalla /admin/operaciones y la ruta del cartero
-- leen estas tablas; sin ellas, la pantalla contesta un error. No pisa nada que exista.
-- =============================================================================

create table if not exists operaciones_pedidos (
  id              uuid primary key,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  autor           text not null,
  destino         text not null,
  destino_cuenta  text,
  destino_titulo  text,
  texto           text not null,
  firmado         text not null,
  firma           text not null,
  clave_id        text not null,
  estado          text not null default 'escrito'
                  check (estado in ('escrito', 'tomado', 'entregado', 'no_entregado', 'incierto', 'hecho', 'comprobado', 'cancelado')),
  motivo          text,
  tomado_at       timestamptz,
  entregado_at    timestamptz,
  cerrado_at      timestamptz,
  cierre          jsonb
);

create index if not exists idx_operaciones_pedidos_estado on operaciones_pedidos (estado, created_at);
create index if not exists idx_operaciones_pedidos_creado on operaciones_pedidos (created_at desc);

comment on table operaciones_pedidos is
  'Centro de Operaciones: pedidos firmados para un chat de Claude Code. La verdad es firmado+firma (lib/operaciones-reglas.ts).';

create table if not exists operaciones_carteros (
  cuenta          text primary key check (cuenta ~ '^claude[0-9]{1,2}$'),
  visto_at        timestamptz,
  version         text,
  chats           jsonb not null default '[]'::jsonb,
  claves          jsonb not null default '[]'::jsonb,
  cuota           jsonb,
  updated_at      timestamptz not null default now()
);

comment on table operaciones_carteros is
  'Centro de Operaciones: un cartero por cuenta de Claude. Chats, claves y cuota los sube el cartero.';

create table if not exists operaciones_token (
  id              smallint primary key default 1 check (id = 1),
  token_hash      text not null,
  token_pista     text not null,
  creado_at       timestamptz not null default now()
);

comment on table operaciones_token is
  'Centro de Operaciones: el token de los carteros (una fila, por hash). Se acuña en /admin/operaciones.';

-- RLS prendido sin políticas = sólo el servidor (service_role). Y el revoke explícito: Supabase
-- le da permisos a anon y authenticated por default (AGENTS.md, «una VISTA no tiene RLS» y la 0280).
alter table operaciones_pedidos enable row level security;
alter table operaciones_carteros enable row level security;
alter table operaciones_token enable row level security;
revoke all on operaciones_pedidos from anon, authenticated;
revoke all on operaciones_carteros from anon, authenticated;
revoke all on operaciones_token from anon, authenticated;
