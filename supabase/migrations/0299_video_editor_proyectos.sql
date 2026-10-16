-- =============================================================================
-- 0299 — Una copia de LECTURA de cada proyecto del Video Editor, para la API de MaKo
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae /api/video-editor/proyectos y las lecturas
-- `listar_proyectos_video` y `ver_proyecto_video`. Agrega y no saca nada. Sin la tabla el editor sigue igual (la
-- copia no se sube, sin molestar) y las dos lecturas dicen que todavía no hay proyectos para leer.
--
-- Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md): «las 32 operaciones del chat de Video Editor pasan a
-- la API». El proyecto vive en el NAVEGADOR de quien lo edita (IndexedDB/OPFS, decisión 5 de docs/diseno-editor-video.md)
-- y un runner de la API corre en el server: no tenía de dónde leerlo (docs/hallazgos-video-editor.md, «La API de MaKo y
-- el chat al costado»). Ésta es la copia: el editor sube, un rato después de cada cambio, la MISMA vista de la línea de
-- tiempo que lee su chat (app/video-editor/_opencut/chat/linea.ts → vistaDeLinea: pistas, elementos con sus refs cortas
-- —v1, t2—, medios y los nombres disponibles), sin el video crudo. Reglas: lib/editor-video/espejo.ts.
--
-- Es una COPIA: la fuente sigue siendo el navegador. Nada escribe la línea de tiempo desde acá; lo que la API proponga
-- lo acepta una persona en el editor (la tanda siguiente).
--
-- Una fila por (workspace, proyecto):
--   · `vista` es el JSON que lee la IA del chat (≤ 60 k: `TOPES_CHAT.vistaMax`); si el proyecto es más grande, la
--     vista no se sube y queda `demasiado_grande`.
--   · `refs` son TODAS las refs que el proyecto usó alguna vez ([[id, ref], …]): las de lo que se borró no se reusan,
--     así «t2» de una propuesta vieja nunca cae sobre un texto nuevo.
--   · `editado_por` es la persona del último que subió (`personaDeSesion`).
--   · `borrado_at`: borrar el proyecto en el editor lo saca de las lecturas; la fila queda (cerrar no es borrar).
--
-- `workspace_id` SIN default (el 1 es un cliente, nunca el dueño por omisión), RLS prendida sin políticas y `revoke`
-- explícito: el servidor lee con service_role.
--
-- ⚠️ Y VA A DOS REGISTROS DEL CÓDIGO (el compilador no ve ninguno): `TENANT_TABLES` (lib/workspace.ts) y
-- `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts).

begin;

create table if not exists video_editor_proyectos (
  workspace_id      bigint not null references workspaces(id) on delete cascade,
  proyecto_id       text not null check (char_length(proyecto_id) between 1 and 100),
  nombre            text not null default 'Proyecto sin título' check (char_length(nombre) between 1 and 200),
  escena_id         text not null check (char_length(escena_id) between 1 and 100),
  duracion          numeric not null default 0 check (duracion >= 0),
  vista             jsonb,
  refs              jsonb not null default '[]'::jsonb,
  demasiado_grande  boolean not null default false,
  editado_por       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  borrado_at        timestamptz,
  primary key (workspace_id, proyecto_id)
);
create index if not exists video_editor_proyectos_ws_idx on video_editor_proyectos (workspace_id, updated_at desc) where borrado_at is null;
alter table video_editor_proyectos enable row level security;
revoke all on video_editor_proyectos from anon, authenticated;

commit;
