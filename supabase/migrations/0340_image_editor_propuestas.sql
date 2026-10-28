-- =============================================================================
-- 0340 — Lo que la API de MaKo PROPONE en un diseño del Image Editor (se acepta en el editor)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae las acciones del Image Editor en la API
-- (`estilo_texto_imagen`, `mover_elemento_imagen`, `crear_imagen_ia`… lib/image-editor/chat/api.ts) y
-- /api/image-editor/propuestas. Agrega y no saca nada. Sin la tabla, esas acciones contestan que todavía no se pueden
-- proponer, y el editor no busca propuestas (sin molestar).
--
-- El espejo de la 0302 (`video_editor_propuestas`) para el Image Editor, pedido de Martín (27/10/2026): «si una persona
-- quiere editar lo que sea debería poder. Con prompts en mako». Las operaciones del chat «MaKo IA» pasan a la API, y
-- cada acción deja su operación en una PROPUESTA del diseño: una persona la mira y la acepta en el editor, con el mismo
-- «Aceptar» del chat (que la vuelve a probar contra el diseño de ese momento, por id). Reglas:
-- lib/image-editor/chat/propuestas.ts.
--
-- Una fila por propuesta:
--   · lo que llega por el MISMO canal (`canal_key`: el grupo de WhatsApp, la sesión de la app, el token) al mismo diseño
--     mientras está abierta se SUMA a la misma fila, hasta el tope del chat (40 operaciones);
--   · `operaciones` son las del chat (`OperacionImagen`, ya validadas). crear_imagen y editar_imagen van SIN generar:
--     la imagen se crea (y se cobra en la cuenta del negocio) recién cuando una persona acepta;
--   · `refs` y `paginas` son los pares [ref, id] que usa la propuesta (las refs salen del id de cada objeto, no de su
--     posición); `pagina_id`, la página donde va lo nuevo sin "pagina" (la primera al proponer);
--   · `estado`: abierta → aplicada | descartada, y quién y cuándo (`resuelto_*`). Cerrar no es borrar: la fila queda.
--   · `version` es compare-and-set: dos acciones que llegan juntas no se pisan las operaciones.
--
-- `workspace_id` SIN default (el 1 es un cliente, nunca el dueño por omisión), RLS prendida sin políticas y `revoke`
-- explícito: el servidor lee con service_role.
--
-- ⚠️ Y VA A DOS REGISTROS DEL CÓDIGO (el compilador no ve ninguno): `TENANT_TABLES` (lib/workspace.ts) y
-- `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts).

begin;

create table if not exists image_editor_propuestas (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   bigint not null references workspaces(id) on delete cascade,
  diseno_id      uuid not null,
  canal          text not null check (canal in ('whatsapp', 'app', 'http')),
  canal_key      text not null check (char_length(canal_key) between 1 and 300),
  pagina_id      text check (pagina_id is null or char_length(pagina_id) between 1 and 100),
  refs           jsonb not null default '[]'::jsonb,
  paginas        jsonb not null default '[]'::jsonb,
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
create index if not exists image_editor_propuestas_abiertas_idx
  on image_editor_propuestas (workspace_id, diseno_id, created_at desc) where estado = 'abierta';
alter table image_editor_propuestas enable row level security;
revoke all on image_editor_propuestas from anon, authenticated;

commit;
