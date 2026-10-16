-- =============================================================================
-- 0298 — El hilo del chat «Editar con IA» del Video Editor pasa a la base
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae /api/video-editor/chat. Agrega y no saca nada. Sin
-- la tabla el editor sigue andando como hasta hoy: el hilo vive en la pestaña y se pierde al recargar (la ruta
-- contesta «sin tabla» y el editor deja de intentar guardar, sin molestar a nadie). Aplicarla antes no le molesta a
-- la versión desplegada, que no la mira.
--
-- Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md, decisión 5): «Web Generator y Video Editor empiezan a
-- guardar. Hoy su hilo vive en la memoria de la pestaña». Formato y reglas: lib/editor-video/chat-hilo.ts.
--
-- Una fila por (workspace, persona, proyecto):
--   · `persona` es la de `personaDeSesion` (lib/chart-chats-reglas.ts): `u<id de usuarios>`, o el email si la sesión
--     no tiene fila. Los chats nuevos son POR PERSONA (decisión 3 del diseño).
--   · `proyecto_id` es el id del proyecto del motor (OpenCut lo nombra en el navegador, donde vive el proyecto:
--     decisión 5 de docs/diseno-editor-video.md). Texto y no uuid: lo genera el motor, no la base.
--   · `nombre` es el del proyecto al guardar, para el índice de chats de la etapa 2 (no hace falta abrirlo).
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

create table if not exists video_editor_chats (
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  persona       text not null check (char_length(persona) between 1 and 200),
  proyecto_id   text not null check (char_length(proyecto_id) between 1 and 100),
  nombre        text check (nombre is null or char_length(nombre) <= 200),
  mensajes      jsonb not null default '[]'::jsonb,
  version       integer not null default 1 check (version >= 1),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, persona, proyecto_id)
);
create index if not exists video_editor_chats_ws_idx on video_editor_chats (workspace_id, updated_at desc);
alter table video_editor_chats enable row level security;
revoke all on video_editor_chats from anon, authenticated;

commit;
