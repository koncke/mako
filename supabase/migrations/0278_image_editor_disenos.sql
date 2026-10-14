-- =============================================================================
-- 0278 — El Image Editor (la copia de Canva): los diseños y sus subidas pasan a la base
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae /api/image-editor/*. El código nuevo
-- LEE estas tablas desde el primer request (el inicio del editor las lista): sin ellas el editor
-- contesta «relation does not exist». Agrega y no saca nada: la versión desplegada guarda en el
-- navegador (IndexedDB) y no mira ninguna de las dos tablas ni el bucket, así que aplicarla antes
-- no le molesta a nadie.
--
-- Pedido de Martín (14/10/2026): «implementes end to end un "Canva" dentro de MaKo» y, sobre la
-- base, «Copia a Doory… quiero la plantilla para ir trabajando». La etapa 1 guardó en el navegador;
-- ésta es la etapa 2 que fijó el plano (docs/diseno-editor-imagen.md, decisión 4): el estado del
-- producto va a la base, otra máquina y el equipo lo ven, y la API de MaKo y las Estrellas leen de
-- acá. Forma: docs/editor-imagen/relevamiento-integracion-mako.md §5.6 (molde `landing_docs`, 0246).
--
-- Las dos tablas: `workspace_id` SIN default (el 1 es un cliente, nunca el dueño por omisión),
-- índice por workspace, RLS prendida sin políticas y `revoke` explícito. El servidor lee con
-- service_role.
--
-- ⚠️ Y VAN A TRES REGISTROS DEL CÓDIGO (el compilador no ve ninguno): `TENANT_TABLES`
-- (lib/workspace.ts), `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts) y el bucket en `BUCKETS`
-- (lib/reset-workspace.ts).

begin;

-- ── 1. Una fila por diseño ───────────────────────────────────────────────────
-- `id` es un uuid y no un identity: el motor (Doory) nombra los diseños con uuid, la URL del editor
-- es /image-editor/<uuid>, y un diseño que estaba en el navegador sube con SU id (la pestaña abierta
-- y los enlaces siguen sirviendo).
--
-- `doc` es el `DoryDocument` entero (páginas, objetos, fondo, notas). Las imágenes van como URL del
-- bucket de abajo, nunca `blob:` ni `idb://`: eso lo frena el server al guardar.
--
-- `version` es la concurrencia optimista, como `landing_docs`: guardar exige la que se abrió y el
-- update es compare-and-set (`where id = … and version = …`). Dos pestañas sobre el mismo diseño no
-- se pisan: la segunda recibe 409 y el editor ofrece recargar o guardar una copia.
--
-- `ancho`, `alto` y `paginas` salen del `doc` al guardar: la lista del inicio no baja el documento.
-- `borrado_at`: eliminar desde el inicio lo saca de la lista; la fila queda (cerrar no es borrar).
create table if not exists image_disenos (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  titulo        text not null default 'Diseño sin título' check (char_length(titulo) between 1 and 200),
  doc           jsonb not null,
  ancho         integer not null check (ancho > 0),
  alto          integer not null check (alto > 0),
  paginas       integer not null default 1 check (paginas >= 1),
  version       integer not null default 1 check (version >= 1),
  miniatura     text,
  creado_por    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  borrado_at    timestamptz
);
create index if not exists image_disenos_ws_idx on image_disenos (workspace_id, updated_at desc) where borrado_at is null;
alter table image_disenos enable row level security;
revoke all on image_disenos from anon, authenticated;

-- ── 2. Una fila por archivo subido («Subidos» de Canva) ──────────────────────
-- Canva comparte «Subidos» entre todos los diseños del equipo: la lista es POR WORKSPACE, no por
-- diseño. Una fila nace cuando el server verificó el archivo (magic bytes y tope) y lo mudó a su
-- lugar definitivo; borrarla del panel la saca de la lista y NO borra el archivo, que un diseño
-- puede seguir usando.
create table if not exists image_subidos (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  nombre        text not null check (char_length(nombre) between 1 and 200),
  tipo          text not null,
  ancho         integer not null default 0 check (ancho >= 0),
  alto          integer not null default 0 check (alto >= 0),
  bytes         bigint not null default 0 check (bytes >= 0),
  ruta          text not null,
  url           text not null,
  created_at    timestamptz not null default now(),
  borrado_at    timestamptz
);
create index if not exists image_subidos_ws_idx on image_subidos (workspace_id, created_at desc) where borrado_at is null;
alter table image_subidos enable row level security;
revoke all on image_subidos from anon, authenticated;

-- ── 3. El bucket ─────────────────────────────────────────────────────────────
-- PÚBLICO y con URL estable: el lienzo carga las imágenes con CORS y una URL firmada vence (el
-- diseño quedaría con huecos a las dos horas) y mata el caché del CDN. Rutas `<ws>/<uuid>.<ext>`
-- (lo que vacía el reset del workspace), `<ws>/subidas/…` mientras se sube y `<ws>/miniaturas/…`.
--
-- ⚠️ SIN SVG NI HTML: un SVG es un documento ACTIVO y el bucket sirve bajo el dominio de Supabase.
-- El editor rasteriza un SVG subido a PNG antes de mandarlo (mismo criterio que landing-imagenes).
-- El tipo REAL se verifica por magic bytes al registrar (`sniffArchivo`, lib/image-editor/reglas.ts).
-- El tope del bucket es el del audio (25 MiB); el de la imagen (15 MiB) lo aplica el server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('image-editor', 'image-editor', true, 26214400, array[
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/mp4'
])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
