-- =============================================================================
-- 0419 — el tablero del DUEÑO aprende QUIÉN hace cada tarea (F156, 18/11/2026)
-- =============================================================================
-- SIN APLICAR: la escribió una sesión de la nube, que no puede aplicar migraciones. Se aplica a mano
-- (`scripts/apply-migration.mjs`) después de la revisión del Cerebro; el código ya tolera que falte.
--
-- El filtro «Responsable» del kanban (míos / del cliente / de terceros / sin asignar) existe desde el 16/10/2026,
-- pero sólo se dibujaba en el tablero del CLIENTE: `experimento_tareas.responsable_tipo` (mig 0159) es la única
-- columna que lo guardaba, y `plan_tareas` no la tenía (app/plan/board/types.ts lo decía). Esta es la misma columna,
-- con el mismo check y el mismo significado, del lado del dueño.
--
-- `responsable_tipo` es relativo al DUEÑO DEL TABLERO: 'mio' / 'cliente' / 'tercero'. NULL = nadie lo dijo (todas las
-- tareas de antes, y las que se crean a mano), que NO es lo mismo que 'mio': inventar que eran del dueño sería mentir
-- en el filtro. La escribe la extracción de una reunión al crear la tarea (lib/plan-propuesta.ts → aplicarPropuestas →
-- agregarTareasPlanOwner); el tablero la LEE y la devuelve tal cual en su guardado de la fila entera.
--
-- ORDEN DE DESPLIEGUE: da igual (es aditiva y el código tolera las dos puntas). Antes del deploy, nada la escribe.
-- Después del deploy y sin la migración: el alta desde una reunión reintenta sin la columna (lib/plan-board.ts) y el
-- tablero no la manda, porque una fila leída sin la columna no la trae (`responsableTipo` queda `undefined`).
-- =============================================================================

begin;

alter table plan_tareas
  add column if not exists responsable_tipo text
    check (responsable_tipo in ('mio', 'cliente', 'tercero'));

comment on column plan_tareas.responsable_tipo is 'Relativo al dueño del tablero: mio / cliente / tercero. null = no se sabe, NO es mio (mig 0419, la misma de experimento_tareas en la 0159).';

commit;
