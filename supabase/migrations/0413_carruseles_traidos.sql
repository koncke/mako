-- =============================================================================
-- 0413 — «Traer tu outlier»: un carrusel que un negocio suma por su link (11/11/2026)
-- =============================================================================
-- Martín, 11/11/2026: «en los outliers haya una opción para traer tu propio [outlier], pegar el link de Instagram… para poder
-- sumarlo entre los outliers y poder trabajar sobre eso». Lo traído vive en la MISMA tabla que la biblioteca de carruseles
-- (0392): así el «Editar» (replicar), los Guardados, las imágenes en nuestro bucket y la lectura por link (`links` de
-- scripts/carruseles-biblioteca.mts) andan sin otro camino. Lo que cambia es QUIÉN lo ve:
--   · `workspace_id` null: el catálogo de la plataforma, que ven todos (lo de siempre);
--   · `workspace_id` = un negocio: lo trajo ese negocio y lo ve SÓLO él (lib/carruseles/biblioteca-servidor.ts filtra al leer,
--     porque la tabla no es de TENANT_TABLES: es global y la lee el server con service_role).
-- `ref` sigue siendo único: si otro negocio trae la misma publicación (es pública), la fila pasa a la plataforma (null).
--
-- SÓLO AGREGA una columna que acepta null y un índice. El código tolera que falte (lee `*`; sin la columna, traer contesta que
-- falta esta migración y todo lo demás sigue igual).
-- =============================================================================
begin;

alter table carruseles_biblioteca_piezas
  add column if not exists workspace_id bigint references workspaces(id) on delete cascade;

create index if not exists carruseles_biblioteca_piezas_ws_idx
  on carruseles_biblioteca_piezas (workspace_id) where workspace_id is not null;

comment on column carruseles_biblioteca_piezas.workspace_id is
  'null = de la plataforma (lo ven todos); un negocio = lo trajo ese negocio por su link y lo ve sólo él (lib/carruseles/biblioteca-servidor.ts).';

commit;
