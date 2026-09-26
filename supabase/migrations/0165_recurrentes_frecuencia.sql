-- =============================================================================
-- 0165 — lo que se repite dice CADA CUÁNTO
-- =============================================================================
-- «Una tarea o proyecto recurrente se le debe eliminar el quarter y deadline, pero se debe
-- dejar una casilla de "Frecuencia", algo similar a Google Calendar con una reunión que se
-- puede repetir diariamente, 1 vez a la semana, 1 vez al mes, etc.» (26/09/2026).
--
-- POR QUÉ NO ALCANZABA CON SACARLE LA FECHA. Las 0163 y 0164 sacaron el deadline y el
-- quarter porque una recurrente no VENCE — y eso dejó la tarjeta sin ninguna respuesta a
-- «¿cada cuánto?», que es la única pregunta temporal que una recurrente SÍ puede contestar.
-- El resultado era una lista donde «la junta de los miércoles» y «el seguimiento diario»
-- se ven exactamente igual, cuando una pesa cuatro veces más que la otra.
--
-- ⚠️ FRECUENCIA NO ES UN DEADLINE, Y POR ESO ES UNA COLUMNA NUEVA Y NO EL CAMPO VIEJO
-- RENOMBRADO. Un deadline es una fecha que llega, pasa y deja la tarea vencida; una
-- frecuencia es un RITMO que no vence nunca. Guardarla en `deadline` haría que todo lo que
-- mira esa columna —el motor de vencimientos, el tinte de la tabla, el Perro— la leyera
-- como un plazo y empezara a avisar que «la junta semanal está atrasada».
--
-- ⚠️ LAS CUATRO TABLAS, porque el tablero es UNO y lo montan el dueño y cada cliente, y
-- porque se repiten tanto las tareas como los proyectos (0163 + 0164). La columna en tres
-- de cuatro deja un control que no puede guardar nada, que en este repo ya pasó dos veces.
alter table plan_tareas         add column if not exists frecuencia text;
alter table experimento_tareas  add column if not exists frecuencia text;
alter table plan_proyectos      add column if not exists frecuencia text;
alter table tarea_categorias    add column if not exists frecuencia text;

-- ⚠️ SIN `check` EN LA BASE, Y ES UNA DECISIÓN. El saneo vive en `lib/plan-recurrentes.ts`
-- (`frecuenciaOk`), que es lo que testea el repo y lo que pueden importar las dos mitades;
-- un `check` acá tiraría un 400 opaco en vez de caer al default, y agregar un valor nuevo
-- pasaría a ser una migración en vez de una línea. Es el mismo criterio que `quarter`.
comment on column plan_tareas.frecuencia        is 'Cada cuánto se repite: diaria | semanal | quincenal | mensual | trimestral | anual. NULL = se repite, pero no se dijo cada cuánto. Sólo tiene sentido con recurrente = true (mig 0165).';
comment on column experimento_tareas.frecuencia is 'Cada cuánto se repite: diaria | semanal | quincenal | mensual | trimestral | anual. NULL = se repite, pero no se dijo cada cuánto (mig 0165).';
comment on column plan_proyectos.frecuencia     is 'Cada cuánto se repite: diaria | semanal | quincenal | mensual | trimestral | anual. NULL = se repite, pero no se dijo cada cuánto (mig 0165).';
comment on column tarea_categorias.frecuencia   is 'Cada cuánto se repite: diaria | semanal | quincenal | mensual | trimestral | anual. NULL = se repite, pero no se dijo cada cuánto (mig 0165).';

-- Sin esto PostgREST sigue sirviendo el esquema viejo y contesta 500 sobre la columna nueva.
notify pgrst, 'reload schema';
