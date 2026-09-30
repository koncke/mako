-- =============================================================================
-- 0185 — la plantilla recurrente GENERA su instancia (#813)
-- =============================================================================
-- Martín, textual (25/09/2026): «agregar una vista de BAU, tareas recurrentes, que se
-- pueda definir cada cuánto tiempo se repite, en qué fechas… es una tarea recurrente que
-- es algo que vos tenés que hacer. Se agrega, es parte de tus tareas. Y que sea una tarea
-- que se crea cada cierto tiempo».
--
-- Lo que ya estaba: la columna `recurrente` (0163), la vista propia (0164) y la RRULE
-- (0167). Lo que faltaba lo dejó escrito la propia 0167: «Nada en este producto calcula la
-- próxima ocurrencia: el día es una ETIQUETA». Esto es lo que la vuelve un mecanismo.
--
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy. Aditiva, y el código nuevo ya la
-- lee. Ver AGENTS.md → «Toda migración decide su ORDEN de despliegue».
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL MODELO: LA PLANTILLA NO SE COMPLETA, LA INSTANCIA SÍ
-- ─────────────────────────────────────────────────────────────────────────────
-- La tarjeta recurrente sigue siendo lo que era desde la 0163: no compite en el ranking,
-- no lleva deadline y no cuenta para el avance de su proyecto. Lo que cambia es que ahora
-- PRODUCE: cuando toca, nace una tarea normal —con su fecha, que compite y que se
-- completa— apuntando a ella.
--
--   `recurrente_desde`  en la PLANTILLA: dónde arranca la serie.
--   `recurrente_de`     en la INSTANCIA: de qué plantilla salió.
--
-- ⚠️ POR QUÉ `recurrente_desde` Y NO ALCANZA CON `created_at`. Es el ANCLA, y de ella
-- depende la FASE de toda la serie: «cada 2 semanas, lunes y viernes» son los dos días de
-- una semana sí y otra no, y cuál de las dos semanas es depende del ancla. `created_at`
-- serviría hoy y dejaría de servir en cuanto alguien quiera arrancar la serie otro día —
-- y peor, moverla sería imposible sin mentir sobre cuándo se creó la tarjeta.
--
-- ⚠️ Y POR QUÉ NO HAY UNA COLUMNA `proxima_at`. Sería un dato DERIVADO (ancla + regla), o
-- sea un segundo lugar donde vive la misma verdad: el día que alguien edite la frecuencia
-- y no toque esa columna, la pantalla muestra una fecha que ya no corresponde y no hay
-- error. Se calcula al leer (`proximaFecha`, lib/plan-recurrentes-fechas.ts), que cuesta
-- microsegundos.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL ÍNDICE ÚNICO ES EL QUE IMPIDE DUPLICAR, NO EL CÓDIGO
-- ─────────────────────────────────────────────────────────────────────────────
-- Una plantilla × una fecha = una instancia, y lo dice la BASE. Con el candado acá el
-- generador es idempotente por construcción: puede correr dos veces, en dos instancias
-- del serverless, con un reintento en el medio, y no hay forma de que salgan dos tarjetas
-- para el mismo miércoles. Un candado en el código sería un `select` y un `insert` con una
-- carrera en el medio — exactamente lo que ya se pagó con los avisos duplicados del 27/09.
--
-- Es PARCIAL (`where recurrente_de is not null`) porque las tareas normales no tienen
-- plantilla y no se pueden pisar entre ellas por compartir fecha.
-- =============================================================================

-- ── El tablero del DUEÑO (ids de texto) ─────────────────────────────────────
alter table plan_tareas add column if not exists recurrente_desde date;
alter table plan_tareas add column if not exists recurrente_de    text;

-- ⚠️ LA FK LLEVA EL `workspace_id`, Y NO ES UNA FORMALIDAD. La PK de `plan_tareas` es
-- COMPUESTA —`(workspace_id, id)`— así que una FK contra `id` solo ni siquiera se puede
-- crear: Postgres contesta «there is no unique constraint matching given keys». Y lo que
-- se gana al escribirla entera es el guard que importa: una instancia NO puede colgar de
-- la plantilla de otro inquilino. Sin eso, un id de texto repetido entre dos workspaces
-- ata el trabajo de un cliente al ritual de otro, y no hay pantalla que lo muestre.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plan_tareas_recurrente_de_fk') then
    alter table plan_tareas add constraint plan_tareas_recurrente_de_fk
      foreign key (workspace_id, recurrente_de) references plan_tareas(workspace_id, id) on delete set null;
  end if;
end $$;

-- ⚠️ `on delete set null` y NO `cascade`. Borrar la plantilla de «grabar contenido» no
-- puede borrar el trabajo que YA se hizo: las instancias cerradas son el registro de que
-- ese ritual ocurrió. La instancia queda huérfana y sigue siendo una tarea normal, que es
-- exactamente lo que es.

-- ── El tablero del CLIENTE (ids numéricos) ──────────────────────────────────
-- Acá la PK sí es `id` solo, así que la FK va directa.
alter table experimento_tareas add column if not exists recurrente_desde date;
alter table experimento_tareas add column if not exists recurrente_de    bigint
  references experimento_tareas(id) on delete set null;

-- ── El candado ──────────────────────────────────────────────────────────────
-- Con el `workspace_id` adelante, por lo mismo que la FK: el id de texto de `plan_tareas`
-- es único DENTRO de un workspace, no entre todos.
create unique index if not exists plan_tareas_instancia_unica
  on plan_tareas (workspace_id, recurrente_de, deadline) where recurrente_de is not null;
create unique index if not exists experimento_tareas_instancia_unica
  on experimento_tareas (recurrente_de, deadline) where recurrente_de is not null;

-- Y el índice por el que el generador las busca: son pocas entre muchas.
create index if not exists plan_tareas_recurrentes
  on plan_tareas (workspace_id) where recurrente is true;
create index if not exists experimento_tareas_recurrentes
  on experimento_tareas (workspace_id) where recurrente is true;

-- ── EL BACKFILL, en el mismo commit ─────────────────────────────────────────
-- Una regla que se aplica al ESCRIBIR no arregla ni una fila ya escrita, y en un tablero
-- la mayoría no se toca nunca. Las recurrentes que YA existen arrancan su serie el día que
-- se crearon, que es la única fecha que tenemos y la que la persona esperaría.
--
-- ⚠️ Sólo las que se repiten: `recurrente_desde` en una tarea normal sería un ancla para
-- una serie que no existe, y el día que alguien la marque recurrente arrancaría la cuenta
-- desde su creación en vez de desde hoy.
update plan_tareas        set recurrente_desde = created_at::date
  where recurrente is true and recurrente_desde is null;
update experimento_tareas set recurrente_desde = created_at::date
  where recurrente is true and recurrente_desde is null;

comment on column plan_tareas.recurrente_desde is
  'mig 0185 · el ANCLA de la serie: de ella depende la fase («cada 2 semanas» ¿cuál semana?). Sólo en las recurrentes.';
comment on column plan_tareas.recurrente_de is
  'mig 0185 · de qué plantilla recurrente salió esta instancia. La plantilla no se completa; esta sí.';
comment on column experimento_tareas.recurrente_desde is
  'mig 0185 · el ANCLA de la serie: de ella depende la fase («cada 2 semanas» ¿cuál semana?). Sólo en las recurrentes.';
comment on column experimento_tareas.recurrente_de is
  'mig 0185 · de qué plantilla recurrente salió esta instancia. La plantilla no se completa; esta sí.';
