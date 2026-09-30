-- =============================================================================
-- 0184 — `impacto` y `esfuerzo` en el tablero del CLIENTE
-- =============================================================================
-- Los dos ejes con los que el Perro arma un score: cuánto mueve la aguja y cuánto
-- cuesta hacerla. El tablero del dueño (`plan_tareas` / `plan_proyectos`) los tiene
-- desde siempre y `BoardTask`/`Label` los declaran, así que el panel de una tarea los
-- dibuja para LOS DOS tableros — y del lado del cliente la columna no existía.
--
-- Es la mitad de columna de la tarea #157. La otra mitad eran `notas`,
-- `deadline_razon` y `hacelo_en`, que SÍ existían (migs 0114 y 0115) y a las que no
-- las leía ni las escribía nadie del lado del cliente: cinco de los seis lugares que
-- AGENTS.md enumera («un campo nuevo son SEIS lugares») estaban vacíos.
--
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy. Es aditiva y el código nuevo
-- YA la lee: entre un deploy sin estas columnas y la migración, `editarTarea` manda
-- `impacto` en el `update` y PostgREST rechaza la fila ENTERA — o sea que falla cada
-- guardado del tablero del cliente, con la pantalla ya pintada. Ver AGENTS.md →
-- «Toda migración decide su ORDEN de despliegue».
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ `null` Y NO UN DEFAULT
-- ─────────────────────────────────────────────────────────────────────────────
-- Un `default 50` le pondría a las 1.500 tareas que ya existen un impacto que nadie
-- estimó, y la pantalla no puede distinguir «vale 50» de «nadie lo miró»: dibujaría
-- un dato inventado con cara de medido. `null` es «todavía no se sabe», que es la
-- verdad de toda fila anterior a hoy, y el mapper lo pasa como `undefined` para que
-- el control nazca vacío.
--
-- Y NO se derivan del `score`. El score es el juicio y estos son sus insumos: sacar
-- los insumos de la conclusión es la cuenta con voz de juicio que AGENTS.md prohíbe
-- («la cura de dos números incoherentes es que los produzca UN juicio, no que uno se
-- calcule del otro»).
--
-- El CHECK va acotado a 1..100 igual que en el tablero del dueño, y el saneo
-- (`pct1a100`, lib/todo.ts) corta antes: un 0 y un 140 son los dos «no lo sé» y
-- entran como null en vez de reventar el insert.
-- =============================================================================

alter table experimento_tareas add column if not exists impacto  smallint;
alter table experimento_tareas add column if not exists esfuerzo smallint;
alter table tarea_categorias   add column if not exists impacto  smallint;
alter table tarea_categorias   add column if not exists esfuerzo smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'experimento_tareas_impacto_rango') then
    alter table experimento_tareas add constraint experimento_tareas_impacto_rango
      check (impacto is null or (impacto between 1 and 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'experimento_tareas_esfuerzo_rango') then
    alter table experimento_tareas add constraint experimento_tareas_esfuerzo_rango
      check (esfuerzo is null or (esfuerzo between 1 and 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tarea_categorias_impacto_rango') then
    alter table tarea_categorias add constraint tarea_categorias_impacto_rango
      check (impacto is null or (impacto between 1 and 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tarea_categorias_esfuerzo_rango') then
    alter table tarea_categorias add constraint tarea_categorias_esfuerzo_rango
      check (esfuerzo is null or (esfuerzo between 1 and 100));
  end if;
end $$;

comment on column experimento_tareas.impacto  is 'mig 0184 · 1-100: cuánto mueve la aguja. null = nadie lo estimó (no es 0).';
comment on column experimento_tareas.esfuerzo is 'mig 0184 · 1-100: cuánto cuesta hacerla. null = nadie lo estimó (no es 0).';
comment on column tarea_categorias.impacto   is 'mig 0184 · 1-100: cuánto mueve la aguja. null = nadie lo estimó (no es 0).';
comment on column tarea_categorias.esfuerzo  is 'mig 0184 · 1-100: cuánto cuesta hacerla. null = nadie lo estimó (no es 0).';
