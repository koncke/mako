-- =============================================================================
-- 0164 — un PROYECTO también se puede repetir
-- =============================================================================
-- «Un proyecto también se puede repetir» (25/09/2026). La 0163 le dio la columna a las
-- tareas y el caso quedó a medias: el trabajo recurrente de verdad casi nunca es una tarea
-- suelta, es un contenedor entero —«Customer Success», «Reuniones de marketing»— del que
-- cuelgan las tareas de cada semana. Marcar las tareas una por una y dejar al proyecto
-- compitiendo en el ranking deja el problema donde estaba, un nivel más arriba.
--
-- POR QUÉ: la misma razón que la 0163. El Perro ordena los proyectos por «qué mueve la
-- aguja» y les pone deadline; un proyecto que no termina nunca no tiene fecha de fin, así
-- que hoy se lleva un lugar del tercio de arriba y —como su avance nunca llega a 100—
-- arrastra el promedio del plan para siempre. La regla hermana ya estaba escrita desde el
-- 13/07/2026: «un proyecto tiene inicio y fin».
--
-- ⚠️ LAS DOS TABLAS, igual que la 0163 y la 0162: el tablero es UNO (`BoardShell`) y lo
-- montan el dueño (`plan_proyectos`) y cada cliente (`tarea_categorias`). La columna en una
-- sola deja a la otra mitad con un control que no puede guardar nada — que en este repo ya
-- pasó dos veces y se lee como que la app está rota.
alter table plan_proyectos   add column if not exists recurrente boolean not null default false;
alter table tarea_categorias add column if not exists recurrente boolean not null default false;

comment on column plan_proyectos.recurrente   is 'true = se repite para siempre (Customer Success, las reuniones de marketing). No entra al ranking de proyectos, no lleva deadline ni quarter y no cuenta para el avance del plan (mig 0164).';
comment on column tarea_categorias.recurrente is 'true = se repite para siempre (Customer Success, las reuniones de marketing). No entra al ranking de proyectos, no lleva deadline ni quarter y no cuenta para el avance del plan (mig 0164).';

-- ⚠️ SIN BACKFILL, por lo mismo que la 0163 y con la misma medición detrás: buscar por
-- palabra clave marca lo contrario de lo que busca («Diseñar la estructura de la junta
-- semanal» es trabajo CON FIN que monta un ritual). Lo pone una persona.

-- Sin esto PostgREST sigue sirviendo el esquema viejo y contesta 500 sobre la columna nueva.
notify pgrst, 'reload schema';
