-- =============================================================================
-- 0093_plan_board — el tablero /plan del dueño pasa de localStorage a Supabase
-- =============================================================================
-- El board del super-admin (/plan) vivía en localStorage del navegador: el server
-- no lo veía, no era multi-dispositivo, y MaKo lo tocaba por un parche (bandeja +
-- ops + snapshot). Acá se lleva a la base, con SU modelo completo (más rico que el
-- board del cliente: num visible, emoji, impacto/esfuerzo, fuente, origen 'code').
-- Tablas propias (no reusa experimento_tareas/tarea_categorias del cliente, que en
-- ws1 son de Mauricio). Scopeado por workspace como todo — va a TENANT_TABLES.
-- El `id` es TEXT (se preservan los ids string del board / refIds de la bandeja).

begin;

-- ── Proyectos (labels) ──────────────────────────────────────────────────────
create table if not exists plan_proyectos (
  id           text not null,                       -- id string del board (uid/refId)
  workspace_id bigint not null default 1 references workspaces(id) on delete cascade,
  pid          text,                                -- id visible (P1, P2…)
  emoji        text not null default '📁',
  name         text not null default 'Proyecto',
  color        text not null default '#2F6FED',
  score        int  not null default 50,            -- 1-100 (prioridad del proyecto)
  score_razon  text,
  impacto      int,
  esfuerzo     int,
  deadline     text not null default '',            -- '' | YYYY-MM-DD (el board usa '')
  detalle      text not null default '',
  historial    jsonb not null default '[]'::jsonb,  -- [{id,ts,actor,text,undo?}]
  fuente       jsonb,                               -- {tipo, etiqueta?, url?}
  orden        double precision not null default 0, -- inserta entre dos sin renumerar
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, id)
);

-- ── Tareas ──────────────────────────────────────────────────────────────────
create table if not exists plan_tareas (
  id           text not null,
  workspace_id bigint not null default 1 references workspaces(id) on delete cascade,
  num          int  not null default 0,             -- #n visible (referencia entre tareas)
  emoji        text not null default '📌',
  title        text not null default 'Tarea',
  detalle      text not null default '',
  priority     text not null default 'media',       -- DERIVADA del score (alta|media|baja|futuro)
  score        int  not null default 0,             -- 1-100 (Perro Guardián); 0 = sin puntuar
  score_razon  text,
  impacto      int,
  esfuerzo     int,
  progress     int  not null default 0,             -- 0-100
  deadline     text not null default '',
  labels       jsonb not null default '[]'::jsonb,  -- ids de plan_proyectos
  checklist    jsonb not null default '[]'::jsonb,  -- [{id,text,done}]
  historial    jsonb not null default '[]'::jsonb,  -- [{id,ts,actor,text,undo?}]
  origen       text not null default 'user',        -- user | ia (MaKo) | code (Claude Code)
  fuente       jsonb,                               -- {tipo, etiqueta?, url?} (whatsapp/fathom/…)
  en_prioridad boolean not null default false,
  orden        double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, id)
);

-- El #num es cómo se referencian las tareas entre sí (y como las nombra MaKo).
create index if not exists ix_plan_tareas_ws  on plan_tareas    (workspace_id, num);
create index if not exists ix_plan_proys_ws   on plan_proyectos (workspace_id, orden);

comment on table plan_tareas    is 'Tablero /plan del dueño (roadmap de la agencia). Migrado de localStorage. Scopeado por workspace.';
comment on table plan_proyectos is 'Proyectos del tablero /plan del dueño. Scopeado por workspace.';

-- Solo service_role (getTenantDb): RLS on, sin policies — mismo patrón que el resto
-- de TENANT_TABLES. El scope por workspace lo pone el código (getTenantDb).
alter table plan_tareas    enable row level security;
alter table plan_proyectos enable row level security;

commit;

notify pgrst, 'reload schema';
