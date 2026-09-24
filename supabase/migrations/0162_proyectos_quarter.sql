-- =============================================================================
-- 0162 — el Quarter de un PROYECTO
-- =============================================================================
-- La 0155 le puso `quarter` a `plan_tareas` y la 0156 a `experimento_tareas`: las dos
-- mitades de «¿para cuándo se planificó esto?» del lado de las TAREAS. Los proyectos
-- quedaron afuera, y es donde la pregunta más sentido tiene: una tarea cae en un
-- trimestre casi siempre porque su proyecto lo decidió.
--
--   «Falta agregar la opción de Quarter en los proyectos» (24/09/2026).
--
-- ⚠️ LAS DOS TABLAS EN LA MISMA MIGRACIÓN. El tablero es UNO (`app/plan/board/BoardShell`)
-- y lo montan el dueño (`plan_proyectos`) y cada cliente (`tarea_categorias`): agregar el
-- selector en el componente compartido y la columna en una sola tabla deja a la otra mitad
-- con un control que no puede guardar nada — que en este repo ya pasó con el slider de
-- prioridad y se lee como que la app está rota.
alter table plan_proyectos   add column if not exists quarter text;
alter table tarea_categorias add column if not exists quarter text;

-- ⚠️ Y acá SÍ se deriva del deadline, al revés de lo que dicen los comentarios de la 0155
-- y la 0156. El criterio lo fijó el dueño el 23/09/2026 —«no tiene sentido que no se
-- asigne automáticamente el Quarter si ya está asignado el deadline»— y lo repitió el
-- 24/09. La derivación SÓLO rellena lo vacío: si alguien eligió un Quarter distinto del
-- que le tocaría por fecha, eso es una decisión y la pantalla AVISA en vez de corregir.
comment on column plan_proyectos.quarter   is 'Quarter planificado, formato `2026-Q3`. null = sin asignar. Se DERIVA del deadline cuando está vacío (mig 0162).';
comment on column tarea_categorias.quarter is 'Quarter planificado, formato `2026-Q3`. null = sin asignar. Se DERIVA del deadline cuando está vacío (mig 0162).';
