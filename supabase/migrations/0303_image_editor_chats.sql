-- =============================================================================
-- 0303 — El hilo del chat «MaKo IA» del Image Editor, en la base
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae /api/image-editor/chat. Agrega y no saca nada. Sin la
-- tabla el editor anda igual: el hilo vive en la pestaña y se pierde al recargar (la ruta contesta «sin tabla» y el
-- editor deja de intentar guardar, sin molestar a nadie). Aplicarla antes no le molesta a la versión desplegada, que
-- no la mira.
--
-- Pedido de Martín (16/10/2026, por el Cerebro): «implementes este chat en todas las tabs… quiero que la app sea AI
-- NATIVE». El chat del Image Editor copia al del Video Editor, y su hilo se guarda como el de él (mig 0298). Formato y
-- reglas: lib/image-editor/chat/hilo.ts.
--
-- Una fila por (workspace, persona, diseño):
--   · `persona` es la de `personaDeSesion` (lib/chart-chats-reglas.ts): `u<id de usuarios>`, o el email si la sesión
--     no tiene fila. Los chats nuevos son POR PERSONA (decisión 3 de docs/diseno-mako-ai-native.md).
--   · `diseno_id` es el id del diseño del motor (el de `image_disenos` cuando ya subió). Texto y SIN clave foránea: un
--     diseño puede estar todavía sólo en el navegador, y su chat ya se guarda.
--   · `nombre` es el título del diseño al guardar, para el índice de chats (no hace falta abrirlo).
--   · `mensajes` es el hilo entero (jsonb), saneado y con topes por el código (`hiloParaGuardar`).
--   · `version` es la concurrencia optimista, como `image_disenos` (0278): guardar exige la que se leyó y el update
--     es compare-and-set; dos pestañas no se pisan (la segunda une su copia y vuelve a guardar).
--
-- `workspace_id` SIN default (el 1 es un cliente, nunca el dueño por omisión), RLS prendida sin políticas y `revoke`
-- explícito: el servidor lee con service_role.
--
-- ⚠️ Y VA A DOS REGISTROS DEL CÓDIGO (el compilador no ve ninguno): `TENANT_TABLES` (lib/workspace.ts) y
-- `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts).

begin;

create table if not exists image_editor_chats (
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  persona       text not null check (char_length(persona) between 1 and 200),
  diseno_id     text not null check (char_length(diseno_id) between 1 and 100),
  nombre        text check (nombre is null or char_length(nombre) <= 200),
  mensajes      jsonb not null default '[]'::jsonb,
  version       integer not null default 1 check (version >= 1),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, persona, diseno_id)
);
create index if not exists image_editor_chats_ws_idx on image_editor_chats (workspace_id, updated_at desc);
alter table image_editor_chats enable row level security;
revoke all on image_editor_chats from anon, authenticated;

commit;
