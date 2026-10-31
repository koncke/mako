-- =============================================================================
-- 0359 — Competitors Spy: el competidor que el negocio vigila, y cada pieza que se le vio
-- =============================================================================
-- ORDEN DE DESPLIEGUE: ANTES del deploy (aditiva: dos tablas nuevas, nada se toca).
--
-- El plan está en docs/diseno-competitors-spy.md y las trampas de cada fuente en
-- docs/hallazgos-competitors-spy.md. Las reglas que gobiernan estas columnas viven en
-- lib/spy-reglas.ts, y el que las lee y escribe es lib/spy.ts.
--
-- DOS tablas:
--   · `spy_competidores` — UNO por competidor que vigila un negocio, con sus canales (el @ de
--     Instagram, el canal de YouTube, la landing, la página de anuncios).
--   · `spy_piezas` — UNA por pieza vista (un anuncio, un reel, una publicación, un video, una
--     versión de landing), con `visto_primera_vez` y `visto_ultima_vez`.
--
-- ⚠️ `visto_primera_vez` ES EL PRODUCTO. Lo que MaKo agrega sobre abrir la Biblioteca de Anuncios
-- o el perfil a mano es UNA cosa, y es la historia: a mano se ve qué corre hoy; con una foto por
-- día se puede decir DESDE CUÁNDO. Un anuncio que lleva 90 días es el que le funciona; uno de ayer
-- es un test. Ese dato no existe en ninguna pantalla de Meta —hay que haberlo estado mirando— y es
-- el que decide qué copiar.
--
-- ⚠️⚠️ LAS DOS RETENCIONES VAN EN COLUMNAS SEPARADAS, Y ES LA DECISIÓN MÁS IMPORTANTE DE ESTA
-- MIGRACIÓN. Los Developer Policies de YouTube (III.E.4.b) dicen que los datos de un tercero son
-- «Non-Authorized Data» y no se guardan más de 30 días. La enmienda III.L («Analytics &
-- Reporting», del 1/6/2026) sube las MÉTRICAS a 36 meses y deja el resto donde estaba, textual:
-- «Other data (such as video titles, creator names, descriptions, and comment text) must still
-- follow the 30-day refresh and deletion policy».
--   · `metricas_leidas_en` → el reloj de vistas, «me gusta», comentarios y suscriptores.
--   · `texto_leido_en`     → el reloj de títulos, descripciones, copy y nombres.
-- Si nacieran en la MISMA columna, después es una migración — y mientras tanto, o se borra una
-- métrica que se podía guardar tres años, o se guarda tres años un título que había que borrar en
-- 30 días. La poda la hace quien lee (lib/spy-reglas.ts: `textoVencido`, `metricasVencidas`).
--
-- ⚠️ NO HAY COLUMNA PARA LA FOTO DE PERFIL, a propósito. `profile_picture_url` de Instagram es una
-- URL del CDN de Meta que VENCE: sirve para dibujar una lista, nunca para guardar. Persistirla
-- produce avatares rotos semanas después, que es un defecto que Martín ya marcó dos veces. No
-- tener la columna es más fuerte que acordarse, y tests/spy-reglas.test.ts lo afirma sobre este
-- archivo: agregarla pone el test en rojo.
--
-- ⚠️ NINGÚN CONTADOR LLEVA `default 0`, y es la regla más fácil de romper de las dos tablas. El
-- dueño de una cuenta de Instagram puede ocultar likes, comentarios y vistas UNO POR UNO, y
-- entonces Meta OMITE el campo; `dislikeCount` de YouTube es privado desde el 13/12/2021 y tampoco
-- devuelve 0 (no devuelve el campo). Un `default 0` muestra «0 me gusta» sobre una publicación con
-- miles. `null` es «no lo publica» y es un dato distinto de cero.
--
-- ⚠️ `gasto_tramo` E `impresiones_tramo` SON TEXTO, no números. `spend` e `impressions` de la Ad
-- Library vuelven como tramos (`<100`, `1K-5K`, `>1M`): no se suman, no se promedian y se muestran
-- como tramo. Una columna `numeric` acá obligaría a coaccionar, y `parseInt('1K-5K')` es `1` — un
-- número que nos inventamos nosotros. Se leen con `leerTramo` (lib/spy-reglas.ts).
--
-- ⚠️ Y VA A DOS REGISTROS DEL CÓDIGO (el compilador no ve ninguno): `TENANT_TABLES`
-- (lib/workspace.ts) y `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts). Sin la primera,
-- `getTenantDb()` es PASSTHROUGH y la lista de competidores de un negocio muestra la de TODOS.
--
-- Si llega DESPUÉS del deploy: la pantalla y el área `spy` de la API contestan «todavía no está
-- lista la tabla de competidores» (lib/spy.ts lo detecta por el código 42P01 de Postgres) y no se
-- pierde nada. La tab sigue abriendo su onboarding.
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- El competidor que vigila un negocio
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists spy_competidores (
  id                  bigint generated always as identity primary key,
  workspace_id        bigint not null references workspaces(id) on delete cascade,
  -- El nombre que le puso el negocio. Es de ÉL: no se sobrescribe con el que diga una API.
  nombre              text not null check (char_length(nombre) between 1 and 120),
  -- Los canales. Todos opcionales: se agrega un competidor con UN dato (un @, un link) y los demás
  -- se completan después. `instagram` va sin @ y en minúscula; `youtube_id` es el `UC…` del canal.
  instagram           text check (instagram is null or char_length(instagram) between 1 and 200),
  youtube_id          text check (youtube_id is null or char_length(youtube_id) between 1 and 200),
  landing_url         text check (landing_url is null or char_length(landing_url) between 1 and 500),
  -- La Página de Facebook del competidor, para la Biblioteca de Anuncios. Guardarla no promete
  -- anuncios: fuera de la Unión Europea y el Reino Unido la Ad Library devuelve sólo política
  -- (lib/spy-reglas.ts: `adLibraryCubreComercial`).
  pagina_anuncios     text check (pagina_anuncios is null or char_length(pagina_anuncios) between 1 and 200),
  -- El país en que se lo mira, en ISO-2. Decide si se le pueden prometer anuncios o no.
  pais                text check (pais is null or char_length(pais) = 2),
  -- Lo que concluyó el analista sobre su oferta: qué promete, a quién, qué objeción ataca. Es el
  -- bloque que justifica la tab, y es TEXTO de un tercero: su reloj es `texto_leido_en`.
  oferta              jsonb,
  -- Cuándo se lo miró por última vez, y hasta cuándo valen las dos clases de dato que guardamos.
  mirado_en           timestamptz,
  texto_leido_en      timestamptz,
  metricas_leidas_en  timestamptz,
  -- Las cifras del perfil. Sin `default 0`: `null` es «no lo publica».
  instagram_seguidores  integer check (instagram_seguidores is null or instagram_seguidores >= 0),
  youtube_suscriptores  integer check (youtube_suscriptores is null or youtube_suscriptores >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Un negocio no mira dos veces al mismo competidor con el mismo nombre.
  unique (workspace_id, nombre)
);

create index if not exists spy_competidores_ws_mirado on spy_competidores (workspace_id, mirado_en desc nulls last);

alter table spy_competidores enable row level security;
revoke all on spy_competidores from anon, authenticated;

comment on table spy_competidores is
  'Competitors Spy: un competidor que vigila un negocio, con sus canales (Instagram, YouTube, landing, Página de anuncios). SIN columna para la foto de perfil: la URL del CDN de Meta vence y no se guarda. Dos relojes de retención separados (texto 30 dias, metricas 36 meses con la enmienda III.L de YouTube). Por negocio. lib/spy.ts; docs/diseno-competitors-spy.md.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Cada pieza que se le vio: un anuncio, un reel, una publicación, un video, una landing
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists spy_piezas (
  id                  bigint generated always as identity primary key,
  workspace_id        bigint not null references workspaces(id) on delete cascade,
  competidor_id       bigint not null references spy_competidores(id) on delete cascade,
  -- De qué canal salió y qué es: lib/spy-reglas.ts (`CANALES_SPY`, `TIPOS_PIEZA`).
  canal               text not null check (canal in ('instagram', 'youtube', 'landing', 'anuncios')),
  tipo                text not null check (tipo in ('anuncio', 'reel', 'publicacion', 'video', 'landing')),
  -- La identidad de la pieza EN SU FUENTE: el id del video, el shortcode de la publicación, el
  -- Library ID del anuncio, la URL de la landing. Es la llave contra el duplicado.
  ref                 text not null check (char_length(ref) between 1 and 200),
  -- De dónde salió el dato (lib/spy-reglas.ts: `FUENTES_PIEZA`). No es una nota al pie: un anuncio
  -- que pegó la persona y uno que leyó un recorrido guiado no tienen el mismo respaldo, y la ficha
  -- lo dice. Hoy ninguna pieza entra como 'recorrido' (es la Etapa 4, y la decide Martín).
  fuente              text not null check (fuente in ('api', 'pagina', 'pegado', 'recorrido')),
  url                 text check (url is null or char_length(url) between 1 and 1000),

  -- ── TEXTO (retención: 30 días SIEMPRE; reloj `texto_leido_en`) ──────────────
  titulo              text check (titulo is null or char_length(titulo) <= 300),
  texto               text check (texto is null or char_length(texto) <= 4000),
  -- Las etiquetas de un video de YouTube: vienen por `videos.list` y por ningún otro endpoint.
  etiquetas           text[],
  -- Lo que concluyó el analista: el gancho, el ángulo, la objeción. Vocabulario compartido con el
  -- Ads Analyst (lib/ads-analyst-vocabulario.ts), no uno propio que se separe solo.
  analisis            jsonb,
  texto_leido_en      timestamptz,

  -- ── MÉTRICAS (retención: 36 meses con la enmienda III.L; reloj `metricas_leidas_en`) ───
  -- Ni una con `default 0`: ausente es «no lo publica», que no es cero.
  vistas              bigint  check (vistas is null or vistas >= 0),
  megusta             bigint  check (megusta is null or megusta >= 0),
  comentarios         bigint  check (comentarios is null or comentarios >= 0),
  -- Sin `no_megusta`: YouTube no lo devuelve desde el 13/12/2021 y una columna vacía invita a un
  -- `?? 0` que inventa el dato.
  duracion            text    check (duracion is null or char_length(duracion) <= 20),
  metricas_leidas_en  timestamptz,

  -- ── LOS TRAMOS DE LA AD LIBRARY: TEXTO, nunca números ──────────────────────
  -- `spend` e `impressions` vuelven como `<100`, `1K-5K`, `>1M`. Se guardan tal cual y se muestran
  -- tal cual. Y la doc de Meta se saltea el tramo 500K–1M, así que la lista de tramos documentada
  -- no es la lista que la API devuelve: por eso es `text` libre y no un enum.
  gasto_tramo         text check (gasto_tramo is null or char_length(gasto_tramo) <= 40),
  impresiones_tramo   text check (impresiones_tramo is null or char_length(impresiones_tramo) <= 40),
  -- Las plataformas donde corre el anuncio (`publisher_platforms`) y su destino.
  plataformas         text[],
  dominio_destino     text check (dominio_destino is null or char_length(dominio_destino) <= 200),

  -- ── LA HISTORIA: es para esto que existe la tabla ──────────────────────────
  -- La fecha que DECLARA la fuente (`ad_delivery_start_time`, `timestamp`, `publishedAt`). Puede
  -- ser null: una pieza sin fecha declarada no tiene etapa de tendencia, y eso NO es «test nuevo».
  publicada_en        timestamptz,
  visto_primera_vez   timestamptz not null default now(),
  visto_ultima_vez    timestamptz not null default now(),
  -- Cuándo dejó de verse. Null = sigue a la vista. Es lo que convierte la lista en una línea de
  -- tiempo, y lo que distingue «lo bajó» de «no pudimos leer» (eso último NO escribe acá).
  dejo_de_verse_en    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- La misma pieza del mismo competidor se ACTUALIZA, no se duplica. El `workspace_id` entra en la
  -- llave: es lo que hace que el upsert de un negocio no toque la fila de otro.
  unique (workspace_id, competidor_id, canal, ref)
);

create index if not exists spy_piezas_ws_competidor on spy_piezas (workspace_id, competidor_id, visto_ultima_vez desc);
create index if not exists spy_piezas_ws_vistas on spy_piezas (workspace_id, canal, visto_primera_vez desc);

alter table spy_piezas enable row level security;
revoke all on spy_piezas from anon, authenticated;

comment on table spy_piezas is
  'Competitors Spy: una pieza vista de un competidor (anuncio, reel, publicacion, video, version de landing), con visto_primera_vez — el dato que no existe en ninguna pantalla de Meta y el que decide que copiar. Texto y metricas con relojes de retencion SEPARADOS. gasto_tramo e impresiones_tramo son TEXTO: la Ad Library devuelve tramos, no numeros. Ningun contador con default 0: ausente es «no lo publica». Por negocio. lib/spy.ts; docs/diseno-competitors-spy.md.';

commit;
