-- =============================================================================
-- 0294 — el kanban del Plan pasa a ser de FLUJO: `estado` en las DOS mitades
-- =============================================================================
-- «Hacer el kanban un kanban» (Martín, 16/10/2026, sobre la reunión con Mauricio del
-- 12/10 — Fathom 191993679): «el espíritu más importante del Kanban es el flujo… No la
-- clasificación». Las columnas pasan de PRIORIDAD (Alta/Media/Baja/A futuro) a ESTADO:
-- Por iniciar · En proceso · Atorada · Completada (y «No cumplen tu criterio» al final,
-- sólo si tiene tareas). Las etiquetas viven en lib/todo-estados.ts.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ESTA MIGRACIÓN VA **ANTES** DEL DEPLOY. El código nuevo LEE y
-- ESCRIBE `plan_tareas.estado` y `motivo_atorada` en cada guardado del tablero del dueño
-- (`taskToRow` / `guardarPlanTarea`, lib/plan-board.ts): sin las columnas, PostgREST
-- rechaza la fila ENTERA y falla CADA guardado con la pantalla ya pintada. Al revés no
-- rompe nada: el código de hoy no nombra estas columnas, y un upsert que no las nombra no
-- las toca.
--
-- ⚠️ Y LO QUE PASA ENTRE ESTA MIGRACIÓN Y EL DEPLOY: el código viejo NO escribe
-- `plan_tareas.estado`, así que una tarea del dueño que se complete (o se reabra) en ese
-- intervalo queda con el estado del backfill. Lo único que puede quedar es una
-- CONTRADICCIÓN con el avance, y se arregla con dos sentencias que se pueden correr en
-- cualquier momento después del deploy (sólo tocan filas que se contradicen, y el código
-- nuevo no produce ninguna — `trasMover` y `estadoAlGuardar` mantienen la invariante
-- «100% ⇔ Completada»):
--     update plan_tareas set estado = 'hecho' where progress >= 100 and estado <> 'hecho';
--     update plan_tareas set estado = case when progress > 0 then 'en_curso' else 'por_hacer' end
--       where progress < 100 and estado = 'hecho';
-- Y el `orden` del dueño: el código viejo escribe `orden = num` en cada guardado
-- (`taskToRow`), así que una tarjeta editada en ese intervalo pierde su lugar inicial en
-- la columna (queda más abajo). Es cosmético y se acomoda arrastrándola.
--
-- 1) `plan_tareas.estado` — la mitad del DUEÑO no tenía estado. Mismo CHECK que
--    `experimento_tareas` (mig 0159): el tablero es UNO (`BoardShell`) y lo montan dos
--    mitades; un estado que exista en una sola es una columna que en la otra no guarda.
--    BACKFILL desde el avance: 100→hecho, >0→en_curso, resto→por_hacer — la misma regla
--    que `estadoDeAvance` (lib/todo-estados.ts), y el test cruza las dos. Medido el
--    16/10/2026 antes de escribir esto: 424 filas (todas del ws 9), 248 al 100%, 11 entre
--    1 y 99, 165 en 0. Ninguna fila queda en `en_seguimiento` ni en `no_cumple`: esas dos
--    sólo las pone una persona (o el criterio), y nadie lo hizo todavía.
--
-- 2) `motivo_atorada` en las DOS tablas — «Atorada» lleva un motivo corto opcional («porque
--    el cliente no da o porque yo no tengo dinero… o los recursos»). Texto, nullable, sin
--    default: `null` es «nadie dijo por qué», la verdad de toda fila anterior. Un CHECK de
--    largo para que la base no guarde un párrafo donde la tarjeta dibuja una línea; el
--    código recorta antes (`motivoAtoradaOk`, 140) para que el arrastre nunca falle por eso.
--
-- 3) EL `orden` INICIAL DENTRO DE CADA COLUMNA. Decisión 2 del 16/10: el orden manual es el
--    orden por defecto dentro de la columna, y el `orden` que hay hoy NO lo decidió nadie:
--      · `plan_tareas.orden` = `num` en las 424 filas (lo escribe `taskToRow` en cada
--        guardado), o sea la más VIEJA arriba;
--      · `experimento_tareas.orden` lo puso `ordenTope` al crear (la más nueva arriba).
--    Ninguna pantalla lo dibujó nunca: la acción `mover` de /api/todo (la única que escribe
--    un `orden` elegido) no tenía un solo llamador, y los dos kanbans ordenaban por score.
--    Así que se reescribe con lo que la columna de prioridad ya mostraba: la de MAYOR SCORE
--    ARRIBA (empate: la más vieja), y en «Completada» la más RECIÉN COMPLETADA arriba. Es
--    reescribir un número que nadie eligió para que el primer día del kanban nuevo se vea
--    en el orden que ya se veía. Nada más cambia de valor. Va guardado por la columna nueva
--    de cada tabla: si la migración se vuelve a correr, NO pisa lo que la gente ya arrastró.
-- =============================================================================

begin;

-- ── 1) la mitad del dueño: estado + backfill + orden inicial ─────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plan_tareas' and column_name = 'estado'
  ) then
    alter table plan_tareas add column estado text not null default 'por_hacer';

    update plan_tareas
       set estado = case when progress >= 100 then 'hecho' when progress > 0 then 'en_curso' else 'por_hacer' end;

    update plan_tareas p
       set orden = r.puesto
      from (
        select workspace_id, id,
               row_number() over (
                 partition by workspace_id, estado
                 order by case when estado = 'hecho' then extract(epoch from updated_at) else 0 end desc,
                          score desc, num asc
               ) as puesto
          from plan_tareas
      ) r
     where p.workspace_id = r.workspace_id and p.id = r.id;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'plan_tareas_estado_check') then
    alter table plan_tareas
      add constraint plan_tareas_estado_check
      check (estado in ('no_cumple', 'por_hacer', 'en_curso', 'en_seguimiento', 'hecho'));
  end if;
end $$;

create index if not exists ix_plan_tareas_estado_orden on plan_tareas (workspace_id, estado, orden);

-- ── 2) el orden inicial de la mitad del cliente (antes de crear su columna nueva) ──
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'experimento_tareas' and column_name = 'motivo_atorada'
  ) then
    update experimento_tareas e
       set orden = r.puesto
      from (
        select id,
               row_number() over (
                 partition by workspace_id, estado
                 order by case when estado = 'hecho' then extract(epoch from coalesce(hecho_at, updated_at)) else 0 end desc,
                          score desc, orden asc, id asc
               ) as puesto
          from experimento_tareas
      ) r
     where e.id = r.id;
  end if;
end $$;

-- ── 3) el motivo de «Atorada», en las dos ───────────────────────────────────
alter table plan_tareas        add column if not exists motivo_atorada text
  check (motivo_atorada is null or char_length(motivo_atorada) <= 200);
alter table experimento_tareas add column if not exists motivo_atorada text
  check (motivo_atorada is null or char_length(motivo_atorada) <= 200);

comment on column plan_tareas.estado is 'por_hacer (Por iniciar) · en_curso (En proceso) · en_seguimiento (Atorada) · hecho (Completada) · no_cumple (No cumplen tu criterio). Mismo CHECK que experimento_tareas. Etiquetas en lib/todo-estados.ts (mig 0294).';
comment on column experimento_tareas.estado is 'por_hacer (Por iniciar) · en_curso (En proceso) · en_seguimiento (Atorada) · hecho (Completada) · no_cumple (No cumplen tu criterio). Etiquetas en lib/todo-estados.ts (migs 0159 y 0294).';
comment on column plan_tareas.motivo_atorada is 'Por qué está Atorada, en una línea. Sólo existe con estado en_seguimiento; null = nadie dijo por qué (mig 0294).';
comment on column experimento_tareas.motivo_atorada is 'Por qué está Atorada, en una línea. Sólo existe con estado en_seguimiento; null = nadie dijo por qué (mig 0294).';
comment on column plan_tareas.orden is 'Lugar dentro de su columna del kanban (estado), ascendente. Lo escriben el alta y mover; el guardado de la fila entera NO (mig 0294).';

commit;

notify pgrst, 'reload schema';
