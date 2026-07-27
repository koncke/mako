-- =============================================================================
-- 0098 — "Branding MaKo": catálogo de material de marca + links para compartir
-- =============================================================================
-- Dos cosas independientes que viajan juntas porque nacen del mismo pedido:
--
-- 1) branding_assets: el CATÁLOGO del material (gráficos, animaciones, íconos,
--    videos). Los bytes viven en el bucket privado `branding`; acá solo la ficha.
--    Está en el catálogo y no hardcodeado en un .ts para que sumar material sea
--    correr un script y NO un deploy (cada push a Vercel cuesta ~US$0.09).
--
-- 2) shares: el mecanismo GENÉRICO de "compartí esto por link, sin login". Nace
--    para branding (recurso='branding') pero se reusa para cualquier cosa, por
--    la regla del proyecto de que nada sea owner-only.
--
-- ⚠️ `shares` NO va en TENANT_TABLES a propósito: la resolución token→workspace
-- es cross-workspace por diseño. Si el proxy le inyectara .eq('workspace_id'),
-- en el contexto público (que cae al ws del dueño) todo link que no fuera del
-- dueño devolvería 0 filas y el feature moriría en silencio, sin error visible.

begin;

-- ── Bucket privado para el material de marca ────────────────────────────────
-- file_size_limit EXPLÍCITO (200 MB): los otros buckets lo tienen en NULL y
-- heredan el global; acá entran .mov de marca que pesan.
insert into storage.buckets (id, name, public, file_size_limit)
values ('branding', 'branding', false, 209715200)
on conflict (id) do nothing;

-- ── 1. Catálogo del material ────────────────────────────────────────────────
create table if not exists branding_assets (
  id            text        not null,
  workspace_id  bigint      not null default 1 references workspaces(id) on delete cascade,
  seccion       text        not null check (seccion in ('graficos', 'animaciones', 'iconos', 'videos')),
  grupo         text        not null,              -- feature (crm, semaforo…) o subcarpeta
  archivo       text        not null,              -- nombre real, el que baja el usuario
  titulo        text        not null,
  mime          text        not null,
  bytes         bigint      not null default 0,
  ancho         int,
  alto          int,
  storage_path  text        not null,              -- ruta dentro del bucket `branding`
  thumb_path    text,                              -- miniatura (los PNG pesan 39 MB en total)
  panda_embed   text,                              -- para los videos: se VEN por Panda
  orden         int         not null default 0,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, id)
);
create index if not exists branding_assets_ws_idx on branding_assets (workspace_id);
create index if not exists branding_assets_nav_idx on branding_assets (workspace_id, seccion, grupo, orden);
alter table branding_assets enable row level security;   -- sin políticas: solo service_role

-- ── 2. Links para compartir (genérico y reusable) ───────────────────────────
create table if not exists shares (
  id            bigint generated always as identity primary key,
  workspace_id  bigint      not null default 1 references workspaces(id) on delete cascade,
  recurso       text        not null,              -- 'branding' (mañana: 'retro', 'reporte'…)
  alcance       text        not null check (alcance in ('todo', 'seccion', 'grupo', 'item')),
  recurso_id    text,                              -- qué sección/grupo/item, según el alcance
  -- Del token se guarda SOLO el sha256: un dump de la base no entrega los links vivos.
  token_hash    text        not null,
  token_prefijo text        not null,              -- primeros caracteres, para reconocerlo en la lista
  etiqueta      text,
  expira_at     timestamptz,
  revocado_at   timestamptz,
  creado_por    text,
  visitas       int         not null default 0,
  ultima_visita timestamptz,
  created_at    timestamptz not null default now()
);
-- ÚNICO y GLOBAL (no por workspace): el token se resuelve sin saber de qué ws es.
create unique index if not exists shares_token_hash_idx on shares (token_hash);
create index if not exists shares_ws_recurso_idx on shares (workspace_id, recurso, created_at desc);
alter table shares enable row level security;             -- sin políticas: solo service_role

commit;

notify pgrst, 'reload schema';
