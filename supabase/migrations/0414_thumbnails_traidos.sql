-- =============================================================================
-- 0414 — «Traer tu outlier» de YouTube: la miniatura que un negocio suma por su link (11/11/2026)
-- =============================================================================
-- Martín, 11/11/2026: traer un outlier propio pegando el link (Instagram, YouTube o la biblioteca de anuncios de Meta) para
-- sumarlo a los outliers del negocio y trabajar sobre eso. Es la 0413 (carruseles) para las miniaturas de YouTube.
--
-- Lo traído vive en las MISMAS tablas de la biblioteca (0409), con el negocio que lo trajo:
--   · `thumbnails_videos.workspace_id`: el video lo ve SÓLO ese negocio (lib/thumbnails/explorar.ts, `seVeThumbnail`);
--     NULL = de la plataforma, como hasta hoy.
--   · `thumbnails_canales.workspace_id`: el canal que entró por un link NO es de la biblioteca: el cron que relee los canales
--     (lib/thumbnails/renovar.ts, `canalesPorLeer`) lo saltea, así no se trae sus 50 videos para todos ni gasta la cuota.
--     NULL = un canal de la plataforma.
--   · el RUBRO y el IDIOMA del canal pasan a poder quedar vacíos: de un canal que entró por un link no se saben (el idioma
--     sólo si YouTube lo dice), y un rubro inventado lo mostraría en el filtro de un rubro que no es el suyo. Los checks
--     siguen igual para lo que tiene valor.
-- Agrega columnas (nullable) y un índice, y afloja dos NOT NULL: nada de lo que hay cambia ni se pierde.
-- =============================================================================
begin;

alter table thumbnails_videos add column if not exists workspace_id bigint references workspaces (id) on delete cascade;
alter table thumbnails_canales add column if not exists workspace_id bigint references workspaces (id) on delete cascade;
alter table thumbnails_canales alter column nicho drop not null;
alter table thumbnails_canales alter column idioma drop not null;

create index if not exists thumbnails_videos_ws_idx on thumbnails_videos (workspace_id) where workspace_id is not null;

comment on column thumbnails_videos.workspace_id is
  'El negocio que trajo este video por su link («Traer tu outlier», 11/11/2026): lo ve sólo él. NULL = de la plataforma.';
comment on column thumbnails_canales.workspace_id is
  'El negocio que trajo un video de este canal por su link: el cron no lo relee. NULL = un canal de la biblioteca.';

commit;
