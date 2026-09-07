-- =============================================================================
-- 0155 — Objectives y KPIs: la columna vertebral que /general no tenía
-- =============================================================================
-- Hasta hoy «el objetivo del negocio» eran TRES settings sueltos en app_settings
-- (`objetivo_cierres`, `objetivo_cash_usd`, `objetivo_desde`). Eso alcanza para
-- pintar una barra y para nada más: no tiene período, no tiene dueño, no se puede
-- tener dos a la vez, y sobre todo no tiene NADA colgando abajo.
--
-- Y lo que falta abajo es el producto entero. `/general` mide sólo RESULTADOS
-- —cierres, cash, cuotas vencidas, fatiga de creativo— o sea consecuencias, cosas
-- que ya pasaron y sobre las que hoy no se puede actuar. Las seis reglas del
-- Semáforo (app/general/page.tsx:108-190) alertan todas sobre resultados; ninguna
-- sobre una acción que se cumple o no día a día.
--
--     META ANUAL → Q → OBJECTIVE (el resultado) → KPI (lo que lo mueve) → tareas
--
-- El objetivo se MIDE y no se hace. El KPI se HACE y por eso tiene compromiso,
-- cadencia y umbral. La distinción no se nombra en pantalla: está en la
-- estructura, no en un rótulo que haya que explicar.
--
-- ⚠️ «Palanca» NO se usa: es vocabulario del cliente que inspiró esto, no de la
-- app. Adentro del producto la cosa se llama KPI.
--
-- Las tres tablas siguen el patrón de TENANT_TABLES: `workspace_id` en la PK
-- compuesta, RLS prendida y CERO policies. El scope lo pone `getTenantDb()`.
-- =============================================================================

begin;

-- ── Objectives ──────────────────────────────────────────────────────────────
-- `quarter` NULL = objetivo ANUAL. No es lo mismo que «sin período»: un objetivo
-- sin año no existe, y por eso `anio` es not null.
--
-- `metrica` decide de dónde sale el número REAL. `libre` es el escape para lo que
-- MaKo no puede medir; su avance lo mueve la persona. Todo lo demás se lee de la
-- base y NUNCA se guarda una copia: un progreso guardado es un segundo productor
-- del mismo número, que es el antipatrón que este repo ya pagó con el score de
-- proyectos.
create table if not exists objectives (
  id           text not null,
  workspace_id bigint not null default 1 references workspaces(id) on delete cascade,
  anio         int  not null,
  quarter      int,                                  -- 1..4, o null = anual
  titulo       text not null default 'Objetivo',
  metrica      text not null default 'cash_usd',     -- cash_usd|sold_usd|cierres|agendas|leads|libre
  meta_valor   numeric not null default 0,
  unidad       text not null default 'usd',          -- usd|cantidad
  -- Sólo para `metrica='libre'`: lo mueve la persona, no hay de dónde leerlo.
  avance_manual numeric,
  orden        double precision not null default 0,
  estado       text not null default 'activo',       -- activo|cerrado
  origen       text not null default 'user',         -- user|ia|migracion
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint objectives_quarter_ok check (quarter is null or (quarter between 1 and 4))
);

-- ── KPIs ────────────────────────────────────────────────────────────────────
-- `objective_id` puede ser NULL a propósito: un KPI suelto sigue siendo un KPI, y
-- obligar a colgarlo de un objetivo el día uno convierte el arranque en un wizard
-- de dos niveles. Se cuelga después.
--
-- `compromiso` es POR PERÍODO, y el período lo define `cadencia`. Los umbrales son
-- PORCENTAJE del compromiso, no valores absolutos: así un KPI sigue teniendo
-- sentido cuando alguien le cambia el compromiso de 5 a 7.
--
-- ⚠️ `fuente='auto'` significa que el valor se CALCULA al leer, contra los datos
-- que ya están en la base. No se guarda. Si la fuente falla, el KPI reporta
-- «no pude leer» y NUNCA cero — un cero inventado por un timeout de Meta pinta el
-- KPI en rojo y dispara una acción prioritaria falsa.
create table if not exists kpis (
  id           text not null,
  workspace_id bigint not null default 1 references workspaces(id) on delete cascade,
  objective_id text,
  nombre       text not null default 'KPI',
  cadencia     text not null default 'semanal',      -- diaria|semanal
  compromiso   numeric not null default 0,
  unidad       text not null default 'cantidad',     -- cantidad|usd
  umbral_verde numeric not null default 100,         -- % del compromiso
  umbral_ambar numeric not null default 70,
  fuente       text not null default 'manual',       -- auto|manual
  fuente_id    text,                                 -- id de FUENTES_KPI si fuente='auto'
  orden        double precision not null default 0,
  activo       boolean not null default true,
  origen       text not null default 'user',         -- user|ia|seed
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint kpis_cadencia_ok check (cadencia in ('diaria', 'semanal')),
  constraint kpis_fuente_ok   check (fuente in ('auto', 'manual'))
);

-- ── Registros ───────────────────────────────────────────────────────────────
-- SÓLO para KPIs manuales. Los automáticos se calculan al leer (ver arriba).
--
-- `fecha` es el INICIO DEL PERÍODO, no el día en que alguien apretó el botón: para
-- un KPI diario es el día, para uno semanal es el lunes de esa semana. Con eso la
-- PK compuesta da idempotencia gratis — marcar dos veces el mismo período pisa la
-- fila en vez de duplicarla, que es justo lo que pasa cuando alguien tiene la
-- pantalla abierta en dos pestañas.
create table if not exists kpi_registros (
  workspace_id bigint not null default 1 references workspaces(id) on delete cascade,
  kpi_id       text not null,
  fecha        date not null,
  valor        numeric not null default 0,
  origen       text not null default 'manual',
  nota         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, kpi_id, fecha)
);

create index if not exists ix_objectives_ws     on objectives    (workspace_id, anio, quarter);
create index if not exists ix_kpis_ws           on kpis          (workspace_id, activo, orden);
create index if not exists ix_kpis_objective    on kpis          (workspace_id, objective_id);
create index if not exists ix_kpi_registros_ws  on kpi_registros (workspace_id, kpi_id, fecha desc);

comment on table objectives     is 'El resultado que se persigue en un año o un Q. Su avance se DERIVA de los datos, nunca se guarda (mig 0155).';
comment on table kpis           is 'Lo que mueve a un objetivo: compromiso por período, cadencia y umbrales. «Palanca» es vocabulario del cliente, acá se llama KPI (mig 0155).';
comment on table kpi_registros  is 'Sólo KPIs manuales. `fecha` es el INICIO del período, lo que da idempotencia por PK (mig 0155).';
comment on column kpis.fuente   is 'auto = se calcula al leer contra la base y NUNCA se guarda; si la lectura falla el KPI dice «no pude leer», jamás cero (mig 0155).';
comment on column objectives.quarter is 'null = objetivo ANUAL. No confundir con «sin período»: `anio` siempre está (mig 0155).';

-- ── El Q en el tablero de tareas ────────────────────────────────────────────
-- Texto `2026-Q3` y no un int: un «Q3» sin año es ambiguo apenas cruza diciembre,
-- y este board tiene tareas de más de un año. NULL = sin Q asignado, que es un
-- estado legítimo y su propia vista («Sin Quarter»).
--
-- ⚠️ NO se backfillea desde `deadline`. Una tarea con fecha para marzo no es una
-- tarea que alguien haya PLANIFICADO para el Q1: derivar el plan de una fecha que
-- puso otra cosa es inventar una decisión que nadie tomó.
alter table plan_tareas add column if not exists quarter text;
comment on column plan_tareas.quarter is 'Quarter planificado, formato `2026-Q3`. null = sin asignar. NO se deriva del deadline (mig 0155).';

-- Solo service_role (getTenantDb): RLS on, sin policies — mismo patrón que el
-- resto de TENANT_TABLES.
alter table objectives    enable row level security;
alter table kpis          enable row level security;
alter table kpi_registros enable row level security;

commit;

notify pgrst, 'reload schema';
