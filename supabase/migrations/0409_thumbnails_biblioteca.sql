-- =============================================================================
-- 0409 — La biblioteca de miniaturas de YouTube de Image: «Thumbnails» (6/11/2026)
-- =============================================================================
-- Martín, 6/11/2026: «También quisiera una tab que sea "Thumbnails", para traer de la misma manera miniaturas top en el mercado,
-- estoy seguro que debe haber una API o un repo o algo que traiga eso». Es la tercera opción del explorador de Image
-- (Carruseles · Anuncios · Thumbnails). Por qué la YouTube Data API oficial y no otra fuente: docs/carruseles/thumbnails.md.
--
-- Dos tablas GLOBALES, como las de la biblioteca de carruseles (0392): las llena la PC con la clave de YouTube de la plataforma
-- (scripts/thumbnails-biblioteca.mts) y la ven todos los negocios. Sin `workspace_id`, RLS sin políticas y sin permisos para la
-- clave pública: el servidor lee con service_role.
--   · `thumbnails_canales`: los canales por rubro de dueño de negocio (ventas, marketing, emprendimiento, servicios) e idioma.
--   · `thumbnails_videos`: sus videos largos con sus vistas. La IMAGEN no se guarda: se dibuja la de i.ytimg.com del video.
--
-- ⚠️ TREINTA DÍAS: sin la enmienda III.L de YouTube, lo que se guarda de la API vence a los 30 días. La pantalla no muestra lo
-- leído hace más (`leido_en`) y el script lo borra (`podar`). El múltiplo se calcula al mostrar y sólo con la enmienda
-- (lib/thumbnails/explorar.ts).
--
-- ORDEN DE DESPLIEGUE: indiferente. El código tolera que falten las tablas (la pestaña dice que todavía no hay miniaturas).
-- =============================================================================
begin;

create table if not exists thumbnails_canales (
  id          bigserial   primary key,
  -- El id del canal en YouTube (`UC…`): un canal, una fila, venga por donde venga.
  canal_id    text        not null,
  nombre      text        not null,
  -- Su @ («@alexhormozi»), si tiene.
  handle      text,
  -- La foto del canal (`snippet.thumbnails`): se dibuja la de YouTube.
  foto        text,
  nicho       text        not null,
  idioma      text        not null,
  -- 'busqueda': apareció buscando su rubro; 'lista': lo sumó la plataforma a mano.
  fuente      text        not null default 'busqueda',
  estado      text        not null default 'activo',
  -- Por qué salió (no sirve a dueños de negocio, lo pidió el canal). Sólo con `estado = 'excluido'`.
  motivo      text,
  leido_en    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint thumbnails_canales_id check (canal_id ~ '^UC[A-Za-z0-9_-]{20,}$'),
  constraint thumbnails_canales_nombre check (char_length(nombre) between 1 and 120),
  constraint thumbnails_canales_handle check (handle is null or char_length(handle) <= 60),
  constraint thumbnails_canales_nicho check (nicho in ('ventas', 'marketing', 'emprendimiento', 'servicios')),
  constraint thumbnails_canales_idioma check (idioma in ('es', 'en', 'pt')),
  constraint thumbnails_canales_fuente check (fuente in ('busqueda', 'lista')),
  constraint thumbnails_canales_estado check (estado in ('activo', 'excluido')),
  constraint thumbnails_canales_motivo check (motivo is null or char_length(motivo) <= 300)
);
create unique index if not exists thumbnails_canales_canal_uq on thumbnails_canales (canal_id);

comment on table thumbnails_canales is
  'Los canales de YouTube de la biblioteca de miniaturas de Image, por rubro e idioma. Global. Lo puro: lib/thumbnails/explorar.ts.';

create table if not exists thumbnails_videos (
  id           bigserial   primary key,
  -- El id del video en YouTube (11 caracteres): un video, una fila.
  video_id     text        not null,
  -- Su canal. Sacarlo de la biblioteca (borrar la fila) borra sus videos.
  canal_id     bigint      not null references thumbnails_canales (id) on delete cascade,
  -- El título: dato de la API, vence a los 30 días como todo lo demás.
  titulo       text,
  publicado_en timestamptz,
  -- ISO 8601 (`PT12M4S`), como lo da la API.
  duracion     text,
  vistas       bigint,
  megusta      bigint,
  comentarios  bigint,
  -- Cuándo se leyó de la API: lo de hace más de 30 días no se muestra y se borra.
  leido_en     timestamptz not null default now(),
  -- Escondido a mano (no sirve a dueños de negocio): no se muestra, y el script no lo vuelve a mostrar al releer.
  oculto       boolean     not null default false,
  created_at   timestamptz not null default now(),
  constraint thumbnails_videos_id check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  constraint thumbnails_videos_titulo check (titulo is null or char_length(titulo) <= 300),
  constraint thumbnails_videos_duracion check (duracion is null or char_length(duracion) <= 20)
);
create unique index if not exists thumbnails_videos_video_uq on thumbnails_videos (video_id);
create index if not exists thumbnails_videos_canal_idx on thumbnails_videos (canal_id);
create index if not exists thumbnails_videos_leido_idx on thumbnails_videos (leido_en);

comment on table thumbnails_videos is
  'Los videos largos de los canales de la biblioteca de miniaturas (Image). Global. La imagen se dibuja de i.ytimg.com; lo de la API vence a los 30 días.';

alter table thumbnails_canales enable row level security;
alter table thumbnails_videos enable row level security;
revoke all on thumbnails_canales from anon, authenticated;
revoke all on thumbnails_videos from anon, authenticated;
revoke all on sequence thumbnails_canales_id_seq from anon, authenticated;
revoke all on sequence thumbnails_videos_id_seq from anon, authenticated;

commit;
