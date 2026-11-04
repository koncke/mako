-- =============================================================================
-- 0392 — La biblioteca de carruseles de ejemplo, compartida por todos los negocios
-- =============================================================================
-- Pedido de Martín (por el Cerebro, 4/11/2026): que el explorador de carruseles de Image («Carruseles que funcionan»,
-- `/image-editor?ver=carruseles`) arranque con una base real de ejemplos, aunque el negocio no siga a nadie en
-- Competitors Spy. Se SUMA a lo de las cuentas que sigue cada negocio (eso no cambia).
--
-- DE DÓNDE: Instagram directo, con la MISMA lectura de Spy (el actor `apify~instagram-scraper`, lib/spy-todo-reglas.ts), por
-- un script que corre en la PC (scripts/carruseles-biblioteca.mts) con techo de gasto. Dos fuentes:
--   · una LISTA de cuentas que elige la plataforma (para arrancar, los referentes del Ops Center con Instagram);
--   · TEMAS: hashtags pensados para los negocios de MaKo, de donde se toman sólo los carruseles que mejor rinden.
-- NUNCA de otra biblioteca de carruseles (ni topcarousels.com ni su lista de cuentas). Se muestran como en Spy: públicos,
-- con el @ del creador y el link al original (decisión de Martín, 4/11/2026).
--
-- ⚠️ GLOBAL A PROPÓSITO, COMO `spy_lecturas_canal` (0363): no lleva `workspace_id` y NO va en `TENANT_TABLES`
-- (lib/workspace.ts). La edita la plataforma y la ven todos; ningún negocio escribe acá. Lo que cada negocio guarda de la
-- biblioteca (sus marcadores) sigue en SU setting `carruseles.guardados`, con el id en negativo (lib/carruseles/biblioteca.ts).
--
-- ⚠️ TODO CREADOR TIENE SU FILA en `carruseles_biblioteca_cuentas`, también el que apareció por un hashtag (`fuente =
-- 'tema'`): así «sacar a un creador que lo pide» es UNA fila (`estado = 'excluida'`) que vale para las dos fuentes, sus
-- publicaciones se borran, no vuelve a leerse y no sale en ningún negocio. La fila queda con el motivo para que nadie lo
-- vuelva a sumar sin querer.
--
-- ⚠️ UNA PUBLICACIÓN ES UNA FILA (`ref` único): la misma que llega por la lista y por un hashtag no se repite.
--
-- RLS prendida y sin políticas, y sin permisos para la clave pública: sólo el service role (la app y el script).
--
-- ORDEN DE DESPLIEGUE: indiferente. El código tolera que las tablas no existan (42P01 / PGRST205): sin ellas, el explorador
-- muestra sólo lo de las cuentas de cada negocio, como antes, y el script lo dice ANTES de gastar.
-- =============================================================================
begin;

create table if not exists carruseles_biblioteca_cuentas (
  id           bigserial   primary key,
  -- El @ sin arroba y en minúscula (como lo normaliza `usuarioInstagram`, app/crm/campo-inline.ts).
  instagram    text        not null,
  -- Como se lo nombra en la pantalla («Alex Hormozi»); de uno que llegó por un hashtag, el nombre de su perfil o su @.
  nombre       text        not null,
  -- 'lista': la eligió la plataforma y se lee entera (con su outlier). 'tema': apareció por un hashtag y no se lee sola.
  fuente       text        not null default 'lista',
  -- El id del referente del Ops Center (lib/asesores/catalogo.ts), si es uno de ellos.
  referente    text,
  estado       text        not null default 'activa',
  -- Por qué salió (lo pidió el creador, otro motivo). Sólo con `estado = 'excluida'`.
  motivo       text,
  -- Quién la sumó o la cambió por última vez (un email, o «script»).
  cambiada_por text,
  foto         text,
  leida_en     timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint carruseles_biblioteca_cuentas_ig check (instagram ~ '^[a-z0-9._]{1,30}$'),
  constraint carruseles_biblioteca_cuentas_nombre check (char_length(nombre) between 1 and 120),
  constraint carruseles_biblioteca_cuentas_fuente check (fuente in ('lista', 'tema')),
  constraint carruseles_biblioteca_cuentas_estado check (estado in ('activa', 'excluida')),
  constraint carruseles_biblioteca_cuentas_motivo check (motivo is null or char_length(motivo) <= 300)
);
create unique index if not exists carruseles_biblioteca_cuentas_ig_uq on carruseles_biblioteca_cuentas (instagram);

comment on table carruseles_biblioteca_cuentas is
  'Los creadores de la biblioteca de carruseles de ejemplo (Image): la lista que elige la plataforma y los que llegaron por un tema. Global. Lo puro: lib/carruseles/biblioteca.ts.';

create table if not exists carruseles_biblioteca_temas (
  id           bigserial   primary key,
  -- El hashtag sin # y en minúscula.
  hashtag      text        not null,
  -- Como se lo nombra en la pantalla («Marketing digital»).
  nombre       text        not null,
  activo       boolean     not null default true,
  cambiado_por text,
  leido_en     timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint carruseles_biblioteca_temas_tag check (hashtag ~ '^[a-z0-9_ñáéíóúü]{2,60}$'),
  constraint carruseles_biblioteca_temas_nombre check (char_length(nombre) between 1 and 80)
);
create unique index if not exists carruseles_biblioteca_temas_tag_uq on carruseles_biblioteca_temas (hashtag);

comment on table carruseles_biblioteca_temas is
  'Los temas (hashtags) de donde la biblioteca de carruseles toma los que mejor rinden. Global; los edita la plataforma.';

create table if not exists carruseles_biblioteca_piezas (
  id                  bigserial   primary key,
  -- El shortcode de la publicación: una publicación, una fila, venga por donde venga.
  ref                 text        not null,
  -- Su creador. Sacarlo de la biblioteca borra sus publicaciones (on delete cascade si se borrara la fila).
  cuenta_id           bigint      not null references carruseles_biblioteca_cuentas (id) on delete cascade,
  -- Por qué tema llegó (null = por la lista).
  tema_id             bigint      references carruseles_biblioteca_temas (id) on delete set null,
  url                 text,
  -- Ya bajada a nuestro bucket (lib/spy-miniaturas.ts): la del CDN de Instagram vence y da 403 desde otro dominio.
  miniatura           text,
  -- El pie. Vence a los 30 días como en Spy (`podarVencido`, lib/spy-reglas.ts): por eso lo que se lee de él (su tipo y
  -- qué pide al final) se guarda aparte, al leerlo.
  texto               text,
  texto_leido_en      timestamptz,
  formato             text,
  cierre              text,
  medio               text,
  laminas             smallint,
  megusta             integer,
  comentarios         integer,
  vistas              integer,
  metricas_leidas_en  timestamptz,
  publicada_en        timestamptz,
  visto_primera_vez   timestamptz not null default now(),
  dejo_de_verse_en    timestamptz,
  constraint carruseles_biblioteca_piezas_ref check (char_length(ref) between 1 and 80),
  constraint carruseles_biblioteca_piezas_medio check (medio is null or medio in ('carrusel', 'imagen', 'video')),
  constraint carruseles_biblioteca_piezas_laminas check (laminas is null or laminas between 2 and 20),
  constraint carruseles_biblioteca_piezas_formato check (formato is null or char_length(formato) <= 40),
  constraint carruseles_biblioteca_piezas_cierre check (cierre is null or char_length(cierre) <= 20)
);
create unique index if not exists carruseles_biblioteca_piezas_ref_uq on carruseles_biblioteca_piezas (ref);
create index if not exists carruseles_biblioteca_piezas_cuenta_idx on carruseles_biblioteca_piezas (cuenta_id);

comment on table carruseles_biblioteca_piezas is
  'Las publicaciones de la biblioteca de carruseles (Image). Global, como su creador. El texto vence a los 30 días; su tipo y su cierre quedan.';

alter table carruseles_biblioteca_cuentas enable row level security;
alter table carruseles_biblioteca_temas enable row level security;
alter table carruseles_biblioteca_piezas enable row level security;
revoke all on carruseles_biblioteca_cuentas from anon, authenticated;
revoke all on carruseles_biblioteca_temas from anon, authenticated;
revoke all on carruseles_biblioteca_piezas from anon, authenticated;
revoke all on sequence carruseles_biblioteca_cuentas_id_seq from anon, authenticated;
revoke all on sequence carruseles_biblioteca_temas_id_seq from anon, authenticated;
revoke all on sequence carruseles_biblioteca_piezas_id_seq from anon, authenticated;

commit;
