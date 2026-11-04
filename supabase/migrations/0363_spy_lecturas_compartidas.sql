-- =============================================================================
-- 0363 — Lo leído de un canal público se comparte entre negocios
-- =============================================================================
-- Martín, 2/11/2026: «súper importante que esta tab sea compartida por todos los usuarios. No tiene
-- sentido de que uno analice a Alex Hormozi y luego otro también vuelva a analizar al mismo».
--
-- SE COMPARTE LO CARO, NO LO PRIVADO. Lo que sale plata es LEER un canal público: una lectura de
-- Instagram gasta del tope diario de Apify del negocio, y una de YouTube gasta cuota de la API.
-- Ese resultado es el mismo para cualquiera que mire a esa persona, porque el canal es público.
--
-- ⚠️ A QUIÉN MIRA CADA NEGOCIO SIGUE SIENDO SUYO, y por eso esta tabla NO reemplaza a `spy_piezas`.
-- La lista de competidores y las piezas de cada negocio siguen en sus tablas, con `workspace_id` y
-- su borrado de siempre. Acá sólo vive el RESULTADO de la lectura, indexado por el canal — nunca
-- quién lo pidió. Si se guardara el workspace, esta tabla diría a quién vigila cada negocio, que es
-- exactamente el dato que no se comparte.
--
-- ⚠️ POR QUÉ NO LLEVA `workspace_id` (y todo el resto del esquema sí): es una tabla GLOBAL a
-- propósito. `lib/workspace.ts` ya tiene ese concepto —`TENANT_TABLES` scopea las de cliente y las
-- demás pasan sin tocar—, así que **esta tabla NO se agrega a esa lista**. Sumarla la rompería: el
-- proxy le estamparía un workspace que la columna no tiene.
--
-- ⚠️ RLS PRENDIDA Y SIN POLÍTICAS, igual que `spy_competidores` y `spy_piezas` (0359): nadie la
-- toca con la clave pública; sólo el service role, que es la app. La frontera entre negocios la
-- pone la app, no esta tabla — y acá no hay frontera que poner, porque el dato es público.
-- =============================================================================
begin;

create table if not exists spy_lecturas_canal (
  -- 'instagram' | 'youtube' | 'landing' — el mismo vocabulario que `spy_piezas.canal`.
  canal        text        not null,
  -- El @ de Instagram, el id del canal de YouTube o el dominio. Lo que identifica al canal
  -- PÚBLICO, no al competidor: dos negocios que miran a la misma persona caen en la misma fila.
  ref          text        not null,
  leido_en     timestamptz not null default now(),
  -- Las piezas tal como las devolvió el lector (`PiezaVista[]`), listas para copiar a `spy_piezas`.
  piezas       jsonb       not null default '[]'::jsonb,
  -- Seguidores, suscriptores y la foto ya bajada. Lo que la ficha muestra arriba.
  perfil       jsonb,
  -- Cuántas veces se sirvió sin pagar una lectura. Es la medida de si esto sirve: si queda en cero,
  -- nadie mira a los mismos y la tabla no se gana el lugar.
  ahorros      integer     not null default 0,
  primary key (canal, ref),
  constraint spy_lecturas_canal_ref_corto check (char_length(ref) <= 200),
  constraint spy_lecturas_canal_canal_conocido check (canal in ('instagram', 'youtube', 'landing', 'anuncios'))
);

comment on table spy_lecturas_canal is
  'Lo LEÍDO de un canal público, compartido entre negocios. No dice quién lo pidió: a quién mira cada negocio vive en spy_competidores, con su workspace_id. Global a propósito: NO va en TENANT_TABLES (lib/workspace.ts).';

-- Para la poda: lo viejo se borra por fecha, no por canal.
create index if not exists spy_lecturas_canal_leido_idx on spy_lecturas_canal (leido_en desc);

alter table spy_lecturas_canal enable row level security;

commit;
