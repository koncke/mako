-- =============================================================================
-- 0361 — La miniatura de una pieza se GUARDA, no se apunta
-- =============================================================================
-- Martín, 2/11/2026, mirando la tab ya desplegada: «no quiero que se vea texto. Si tenemos que
-- descargar la imagen de la miniatura y guardarla, lo hacemos, pero es importante que eso se
-- vea bien».
--
-- ⚠️ ESTO REVIERTE, A PROPÓSITO, LA DECISIÓN DE 0359. Ahí se decidió NO guardar la imagen porque
-- la URL del CDN de Meta vence, y se dejó el texto como respaldo. Eso resultó peor de las dos
-- formas: la URL vence igual Y el CDN de Meta devuelve 403 a cualquier pedido que venga de otro
-- dominio, así que en producción no se veía NINGUNA miniatura de Instagram. Guardar los bytes
-- arregla las dos cosas de una vez.
--
-- Y hay un segundo motivo, que es de producto y lo dio Martín: la miniatura de un video largo de
-- YouTube «puede llegar a servir de referencia para crear miniaturas luego para los propios
-- usuarios de MaKo». Una URL que vence no sirve de referencia; un archivo sí.
--
-- EL BUCKET ES PÚBLICO, y es deliberado: una URL firmada vence, que es exactamente el problema
-- del que venimos. Lo que se guarda acá es una miniatura que YA ERA PÚBLICA en Instagram o en
-- YouTube — no hay nada privado de ningún negocio en este bucket.
--
-- LA RUTA NO LLEVA workspace_id, y también es deliberado: `spy/<canal>/<ref>.jpg`. La miniatura
-- de `@leilahormozi` es la misma para todos los negocios que la miren, así que se guarda UNA vez
-- y la aprovechan todos. Es la misma idea que la decisión de compartir Spy: se comparte lo caro
-- (la lectura de un canal público), nunca la lista de a quién mira cada negocio.
-- =============================================================================
begin;

-- Sólo imágenes, y sin SVG: un SVG es un documento ACTIVO y el bucket se sirve bajo el dominio de
-- Supabase. Lo que entra acá viene de un CDN ajeno, así que el tipo se verifica al subir.
-- El tope por archivo es de 2 MiB: una miniatura que pesa más no es una miniatura.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spy-miniaturas', 'spy-miniaturas', true, 2097152, array[
  'image/jpeg',
  'image/png',
  'image/webp'
])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Cuándo se guardó la copia. Sirve para dos cosas: saber si una pieza vieja todavía apunta al CDN
-- ajeno (la columna en null) y poder rehacer las que se guardaron con una versión vieja del
-- descargador. NO se usa para vencerla: una vez guardada, la copia no vence.
alter table spy_piezas
  add column if not exists miniatura_guardada_en timestamptz;

comment on column spy_piezas.miniatura_guardada_en is
  'Cuándo se bajó la miniatura a nuestro bucket. En null = `miniatura` todavía apunta al CDN de la fuente, que vence y puede dar 403.';

commit;
