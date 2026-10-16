-- =============================================================================
-- 0300 — Lo que la API de MaKo PROPONE en un proyecto del Video Editor (se acepta en el editor)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae las acciones del editor en la API
-- (`agregar_texto_video`, `cortar_frase_video`… lib/editor-video/chat-api.ts) y /api/video-editor/propuestas.
-- Agrega y no saca nada. Sin la tabla, esas acciones contestan que todavía no se pueden proponer, y el editor no
-- busca propuestas (sin molestar).
--
-- Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md): las operaciones del chat «Editar con IA» pasan a la
-- API. El proyecto vive en el NAVEGADOR de quien lo edita (decisión 5 de docs/diseno-editor-video.md), así que ningún
-- canal escribe su línea de tiempo: cada acción deja su operación en una PROPUESTA de ese proyecto, y una persona la
-- mira y la acepta en el editor, con el mismo «Aceptar» del chat (que la revisa contra la línea de tiempo de ese
-- momento). Reglas: lib/editor-video/propuestas.ts.
--
-- Una fila por propuesta:
--   · lo que llega por el MISMO canal (`canal_key`: el grupo de WhatsApp, la sesión de la app, el token) al mismo
--     proyecto mientras está abierta se SUMA a la misma fila, hasta el tope del chat (40 operaciones): la persona acepta
--     el pedido entero de una vez, en un paso de deshacer;
--   · `operaciones` son las del chat (`OperacionChat`, ya validadas); `lineas`, una por operación, en palabras;
--   · `refs` son las de la copia del proyecto (0299) al proponer: con ellas el editor sabe qué es «t2» aunque haya
--     cambiado la línea de tiempo en el medio;
--   · `estado`: abierta → aplicada | descartada, y quién y cuándo (`resuelto_*`). Cerrar no es borrar: la fila queda.
--   · `version` es compare-and-set: dos acciones que llegan juntas no se pisan las operaciones.
--
-- `workspace_id` SIN default (el 1 es un cliente, nunca el dueño por omisión), RLS prendida sin políticas y `revoke`
-- explícito: el servidor lee con service_role.
--
-- ⚠️ Y VA A DOS REGISTROS DEL CÓDIGO (el compilador no ve ninguno): `TENANT_TABLES` (lib/workspace.ts) y
-- `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts).

begin;

create table if not exists video_editor_propuestas (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   bigint not null references workspaces(id) on delete cascade,
  proyecto_id    text not null check (char_length(proyecto_id) between 1 and 100),
  canal          text not null check (canal in ('whatsapp', 'app', 'http')),
  canal_key      text not null check (char_length(canal_key) between 1 and 300),
  escena_id      text not null check (char_length(escena_id) between 1 and 100),
  refs           jsonb not null default '[]'::jsonb,
  operaciones    jsonb not null default '[]'::jsonb,
  lineas         jsonb not null default '[]'::jsonb,
  estado         text not null default 'abierta' check (estado in ('abierta', 'aplicada', 'descartada')),
  propuesto_por  text,
  resuelto_por   text,
  descartes      jsonb,
  version        integer not null default 1 check (version >= 1),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  resuelto_at    timestamptz
);
create index if not exists video_editor_propuestas_abiertas_idx
  on video_editor_propuestas (workspace_id, proyecto_id, created_at desc) where estado = 'abierta';
alter table video_editor_propuestas enable row level security;
revoke all on video_editor_propuestas from anon, authenticated;

commit;
