-- =============================================================================
-- 0216 — La descripción RICA de una clase y sus ADJUNTOS (imágenes, PDF, archivos)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: se aplica ANTES del deploy: el código nuevo la lee. La ruta del alumno
-- (/api/compartido/curso/adjunto) lee `curso_clases.descripcion_html` y `curso_adjuntos`, el
-- editor sube al bucket `curso-adjuntos` y registra en `curso_adjuntos`. Agrega y no saca nada:
-- la versión desplegada no mira ninguna de las tres cosas, así que aplicarla antes no le molesta.
--
-- ⚠️ Y LO QUE NO DEPENDE DE ESTA MIGRACIÓN, a propósito: el portal, la ficha y el cron leen las
-- clases con `COLUMNAS_CLASE` (lib/curso-datos.ts), que NO trae `descripcion_html`. La ruta de
-- adjuntos la lee aparte (lib/curso-adjuntos.ts). Si alguien la suma a `COLUMNAS_CLASE`, esta
-- migración tiene que estar aplicada ANTES: sin la columna, esa lectura tumba el portal de cada
-- cliente.
--
-- Pedido de Martín (07/10/2026, item 17): «Se debería poder adjuntar cosas a la descripción…
-- Imágenes, PDF, archivos, etc.. Y mejora bastante las opciones de editar texto allí, se debería
-- poder editar el texto completo, como si fuera un word». Diseño: docs/diseno-curso-skool.md, D4.

begin;

-- ── 1. La descripción rica ───────────────────────────────────────────────────
-- HTML SANEADO EN EL SERVER con lista blanca (`sanearHtml`, lib/html-seguro.ts) antes de
-- guardarse. `descripcion` (texto plano) se sigue llenando con el texto derivado (`textoDeHtml`)
-- para la búsqueda, la IA y los mensajes: las dos columnas las escribe el MISMO guardado.
-- Los adjuntos van adentro por referencia (`mako-adjunto:<uuid>`), nunca por URL: la URL es de
-- quien mira y vence.
-- `''` = sin descripción rica (las 107 clases cargadas el 06/10 quedan así, con su texto plano).
alter table curso_clases add column if not exists descripcion_html text not null default '';

-- Un techo de largo, y nada más: lo que vale lo decide el código. Más alto que `TOPE_HTML`
-- (100.000) a propósito, para que la pantalla diga «demasiado larga» antes que la base.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'curso_clases_descripcion_html_largo') then
    alter table curso_clases add constraint curso_clases_descripcion_html_largo
      check (char_length(descripcion_html) <= 200000);
  end if;
end $$;

comment on column curso_clases.descripcion_html is 'La descripción rica de la clase: HTML saneado en el server (lib/html-seguro.ts). Los adjuntos van por referencia mako-adjunto:<uuid>. descripcion lleva su texto plano.';

-- ── 2. Los adjuntos ──────────────────────────────────────────────────────────
-- Un archivo subido desde el editor de la descripción. El archivo vive en el bucket
-- `curso-adjuntos` en `<ws>/<producto>/<uuid>.<ext>`, y el id de la fila ES ese uuid
-- (`registrarAdjunto` lo saca del path): registrar dos veces el mismo archivo da la misma fila.
--
-- ⚠️ `clase_id` DICE DÓNDE SE SUBIÓ, NO QUIÉN LO VE. Lo que decide si el alumno lo recibe es que la
--    descripción publicada de la clase lo nombre (`decidirAdjuntoAlumno`): una imagen copiada a
--    otra lección del mismo curso es de las dos. Por eso borrar la clase la deja en NULL (y no se
--    lleva la fila): otra clase puede seguir nombrándola.
-- `clase_id` NULL también = se subió antes de que la clase existiera; el guardado la reclama
-- (`vincularAdjuntos`).
create table if not exists curso_adjuntos (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  bigint not null default 1 references workspaces(id) on delete cascade,
  producto_id   bigint not null references productos(id) on delete cascade,
  clase_id      bigint references curso_clases(id) on delete set null,
  -- La ruta en el bucket. El nombre original NO entra (acentos, espacios, el nombre de un
  -- cliente): va aparte, y es el que se usa al descargar.
  path          text not null unique check (path ~ '^[0-9]{1,12}/[0-9]{1,12}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'),
  nombre        text not null check (char_length(nombre) between 1 and 160),
  mime          text not null check (char_length(mime) between 1 and 120),
  bytes         bigint not null check (bytes > 0),
  created_at    timestamptz not null default now(),
  -- El email de quien lo subió (sale de la sesión). Texto y no FK: una sesión de super admin no
  -- tiene fila en `usuarios` del workspace.
  creado_por    text
);
create index if not exists idx_curso_adjuntos_producto on curso_adjuntos (workspace_id, producto_id);
create index if not exists idx_curso_adjuntos_clase on curso_adjuntos (workspace_id, clase_id) where clase_id is not null;

comment on table curso_adjuntos is 'Archivos de la descripción rica de una clase (bucket privado curso-adjuntos). El HTML los nombra por mako-adjunto:<id>; el alumno recibe uno sólo si la descripción publicada de esa clase lo nombra.';

-- RLS on sin políticas = sólo server-side (service_role), igual que el resto.
alter table curso_adjuntos enable row level security;
revoke all on curso_adjuntos from anon, authenticated;

-- ── 3. El bucket ─────────────────────────────────────────────────────────────
-- PRIVADO: se lee con una URL firmada de vida corta (el equipo, con su sesión; el alumno, por la
-- ruta que valida su token y el candado de la etapa). La subida va directo del navegador con una
-- URL firmada (una server action topa en 1 MB), como los videos y las notas.
-- 25 MiB por archivo, como las notas: documentos, planillas, imágenes y ZIP, no videos (para eso
-- está `curso-videos`). SIN SVG NI HTML: los dos pueden llevar código.
-- ⚠️ LA LISTA DE TIPOS ES LA MISMA QUE `MIME_ADJUNTO` (lib/curso-adjuntos-reglas.ts), y el tope es
-- `TOPE_ADJUNTO_BYTES`: un test compara las dos. Si se cambia una, se cambia la otra — el bucket
-- rechaza recién al terminar de subir, y la pantalla tiene que poder decir «no» antes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curso-adjuntos', 'curso-adjuntos', false, 26214400, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/zip',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
