-- =============================================================================
-- 0317 — En qué columna PROPIA del Plan está una tarea (20/10/2026, chat «CRM», docs/pedidos-crm.md B1)
-- =============================================================================
-- Martín, 18/10 pt 9: «columnas editables como en el CRM». Las columnas de siempre son el ESTADO de la tarea (mig 0294,
-- con su CHECK) y se renombran; las que agrega cada negocio («Agregar columna», como «Agregar etapa» del CRM) son un
-- paso DENTRO de un estado y viven en `app_settings` (`plan.columnas`, lib/plan-columnas.ts). Esto guarda en cuál de
-- esas está cada tarea, en las dos mitades del tablero: `plan_tareas` (el dueño) y `experimento_tareas` (el cliente).
--
-- NULL = la columna de su estado. Un id que ya no existe, o el de una columna de OTRO estado (la tarea se completó por
-- el avance, la movió MaKo), también se dibuja en la de su estado (`claveDeTarea`): no hace falta una FK ni limpiar.
--
-- ORDEN DE DESPLIEGUE: AGREGA algo que el código nuevo lee → se aplica ANTES o JUNTO con el deploy (AGENTS.md, «Toda
-- migración decide su ORDEN»). Igual el código la TOLERA: las lecturas son `select('*')` (sin la columna, `columna`
-- llega undefined = la de su estado) y mover reintenta sin `columna` si la base contesta 42703/PGRST204
-- (lib/plan-board.ts `moverPlanTarea`, lib/todo.ts `moverTarea`). Sin datos que migrar.
-- =============================================================================

alter table public.plan_tareas add column if not exists columna text;
alter table public.experimento_tareas add column if not exists columna text;

comment on column public.plan_tareas.columna is
  'La columna PROPIA del Plan donde está la tarea (id `c_…` de app_settings plan.columnas). NULL = la de su estado. Ver lib/plan-columnas.ts.';
comment on column public.experimento_tareas.columna is
  'La columna PROPIA del Plan donde está la tarea (id `c_…` de app_settings plan.columnas). NULL = la de su estado. Ver lib/plan-columnas.ts.';
