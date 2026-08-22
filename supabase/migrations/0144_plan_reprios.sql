-- =============================================================================
-- 0144 — la audiencia: lo que se discutió, lo que se resolvió, y cómo volver atrás
-- =============================================================================
-- Cambiar una prioridad a mano dejó de ser un UPDATE de una fila. El pedido del dueño:
--
--   «Cambiar prioridad por el usuario también debería re-priorizar el resto. Y es por eso
--    que el perro debe ser muy estricto y debe tener la capacidad de rechazar una
--    re-priorización si los argumentos no son fuertes. Y claro que para eso tiene que hacer
--    buenas preguntas.»
--
-- Eso convierte un click en tres cosas que hoy no sobreviven a cerrar el modal:
--
--  1. EL RECHAZO. Hoy el veredicto del Perro vive en un `useState` y muere al cerrar la
--     ventana. Un «no» que no queda escrito es un «no» que se vuelve a intentar mañana con
--     el mismo argumento flojo, y el Perro —que no tiene memoria entre llamadas— lo vuelve
--     a evaluar de cero. Sin esta tabla, «ser estricto» dura lo que dura el modal.
--  2. EL ACTA DE LAS PREGUNTAS. Qué preguntó y qué contestó el dueño es la evidencia de
--     por qué se resolvió así. Es lo único que después permite discutir el veredicto.
--  3. EL SNAPSHOT PARA DESHACER. Aceptar mueve DECENAS de filas (medido en ws 9: 71
--     proyectos ocupando 100..30 sin un solo hueco, así que fijar uno arriba corre a todos
--     los de abajo). El undo de hoy —`board.showUndo`— restaura UN proyecto desde la
--     memoria del navegador y muere con un F5. Con una cascada, eso ya no es un undo.
--
-- ⚠️ `item_id` es TEXT y no uuid a propósito: en el board del dueño los ids de proyecto son
-- strings generados por el cliente, y en el del cliente son enteros. Una columna tipada a
-- uno de los dos obligaría a una segunda tabla para el otro, y dos tablas para lo mismo
-- garantizan que la segunda se quede vieja.
-- =============================================================================

begin;

create table if not exists plan_reprios (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  bigint not null default 1 references workspaces(id) on delete cascade,
  tablero       text not null default 'plan' check (tablero in ('plan', 'todo')),
  entidad       text not null check (entidad in ('proyecto', 'tarea')),
  item_id       text not null,
  item_nombre   text not null default '',

  -- lo que se pidió
  score_antes   int  not null,
  score_pedido  int  not null,
  motivo        text not null default '',
  -- las PRUEBAS: [{clase, ref, etiqueta, estado}] ya resueltas contra la base. Lo que el
  -- dueño eligió de una lista, no lo que escribió — un id que pasa por las manos de un
  -- modelo deja de ser exacto, así que acá viaja el id crudo y la etiqueta sale de la base.
  pruebas       jsonb not null default '[]'::jsonb,
  -- el acta: [{pregunta, tipo, opciones, respuesta, ts}]. Append-only.
  preguntas     jsonb not null default '[]'::jsonb,

  -- lo que se resolvió
  veredicto     text check (veredicto in ('acepta', 'ajusta', 'rechaza')),
  score_final   int,
  razon         text not null default '',
  -- el texto donde el Perro explica su veredicto, en su voz. Hoy se pierde al cerrar el modal.
  respuesta     text not null default '',
  -- qué auditoría no pasó, para poder mirarlo después sin depender de los logs de Vercel
  fallas        text not null default '',

  -- la cascada: {"<id>": {"nombre":…, "antes":N, "despues":M, "manualAntes":bool}}
  -- Incluye al ítem fijado. `manualAntes` importa: sin él, deshacer deja el candado de la
  -- mig 0143 puesto sobre un número que ya no es el que se decidió.
  ripple        jsonb not null default '{}'::jsonb,
  movidos       int  not null default 0,

  estado        text not null default 'propuesto' check (estado in ('propuesto', 'aplicado', 'rechazado', 'deshecho', 'error')),
  usuario       text not null default '',
  created_at    timestamptz not null default now(),
  aplicado_at   timestamptz,
  deshecho_at   timestamptz
);

create index if not exists plan_reprios_ws_item on plan_reprios (workspace_id, item_id, created_at desc);
create index if not exists plan_reprios_ws_fecha on plan_reprios (workspace_id, created_at desc);

-- Igual que plan_proyectos/plan_tareas (mig 0093) y plan_dependencias (0140): RLS prendida y
-- CERO policies. Nadie entra con la key anónima; se lee y se escribe solo por `getTenantDb`,
-- que scopea por workspace. Ver lib/workspace.ts → TENANT_TABLES. Una tabla nueva sin esto es
-- exactamente cómo este repo dejó 15 tablas abiertas a `anon` una vez.
alter table plan_reprios enable row level security;

comment on table plan_reprios is 'Una audiencia de prioridad: qué pidió el dueño, qué preguntó el Perro, qué contestó, cómo falló y qué filas movió. Un rechazo también deja fila (mig 0144).';
comment on column plan_reprios.ripple is 'Snapshot ANTES de escribir, de TODAS las filas que se tocan. Es lo que hace posible deshacer una cascada de decenas de filas.';

commit;

notify pgrst, 'reload schema';
