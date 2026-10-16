-- =============================================================================
-- 0297 — «Re-priorizar todo»: el trabajo en segundo plano, y el candado del tablero del cliente
-- =============================================================================
-- 16/10/2026, decisión 9 de «hacer el kanban un kanban». El pedido, textual (Martín): «Quiero
-- hacerlo "libre", que se creen sin prioridad, y luego de última un botón en los 3 puntos de
-- arriba del plan para "re-priorizar" todo, y eso puede correr en segundo plano y no impedir que
-- el usuario siga utilizando todo».
--
-- DOS COSAS, LAS DOS SÓLO AGREGAN:
--
-- 1. `plan_repriorizaciones`: una fila por «Re-priorizar todo». La FOTO de qué tareas entran
--    (`ids`, en el orden en que se procesan), cuántas pasaron (`hechas`), el estado y el ÚLTIMO
--    error. La procesan en tandas chicas el sondeo del tablero (`after()`) y el cron
--    /api/cron/plan-repriorizar, que la drena aunque nadie tenga la pestaña abierta. Es el molde de
--    la 0186 (`flujo_corridas`): la fila es el estado, y avanza con compare-and-set sobre `vuelta`.
--    ⚠️ NO ES `plan_reprios` (mig 0144): esa es la AUDIENCIA, donde se le discute UN número al
--    Perro. Ésta es la corrida sobre el tablero entero.
--
-- 2. `experimento_tareas.score_manual`: el candado de «la fijaste a mano» en el tablero del
--    CLIENTE. ⚠️ LA COLUMNA YA EXISTÍA: la 0143 la agregó a las TRES tablas (plan_proyectos,
--    plan_tareas y experimento_tareas), y aplicar ésta en producción lo confirmó («already exists,
--    skipping»). Lo que no existía era quién la usara: en el tablero del cliente nadie la escribía
--    ni la leía, y dos comentarios del código (Repo.prioridadManual y repoPlan) afirmaban que la
--    tabla no la tenía. No hacía falta mientras el Perro del cliente sólo puntuaba lo que NACÍA;
--    «Re-priorizar todo» re-puntúa lo que ya existe, así que ahora hay algo de qué protegerse. El
--    `add column if not exists` queda como guarda para una base vieja, y el comentario de la
--    columna y el backfill son lo nuevo. ⚠️ La razón escrita no sirve de marca: el slider escribe
--    «La fijaste a mano» en la base y la pantalla se queda con «Prioridad fijada a mano», que el
--    próximo guardado sube — dos textos para el mismo candado, y cualquier otro guardado de la razón
--    lo borra. Medido el 16/10/2026: 0 filas del cliente con cualquiera de los dos textos, así que el
--    backfill no cambió ninguna; queda por si alguien fija una entre esta migración y el deploy (ver
--    la reconciliación de abajo).
--
-- ⚠️ ORDEN DE DESPLIEGUE: **ANTES** del deploy. El código nuevo lee y escribe la tabla nueva en
-- cada sondeo del tablero y en el cron de cada minuto: sin ella, «Re-priorizar todo» contesta un
-- error y el cron loguea uno por minuto. (La columna del punto 2 ya existe desde la 0143, así que
-- el slider del cliente no depende de esta migración.) Al revés —la migración antes— no cambia nada
-- para el código de hoy, que no nombra la tabla.
--
-- RECONCILIACIÓN, después del deploy (idempotente, toca sólo lo fijado entre la migración y el deploy):
--   update experimento_tareas set score_manual = true
--    where score_manual = false and score_razon in ('La fijaste a mano', 'Prioridad fijada a mano');
--
-- Scopeada por workspace: va a TENANT_TABLES (lib/workspace.ts) y a TABLAS_DE_INQUILINO
-- (lib/tablas-de-inquilino.ts). RLS prendida y sin policies, más el `revoke` explícito: la lee
-- sólo el server con service_role (AGENTS.md → «Toda migración decide su ORDEN»).
-- =============================================================================

begin;

create table if not exists plan_repriorizaciones (
  id            bigserial primary key,
  workspace_id  bigint not null references workspaces(id) on delete cascade,
  -- Cuál de los dos tableros (lib/tablero-de-capa.ts): el del super-admin (plan_tareas) o el del
  -- cliente (experimento_tareas).
  tablero       text not null check (tablero in ('dueno', 'cliente')),
  -- `corriendo` = hay tandas por hacer · `hecho` = terminó · `error` = una tanda falló tres veces y
  -- se cortó (lo hecho hasta ahí queda hecho).
  estado        text not null default 'corriendo' check (estado in ('corriendo', 'hecho', 'error')),
  -- `tareas` = recorre las tandas · `cierre` = lo que va una vez al final (el reparto del dueño).
  fase          text not null default 'tareas' check (fase in ('tareas', 'cierre')),
  -- LA FOTO: los ids de las tareas que entran, en el orden en que se procesan (texto: el dueño usa
  -- ids de texto y el cliente bigint). Lo que se cree después no entra.
  ids           text[] not null default '{}',
  total         int not null default 0,
  -- El cursor: cuántas de `ids` ya pasaron. Es lo que dibuja «Re-priorizando 40/185».
  hechas        int not null default 0,
  puntuadas     int not null default 0,
  ruteadas      int not null default 0,
  -- Las fijadas a mano que se RESPETARON: se cuentan, porque un candado que funciona y uno que nadie
  -- disparó se ven iguales si no hay un número al lado.
  fijadas       int not null default 0,
  -- Las que el modelo no alcanzó a puntuar en su tanda: conservan el número que tenían.
  sin_puntuar   int not null default 0,
  -- Los fallos de la tanda EN CURSO (vuelve a 0 cuando una sale). Al tercero, `error`.
  intentos      int not null default 0,
  -- EL COMPARE-AND-SET: quien toma una tanda sube `vuelta`, y su escritura final exige la vuelta
  -- que tomó. Dos drenajes (el sondeo y el cron) nunca procesan la misma tanda a la vez.
  vuelta        int not null default 0,
  -- Hasta cuándo la tiene tomada alguien (o hasta cuándo se espera para reintentar). NULL = libre.
  tomada_hasta  timestamptz,
  -- El ÚLTIMO error, aunque la tanda después haya salido: «falló y se recuperó» no es «nunca falló».
  error         text check (error is null or char_length(error) <= 500),
  -- El último modelo que contestó (si bajó de modelo por un 429, se ve acá).
  modelo        text,
  -- Lo que el tablero abierto tiene que pintar para no pisarlo en el próximo guardado (un
  -- `GuardPatch` por tarea, y los proyectos del cierre). Se vacía al arrancar el trabajo siguiente.
  cambios       jsonb not null default '[]'::jsonb,
  -- Quién lo pidió (el nombre de la persona, o «MaKo por WhatsApp») y por dónde.
  actor         text not null default '',
  origen        text not null default 'tablero' check (origen in ('tablero', 'api')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  terminado_at  timestamptz
);

-- UN SOLO TRABAJO A LA VEZ POR TABLERO. Lo garantiza la BASE, no una lectura previa: dos clics (o
-- un clic y un «sí» por WhatsApp) que llegan juntos leen los dos «no hay ninguno» y los dos
-- insertan; con el índice, el segundo choca (23505) y se le devuelve el que ya corre.
create unique index if not exists ux_plan_repriorizaciones_uno_por_tablero
  on plan_repriorizaciones (workspace_id, tablero)
  where estado = 'corriendo';

-- El cron pregunta siempre lo mismo, para todos los negocios: qué está corriendo.
create index if not exists ix_plan_repriorizaciones_corriendo
  on plan_repriorizaciones (tomada_hasta)
  where estado = 'corriendo';

-- Y el tablero y la API: el último trabajo de ESTE tablero.
create index if not exists ix_plan_repriorizaciones_ultimo
  on plan_repriorizaciones (workspace_id, tablero, id desc);

comment on table plan_repriorizaciones is
  '«Re-priorizar todo» del Plan (mig 0297): la foto de las tareas, el avance por tandas y el último error. La drenan el sondeo del tablero y /api/cron/plan-repriorizar. Scopeado por workspace. No confundir con plan_reprios (la audiencia de UN número).';

alter table plan_repriorizaciones enable row level security;
revoke all on plan_repriorizaciones from anon, authenticated;
revoke all on sequence plan_repriorizaciones_id_seq from anon, authenticated;

-- El candado del tablero del cliente (ver la cabecera, punto 2).
alter table experimento_tareas add column if not exists score_manual boolean not null default false;
comment on column experimento_tareas.score_manual is
  'La prioridad la fijó una persona (el slider o el lote): «Re-priorizar todo» no la toca. Columna de la mig 0143, que el tablero del cliente usa desde el 16/10/2026 (mig 0297). Lo pone y lo saca SÓLO la persona.';

update experimento_tareas set score_manual = true
 where score_manual = false and score_razon in ('La fijaste a mano', 'Prioridad fijada a mano');

commit;

notify pgrst, 'reload schema';
