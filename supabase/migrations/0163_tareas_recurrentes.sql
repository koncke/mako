-- =============================================================================
-- 0163 — una tarea que SE REPITE PARA SIEMPRE no compite en el ranking
-- =============================================================================
-- El criterio es de Mauricio y lo dijo con su nombre el 16/07/2026: «tienes reunión todos
-- los miércoles con X clientes… eso sí es una tarea, pero es como, yo cuando trabajaba en
-- el mundo corporativo le llamábamos BAU, Business As Usual. Una tarea recurrente que se
-- repite infinitamente… Acá lo que entran son tareas que tienen un inicio y tienen un
-- fin». Lo repitió el 18/08 sobre el seguimiento diario a los leads: «esto es un bau».
--
-- ⚠️ EL NOMBRE «BAU» SE DESCARTÓ A PROPÓSITO —«el nombre tal vez no es muy conocido»— y en
-- el producto esto se llama RECURRENTES / «Se repite», en ningún lado BAU. Acá aparece una
-- sola vez y es para explicar de dónde salió el criterio, que es lo único que un comentario
-- puede aportar que el nombre de la columna no.
--
-- POR QUÉ EXISTE LA COLUMNA, que es lo que decide todo lo demás: lo que hacía falta NO es
-- ver las recurrentes juntas — es que NO ENSUCIEN EL RANKING. El Perro puntúa por «qué
-- mueve la aguja» y le pone deadline a todo; algo que se repite para siempre no tiene fin
-- ni deadline real, así que hoy compite por un puesto que no le corresponde, se lleva uno
-- de los 5 lugares de Prioridades, hunde el avance de su proyecto para siempre y titila
-- pidiendo una fecha que nunca va a tener. La vista «Recurrentes» es la consecuencia; la
-- causa es la EXCLUSIÓN (lib/plan-recurrentes.ts).
--
-- ⚠️ LAS DOS TABLAS EN LA MISMA MIGRACIÓN, igual que la 0162 y por el mismo motivo escrito
-- ahí: el tablero es UNO (`app/plan/board/BoardShell`) y lo montan el dueño (`plan_tareas`)
-- y cada cliente (`experimento_tareas`). Agregar la vista y el control en el componente
-- compartido y la columna en una sola tabla deja a la otra mitad con un control que no
-- puede guardar nada — que en este repo ya pasó con el slider de prioridad y se lee como
-- que la app está rota.
alter table plan_tareas        add column if not exists recurrente boolean not null default false;
alter table experimento_tareas add column if not exists recurrente boolean not null default false;

comment on column plan_tareas.recurrente        is 'true = se repite para siempre (la reunión de los miércoles, el seguimiento diario). No entra al ranking, no lleva deadline y no cuenta para el avance del proyecto (mig 0163).';
comment on column experimento_tareas.recurrente is 'true = se repite para siempre (la reunión de los miércoles, el seguimiento diario). No entra al ranking, no lleva deadline y no cuenta para el avance del proyecto (mig 0163).';

-- ⚠️ NO HAY BACKFILL, Y ES UNA DECISIÓN MEDIDA. Se buscaron candidatas por título en las
-- 212 tareas del ws1 (semanal / diaria / mensual / recurrente / rutina): 11 hits y NINGUNO
-- es una recurrencia — son «Diseñar la estructura de la junta semanal» o «Implementar la
-- cadencia de juntas», o sea tareas CON FIN que montan un ritual. Marcar por palabra clave
-- llenaría la vista con exactamente lo contrario de lo que busca. El flag lo pone una
-- persona (o, el día que exista la cubeta del juez en `lib/plan-criterio-reglas.ts`, la
-- extracción). La vista nace vacía y eso es correcto.

-- ⚠️ Sin este NOTIFY, PostgREST sigue sirviendo el esquema viejo y `supabase-js` contesta
-- 500 sobre la columna nueva hasta que recargue solo. `scripts/apply-migration.mjs` lo
-- manda igual después del DDL; va acá también para el que la aplique por otra puerta.
notify pgrst, 'reload schema';
