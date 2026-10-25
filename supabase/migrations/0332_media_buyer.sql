-- =============================================================================
-- 0332 · El Media Buyer de MaKo: la configuración por negocio y el registro de cada decisión (25/10/2026)
-- =============================================================================
-- Martín, 25/10/2026: reemplazar el Ads Manager por un media buyer de IA que suba y baje presupuesto, prenda y
-- apague campañas, conjuntos y anuncios y cree variaciones, con «cada decisión registrada con su porqué, los
-- números que la dispararon y un botón para deshacerla», modos por negocio (piloto automático / propone y
-- apruebo) y topes (subida por día, gasto máximo, interruptor). Copiado de Madgicx AI Marketer
-- (docs/media-buyer/referencia.md). El código: lib/media-buyer/*.
--
-- ORDEN: ANTES o JUNTO con el deploy. Sólo AGREGA dos tablas nuevas que nadie leía. El código nuevo las aguanta
-- ausentes (lib/media-buyer/store.ts, «FALTA LA MIG 0332»): la pantalla dice que el registro todavía no está y el
-- cron no lanza nada, porque sin registro no se puede deshacer.
-- Número pedido al Cerebro el 25/10/2026. Se aplica después de su revisión (AGENTS.md).
-- =============================================================================

begin;

-- Una fila por negocio. Sin fila = los valores por defecto de lib/media-buyer/tipos.ts (CONFIG_POR_DEFECTO): el Media
-- Buyer APAGADO y, prendido, en «propone». El piloto automático lo prende cada negocio (nunca MaKo por él).
create table if not exists media_buyer_config (
  workspace_id        bigint primary key references workspaces(id) on delete cascade,
  encendido           boolean not null default false,
  modo                text not null default 'propone' check (modo in ('propone', 'piloto')),
  kpi                 text not null default 'lead' check (kpi in ('lead', 'agenda', 'venta')),
  -- En la unidad del gasto (dólares si la cuenta convierte). null = lo recomienda MaKo con los datos de la cuenta.
  objetivo            numeric check (objetivo is null or objetivo > 0),
  subida_max_pct_dia  numeric not null default 20 check (subida_max_pct_dia >= 0 and subida_max_pct_dia <= 100),
  presupuesto_max_dia numeric check (presupuesto_max_dia is null or presupuesto_max_dia > 0),
  meta_ventas_mes     numeric check (meta_ventas_mes is null or meta_ventas_mes > 0),
  meta_gasto_mes      numeric check (meta_gasto_mes is null or meta_gasto_mes > 0),
  -- La cuenta publicitaria que opera, SÓLO si el negocio no la tiene en Integraciones (META_AD_ACCOUNT_ID manda): la de MaKo
  -- se opera por la Zernio de la plataforma y no tiene esa credencial.
  cuenta_publicitaria text check (cuenta_publicitaria is null or cuenta_publicitaria ~ '^act_[0-9]{5,25}$'),
  -- La última vez que el agente miró la cuenta, y qué pasó (cuántas propuso, cuántas lanzó, qué falló).
  ultima_corrida      timestamptz,
  ultima_corrida_info jsonb,
  updated_at          timestamptz not null default now(),
  updated_by          text
);

create table if not exists media_buyer_decisiones (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    bigint not null references workspaces(id) on delete cascade,
  -- táctica:nivel:entidad:día — el motor puede correr dos veces el mismo día sin duplicar.
  clave           text not null check (char_length(clave) between 3 and 200),
  creada          timestamptz not null default now(),
  tipo            text not null check (tipo in ('subir_presupuesto', 'bajar_presupuesto', 'pausar', 'activar', 'variaciones_texto', 'variaciones_hook')),
  tactica         text not null check (tactica in ('surf', 'sunsetting', 'stop_loss', 'revive', 'calidad', 'ganador')),
  nivel           text not null check (nivel in ('campaign', 'adset', 'ad')),
  entidad_id      text not null check (entidad_id ~ '^[0-9]{1,30}$'),
  entidad_nombre  text not null,
  campana_nombre  text,
  titulo          text not null,
  titular         text not null,
  porque          jsonb not null default '[]'::jsonb,
  numeros         jsonb not null default '[]'::jsonb,
  -- El estado de la entidad antes y después. El presupuesto, en la moneda de la CUENTA (lo que va a Meta).
  antes           jsonb not null default '{}'::jsonb,
  despues         jsonb not null default '{}'::jsonb,
  anuncio_base    jsonb,
  variaciones     jsonb,
  moneda          text,
  estado          text not null default 'abierta' check (estado in ('abierta', 'aplicada', 'descartada', 'deshecha', 'fallida', 'vencida', 'bloqueada')),
  origen          text check (origen is null or origen in ('piloto', 'persona')),
  aplicada_por    text,
  aplicada_at     timestamptz,
  deshecha_por    text,
  deshecha_at     timestamptz,
  canal           text check (canal is null or canal in ('zernio', 'meta')),
  error           text,
  -- Lo que conviene saber de cómo se aplicó (un tope que recortó, «se crearon 2 de 3»). No es un error.
  nota            text,
  motivo_descarte text,
  estrellas       smallint check (estrellas is null or estrellas between 1 and 5),
  -- Los anuncios que creó una variación al lanzarse (ids de Meta), para poder deshacerla.
  creados         jsonb not null default '[]'::jsonb,
  unique (workspace_id, clave)
);
create index if not exists media_buyer_decisiones_ws_idx on media_buyer_decisiones (workspace_id, creada desc);
create index if not exists media_buyer_decisiones_abiertas_idx on media_buyer_decisiones (workspace_id) where estado = 'abierta';

alter table media_buyer_config enable row level security;
alter table media_buyer_decisiones enable row level security;
revoke all on media_buyer_config from anon, authenticated;
revoke all on media_buyer_decisiones from anon, authenticated;

commit;
