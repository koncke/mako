-- =============================================================================
-- 0296 — las reuniones que el cron NO LEYÓ quedan escritas, con su motivo
-- =============================================================================
-- 16/10/2026, «Fathom sin fricción» (decisión 7 de «hacer el kanban un kanban»). El cron de
-- Fathom (lib/reunion-auto.ts) lee sólo las reuniones de EQUIPO y de ENTREGA; las de VENTAS (el
-- invitado es un prospecto del CRM) y las OTRAS (no reconoció a nadie del equipo ni del CRM) se
-- descartaban con un `console.log` en Vercel y nada más: no dejaban borrador, ni marca, ni aviso.
-- Para el dueño, una reunión descartada era igual a una que nunca existió.
--
-- ⚠️ Y LA MEDICIÓN DIJO QUE EL CLASIFICADOR NO ERA LA CAUSA. En el ws1, del 08 al 15/10: 11
-- reuniones (5 de entrega, 6 de equipo, CERO de ventas u «otra»), y sólo UNA dejó borrador. Las
-- otras diez no las descartó nadie: la LECTURA falló (la clave de IA del negocio no contesta desde el
-- 08/10, docs/hallazgos-plan.md, 15/10) y salieron de la ventana de 26 h sin dejar rastro. Por eso
-- la tabla guarda también `tipo = 'fallo'`: una reunión que el cron intentó leer y no pudo. La
-- regla es una sola —ninguna reunión desaparece sin rastro—, y las dos causas se ven en la misma
-- lista corta del modal de Fathom, cada una con su motivo.
--
-- Esta tabla es la marca. Una fila por reunión no leída, con el tipo y el MOTIVO en palabras
-- («juan@x.com está en tu CRM como prospecto», «No pude leer 2 tramo(s)»), para que el modal de
-- Fathom las muestre en una lista corta con «Leer igual». `leida_at` se escribe cuando alguien la lee
-- igual: sale de la lista y queda el rastro de que se decidió leerla. Y la que después sí dejó
-- borrador (el cron la reintentó y salió) tampoco se lista: el lector cruza con `plan_propuestas`.
--
-- Es una tabla NUEVA y sólo agrega: no toca ninguna fila de nadie.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy. El código nuevo escribe acá en cada
-- corrida del cron y lee acá al abrir el modal de Fathom. Sin la tabla no se rompe nada —el
-- escritor y el lector la tratan como opcional y lo dicen en el log (`[reunion-descartadas]`)—,
-- pero la lista «Sin leer» del modal queda vacía hasta que exista. Al revés (la tabla antes) no cambia
-- nada para el código de hoy, que no la nombra.
--
-- Scopeada por workspace como todo lo del plan: va a TENANT_TABLES (lib/workspace.ts) y a
-- TABLAS_DE_INQUILINO (lib/tablas-de-inquilino.ts). RLS prendida y sin policies, más el `revoke`
-- explícito: la lee sólo el server con service_role (AGENTS.md → «Toda migración decide su ORDEN»).
-- =============================================================================

begin;

create table if not exists plan_reuniones_descartadas (
  workspace_id bigint not null references workspaces(id) on delete cascade,
  -- `recording_id` de la API de Fathom (el mismo de `plan_propuestas.ref` = 'fathom:<id>').
  recording_id bigint not null,
  titulo       text not null default '',
  -- Cuándo FUE la reunión (no cuándo la miró el cron).
  fecha        timestamptz,
  url          text,
  -- Lo que dijo el clasificador (lib/reunion-clasificar.ts) para las que NO van al plan, o
  -- 'fallo' para una que sí iba y no se pudo leer.
  tipo         text not null check (tipo in ('ventas', 'otra', 'fallo')),
  -- Por qué, en una línea que se dibuja. El código recorta antes (300).
  motivo       text not null default '' check (char_length(motivo) <= 300),
  created_at   timestamptz not null default now(),
  -- Alguien tocó «Leer igual»: sale de la lista «Sin leer». NULL = sigue sin leer.
  leida_at     timestamptz,
  primary key (workspace_id, recording_id)
);

create index if not exists ix_plan_reuniones_descartadas_ws
  on plan_reuniones_descartadas (workspace_id, fecha desc)
  where leida_at is null;

comment on table plan_reuniones_descartadas is
  'Reuniones de Fathom que el cron NO leyó: el clasificador las dio por ventas u otra, o la lectura falló (mig 0296). Se muestran en el modal de Fathom con «Leer igual». Scopeado por workspace.';

alter table plan_reuniones_descartadas enable row level security;
revoke all on plan_reuniones_descartadas from anon, authenticated;

commit;

notify pgrst, 'reload schema';
