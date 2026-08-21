-- =============================================================================
-- 0140 — «esto no puede empezar hasta que aquello termine»
-- =============================================================================
-- El pedido, textual: «Hay proyectos y tareas que DEPENDEN de otros. Puede que haya
-- algunos que estén correlacionados, pero iniciar no depende del anterior. Pero otros sí,
-- dependen absolutamente de que el anterior se termine. Como por ejemplo el de Cobros y
-- Planes depende totalmente de que se termine la oferta y precios.»
--
-- Esa distinción es el corazón de la migración y por eso `clase` es una columna y no un
-- booleano escondido: 'bloquea' (dura — no puedo empezar) y 'ordena' (blanda — van juntas,
-- conviene después). Si las dos movieran el número serían la misma cosa con dos nombres.
--
-- POR QUÉ UNA TABLA Y NO UNA COLUMNA `depende_de jsonb` EN plan_tareas
-- --------------------------------------------------------------------
-- `guardarPlanTarea` (lib/plan-board.ts) hace `upsert(taskToRow(t))` de la FILA ENTERA en
-- cada guardado que llega del navegador. Un campo nuevo que alguien olvide agregar a
-- `taskToRow` no da error: se evapora en silencio en el próximo autosave, y el síntoma es
-- «se me borran las dependencias a veces». Con la relación afuera, ese modo de falla es
-- IMPOSIBLE por construcción, no una cosa que haya que recordar.
-- Además una arista tiene atributos propios —clase, razón, quién la puso, con cuánta
-- confianza— que en un `string[]` no entran.
--
-- LAS DOS PUNTAS SON DEL MISMO TIPO (`entidad`): tarea→tarea o proyecto→proyecto. Cruzar
-- niveles (una tarea que depende de un proyecto entero) se resuelve al EXPANDIR el grafo
-- en memoria, no guardando una arista mixta: así una sola regla explica todo el tablero.
--
-- ⚠️ NO hay foreign key y no puede haberla: la PK de plan_tareas es compuesta
-- (workspace_id, id) y acá conviven ids de dos tablas. O sea NO hay `on delete cascade`:
-- las aristas colgadas las barre el resolvedor (un id que no existe se ignora) y el
-- borrado las limpia a mano. Está escrito acá para que nadie lo descubra después.
-- =============================================================================

begin;

create table if not exists plan_dependencias (
  workspace_id bigint      not null default 1 references workspaces(id) on delete cascade,
  entidad      text        not null,                 -- 'tarea' | 'proyecto'
  de_id        text        not null,                 -- el que ESPERA   (B, en «B depende de A»)
  a_id         text        not null,                 -- el que va PRIMERO (A)
  clase        text        not null default 'bloquea',
  razon        text        not null default '',      -- 1 frase: QUÉ produce A que B necesita
  origen       text        not null default 'user',  -- Actor: 'user' | 'ia' | 'code'
  confianza    text,                                 -- 'alta' | 'media', solo si origen != 'user'
  created_at   timestamptz not null default now(),
  primary key (workspace_id, entidad, de_id, a_id)
);

-- La PK compuesta da el dedup gratis: volver a proponer la misma arista upsertea, no
-- duplica. El índice por `a_id` es para la lectura INVERSA —«¿qué destraba esto?»—, que es
-- la mitad que se usa para pintar «bloquea a N cosas» sin recorrer la tabla entera.
create index if not exists ix_plan_deps_a on plan_dependencias (workspace_id, entidad, a_id);

-- Igual que plan_proyectos/plan_tareas (mig 0093): RLS prendida y CERO policies. Nadie
-- entra con la key anónima; se lee y se escribe solo por `getTenantDb`, que scopea por
-- workspace. Ver lib/workspace.ts → TENANT_TABLES.
alter table plan_dependencias enable row level security;

comment on table  plan_dependencias      is 'Aristas CONFIRMADAS del plan: «de_id no puede empezar hasta que a_id termine». Lo que propone la IA vive en plan_propuestas.depende hasta que una persona lo acepta (mig 0140).';
comment on column plan_dependencias.clase is '«bloquea» = dura, frena la ejecución y hereda urgencia. «ordena» = blanda, solo dice que van juntas: NO toca ningún score (mig 0140).';

-- El canal de PROPUESTA, en la tabla que ya sirve para eso. Una columna por canal es el
-- patrón que esa tabla viene usando: `eliminar` (0095), `aplicadas` (0105), `cerrar` (0119).
-- ⚠️ NO reusar `notas`: ahí viven las PREGUNTAS del Perro, aunque el nombre no lo diga.
alter table plan_propuestas add column if not exists depende jsonb not null default '[]'::jsonb;
comment on column plan_propuestas.depende is '[{entidad,deId,aId,clase,razon,confianza,titulos:{de,a}}] — aristas PROPUESTAS por MaKo, se confirman en la revisión. Los TÍTULOS viajan a propósito: la pantalla no hace join y un id viejo se ve (mig 0140).';

commit;

notify pgrst, 'reload schema';
