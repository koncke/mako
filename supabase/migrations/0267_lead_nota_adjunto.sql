-- =============================================================================
-- 0267 — El adjunto de una NOTA del lead (archivos e imágenes, como en los chats de MaKo)
-- =============================================================================
-- Pedido de Martín (12/10/2026, tercer feedback del CRM, punto 3): «las notas como los chats de
-- MaKo» — adjuntar archivos e imágenes. Una nota del lead es un evento `campo = 'Nota'` de
-- `lead_audit` y hasta acá era sólo texto. El molde es el de las notas del curso (mig 0208): el
-- archivo vive en un bucket PRIVADO, el navegador lo sube directo con una URL firmada, y se lee
-- con una URL firmada de vida corta que se pide por el id de la nota.
--
-- Las cuatro columnas son nullable y sólo las escribe la nota con adjunto
-- (app/crm/actions.ts, `addLeadNoteAction`): ningún otro evento del historial las usa.
-- =============================================================================

begin;

alter table lead_audit
  add column if not exists archivo_path   text,
  add column if not exists archivo_nombre text,
  add column if not exists archivo_mime   text,
  add column if not exists archivo_bytes  bigint;

comment on column lead_audit.archivo_path is 'Sólo en campo=''Nota'': el adjunto en el bucket lead-notas, <ws>/<lead>/<uuid>. El nombre original va en archivo_nombre, nunca en la ruta.';
comment on column lead_audit.archivo_nombre is 'El nombre original del adjunto de una nota (para mostrarlo y para el «descargar como»).';

-- Los mismos tipos y el mismo tope que curso-notas (app/customer-success/curso/reglas.ts,
-- `MIME_NOTA` / `TOPE_NOTA_BYTES`): la regla de qué se puede adjuntar es una sola.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-notas', 'lead-notas', false, 26214400, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
