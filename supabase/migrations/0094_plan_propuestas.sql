-- =============================================================================
-- 0094_plan_propuestas — borrador de tareas que MaKo deja para revisar en la app
-- =============================================================================
-- MaKo por WhatsApp deja de hacer el ida-y-vuelta de preguntas (frágil, se cortaba):
-- ahora arma un BORRADOR (tareas propuestas + notas/preguntas) y manda UN link a una
-- pantalla de revisión (/plan/revisar/<id>) donde el dueño edita, responde y confirma
-- de un toque. La propuesta vive acá hasta que se APLICA (crea las tareas) o se DESCARTA.
-- Scopeada por workspace como todo → va a TENANT_TABLES. `id` TEXT (id string estable).

begin;

create table if not exists plan_propuestas (
  id           text not null,
  workspace_id bigint not null default 1 references workspaces(id) on delete cascade,
  estado       text not null default 'pendiente',   -- pendiente | aplicada | descartada
  origen       text,                                 -- fuente (whatsapp/fathom/…)
  resumen      text not null default '',             -- una línea de qué armó MaKo
  tareas       jsonb not null default '[]'::jsonb,   -- [{titulo, proyecto, deadline, detalle, prioridad}]
  notas        jsonb not null default '[]'::jsonb,   -- preguntas/notas de MaKo para el dueño (string[])
  created_at   timestamptz not null default now(),
  applied_at   timestamptz,
  primary key (workspace_id, id)
);

create index if not exists ix_plan_propuestas_ws on plan_propuestas (workspace_id, estado, created_at desc);

comment on table plan_propuestas is 'Borradores de tareas que MaKo deja para revisar/confirmar en la app (/plan/revisar). Scopeado por workspace.';

-- Solo service_role (getTenantDb): RLS on, sin policies — igual que el resto de TENANT_TABLES.
alter table plan_propuestas enable row level security;

commit;

notify pgrst, 'reload schema';
