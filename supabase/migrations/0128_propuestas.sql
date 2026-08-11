-- =============================================================================
-- 0128_propuestas — lo que un canal PROPONE escribir, hasta que una persona confirma
-- =============================================================================
-- La regla del producto: nada que venga de Claude, de WhatsApp o de cualquier canal
-- escribe directo. Deja una propuesta acá y devuelve UN LINK a una pantalla de MaKo
-- donde el dueño la mira, la corrige y confirma. Es el mismo camino que ya usaba el
-- plan (plan_propuestas → /plan/revisar), generalizado.
--
-- El porqué está pagado: un DATO EXACTO que pasa por las manos de un LLM deja de ser
-- exacto. Un teléfono con un dígito cambiado entra al CRM, no matchea su WhatsApp, y
-- nadie se entera hasta que falta una conversación.
--
-- POR QUÉ GENÉRICA Y NO `crm_propuestas`: `plan_propuestas` ya existe con columnas
-- propias del plan (tareas/notas/eliminar/cerrar). Hacer una tabla por área garantiza
-- que la tercera también sea propia, y que cada una reinvente estado, idempotencia y
-- caducidad. Acá el payload va en `datos` y lo interpreta quien aplica según `tipo`.
-- `plan_propuestas` NO se migra en esta pasada — sigue siendo la del plan.
--
-- Scopeada por workspace → va a TENANT_TABLES. `id` TEXT (id string estable, como el
-- del plan, porque viaja en una URL que alguien puede pegar en un chat).

begin;

create table if not exists propuestas (
  id           text not null,
  workspace_id bigint not null default 1 references workspaces(id) on delete cascade,
  tipo         text not null,                        -- qué se propone: 'lead' | …
  estado       text not null default 'pendiente',    -- pendiente | aplicada | descartada
  origen       text,                                  -- de dónde vino: 'claude' | 'whatsapp' | …
  resumen      text not null default '',              -- una línea legible de qué se propone
  datos        jsonb not null default '{}'::jsonb,    -- el payload, con la forma de `tipo`
  -- Llave de idempotencia DEL EMISOR. Un formulario de landing dispara dos veces con
  -- mala conexión y un Apps Script reintenta: sin esto quedan dos propuestas del mismo
  -- lead y el dueño confirma un duplicado creyendo que son dos personas.
  ref          text,
  resultado    jsonb,                                 -- qué se creó al aplicar (id del lead, etc.)
  created_at   timestamptz not null default now(),
  applied_at   timestamptz,
  primary key (workspace_id, id)
);

create index if not exists ix_propuestas_ws on propuestas (workspace_id, estado, created_at desc);

-- El target del ON CONFLICT de la idempotencia. NO puede ser parcial: un índice parcial
-- no sirve como target, y el `insert … on conflict (workspace_id, ref)` fallaría en
-- tiempo de ejecución con un error que no dice eso.
create unique index if not exists ux_propuestas_ref on propuestas (workspace_id, ref);

comment on table propuestas is 'Lo que un canal (Claude, WhatsApp) propone escribir, hasta que una persona lo confirma en MaKo. Scopeado por workspace.';

-- Solo service_role (getTenantDb): RLS on, sin policies — igual que el resto de TENANT_TABLES.
alter table propuestas enable row level security;

commit;
