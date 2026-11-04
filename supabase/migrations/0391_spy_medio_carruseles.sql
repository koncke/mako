-- =============================================================================
-- 0391 — si una publicación de Instagram es un carrusel, una imagen o un video, y cuántas láminas trae (4/11/2026)
-- =============================================================================
-- Para el explorador de carruseles que funcionan del Image Editor (app/image-editor, `?ver=carruseles`): Spy guardaba toda
-- publicación que no es un reel como `tipo = 'publicacion'`, y un carrusel de 7 láminas era lo mismo que una foto suelta.
-- La fuente ya lo decía (Meta: `media_type`; Apify: `type` y `childPosts`) y se tiraba al guardar. Ver lib/spy-medio.ts.
--
-- ⚠️ ORDEN DE DESPLIEGUE: da igual. El código que la escribe (`guardarMedios`, lib/spy.ts) va en un update APARTE del
-- upsert de siempre y se calla solo si la columna falta (PGRST204/42703); el que la lee (lib/carruseles/) la toma como
-- «no se sabe». Con la migración aplicada, cada publicación se completa en su próxima lectura: no hay backfill, porque lo
-- que ya está guardado no trae el dato (no se adivina).
--
-- Sólo AGREGA dos columnas que pueden quedar en null: no cambia ninguna fila existente. Sin funciones nuevas.
-- =============================================================================
begin;

alter table spy_piezas
  add column if not exists medio text,
  add column if not exists laminas smallint;

-- Valores válidos, sin trabar lo de antes (todo lo que ya existe queda en null).
alter table spy_piezas drop constraint if exists spy_piezas_medio_check;
alter table spy_piezas add constraint spy_piezas_medio_check check (medio is null or medio in ('carrusel', 'imagen', 'video'));
alter table spy_piezas drop constraint if exists spy_piezas_laminas_check;
alter table spy_piezas add constraint spy_piezas_laminas_check check (laminas is null or laminas between 2 and 20);

comment on column spy_piezas.medio is
  'Sólo Instagram: carrusel, imagen o video, como lo dijo su fuente (Meta media_type / Apify type). null = no se sabe. lib/spy-medio.ts.';
comment on column spy_piezas.laminas is
  'Sólo un carrusel de Instagram: cuántas láminas trae (Apify childPosts/images). Meta no las da: null = no se sabe, nunca se estima.';

commit;
