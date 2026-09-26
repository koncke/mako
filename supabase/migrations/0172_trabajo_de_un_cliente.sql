-- =============================================================================
-- 0172 — DE QUIÉN es este trabajo: el cliente, en las dos mitades del tablero
-- =============================================================================
-- «No tengo forma de asignar proyectos o tareas a clientes» (26/09/2026). Y es
-- literal: `experimento_tareas.cliente_lead_id` existe desde la 0159 y está en
-- **0 de las 299 tareas del producto** (medido el 26/09 contra producción, los
-- cuatro workspaces). Una columna sin un solo escritor en la pantalla es una
-- columna que no existe: el único que la escribía era `lib/plan-propuesta.ts`,
-- y sólo para lo que nace de un borrador de reunión con el cliente ya resuelto.
--
-- Hasta hoy, quién es el dueño de un proyecto se adivinaba por el NOMBRE
-- («Cliente: Macario Romero»), y `app/customer-success/cruce.ts` documenta cómo
-- falla eso en las dos direcciones sobre los datos reales del ws1: 6 cruzaban,
-- 8 clientes se quedaban sin proyecto y 3 proyectos (30 tareas) sin cliente.
-- Un parecido no es una clave. Esto es la clave.
--
-- ⚠️ LAS CUATRO TABLAS EN LA MISMA MIGRACIÓN, Y NO ES SIMETRÍA DECORATIVA. El
-- tablero es UNO (`app/plan/board/BoardShell`) y lo montan DOS mitades:
--     · el super-admin  → `plan_tareas` + `plan_proyectos`
--     · cada cliente    → `experimento_tareas` + `tarea_categorias`
-- Agregar el control en el componente compartido y la columna en una sola mitad
-- deja a la otra con un campo que contesta 200 y no guarda nada. En este repo ya
-- pasó con el slider de prioridad, con el Quarter (0162) y con la recurrencia
-- (0164): las tres veces se leyó como que la app está rota.
--
-- ⚠️ Y ACÁ LA MITAD QUE FALTABA ERA JUSTO LA DEL DUEÑO. Medido el 26/09:
--     ws  experimento_tareas  tarea_categorias  plan_tareas  plan_proyectos
--      1        212                 19               0             0
--      9          0                  0             396            71   ← Martín
--     11         68                  9               0             0
--     13         19                  6               0             0
-- O sea: el trabajo del super-admin vive ENTERO en `plan_*`, y Customer Success
-- leía `experimento_*`. Por eso su tab de clientes decía «sin trabajo en el
-- tablero» para los tres: no fallaba el cruce, estaba leyendo la tabla vacía.
--
-- ⚠️ `cliente_nombre` SE DESNORMALIZA A PROPÓSITO, y tiene un costo que se acepta
-- con los ojos abiertos: si el lead se renombra en el CRM, acá queda el nombre
-- viejo hasta la próxima asignación. Se acepta porque el tablero tiene que poder
-- dibujar el chip sin ir a buscar `leads` en cada carga, que es exactamente el
-- mismo trato que ya hizo la 0159 para las tareas. La CLAVE es `cliente_lead_id`;
-- el nombre es una etiqueta para pintar, y ningún cálculo se apoya en él.
--
-- ⚠️ QUÉ SIGNIFICA LA COLUMNA, porque cambia respecto de la 0159. Allá el comentario
-- decía «cliente de la reunión de la que salió: la etiqueta de ORIGEN, no el
-- proyecto». A partir de acá significa DE QUIÉN ES EL TRABAJO, que es lo que la
-- pantalla pregunta y lo que Customer Success lee. No hay nada que migrar: las dos
-- lecturas coinciden en la práctica (una tarea que salió de una reunión con X es
-- trabajo para X) y, sobre todo, **no hay una sola fila escrita**. De dónde SALIÓ
-- la tarjeta ya lo cuenta su `fuente` (el chip de origen), que es otro campo.

-- ── la mitad del super-admin ────────────────────────────────────────────────
alter table plan_tareas    add column if not exists cliente_lead_id bigint references leads(id) on delete set null;
alter table plan_tareas    add column if not exists cliente_nombre  text;
alter table plan_proyectos add column if not exists cliente_lead_id bigint references leads(id) on delete set null;
alter table plan_proyectos add column if not exists cliente_nombre  text;

-- ── la mitad del cliente ────────────────────────────────────────────────────
-- `experimento_tareas` ya las tiene (mig 0159): no se repiten acá para no pisar
-- su `references`. Lo que faltaba era el PROYECTO, que es el nivel donde la
-- pregunta se contesta una vez y vale para todas sus tareas.
alter table tarea_categorias add column if not exists cliente_lead_id bigint references leads(id) on delete set null;
alter table tarea_categorias add column if not exists cliente_nombre  text;

-- Buscar «el trabajo de este cliente» es la consulta de la pantalla entera, y hoy
-- baja el tablero completo para filtrarlo en memoria. Los índices son parciales
-- porque la enorme mayoría de las filas no tiene cliente y no hay por qué indexarlas.
create index if not exists plan_tareas_cliente_idx       on plan_tareas       (workspace_id, cliente_lead_id) where cliente_lead_id is not null;
create index if not exists plan_proyectos_cliente_idx    on plan_proyectos    (workspace_id, cliente_lead_id) where cliente_lead_id is not null;
create index if not exists tarea_categorias_cliente_idx  on tarea_categorias  (workspace_id, cliente_lead_id) where cliente_lead_id is not null;
create index if not exists experimento_tareas_cliente_idx on experimento_tareas (workspace_id, cliente_lead_id) where cliente_lead_id is not null;

comment on column plan_tareas.cliente_lead_id      is 'DE QUIÉN es este trabajo: lead ganado del CRM (mig 0172). null = trabajo interno, que NO es lo mismo que «no se sabe».';
comment on column plan_tareas.cliente_nombre       is 'Nombre del cliente al momento de asignarlo. Etiqueta para pintar; la clave es cliente_lead_id (mig 0172).';
comment on column plan_proyectos.cliente_lead_id   is 'DE QUIÉN es este proyecto: lead ganado del CRM (mig 0172). Ata TODAS sus tareas a ese cliente.';
comment on column plan_proyectos.cliente_nombre    is 'Nombre del cliente al momento de asignarlo. Etiqueta para pintar; la clave es cliente_lead_id (mig 0172).';
comment on column tarea_categorias.cliente_lead_id is 'DE QUIÉN es este proyecto: lead ganado del CRM (mig 0172). Ata TODAS sus tareas a ese cliente.';
comment on column tarea_categorias.cliente_nombre  is 'Nombre del cliente al momento de asignarlo. Etiqueta para pintar; la clave es cliente_lead_id (mig 0172).';
comment on column experimento_tareas.cliente_lead_id is 'DE QUIÉN es este trabajo: lead ganado del CRM (mig 0159, resignificada en la 0172 — antes decía «el cliente de la reunión de la que salió»). De dónde SALIÓ lo cuenta `fuente`.';

-- ⚠️ ESTA MIGRACIÓN ES ADITIVA Y VA ANTES DEL DEPLOY. Nada se borra y nada cambia
-- de tipo, así que el código viejo sigue funcionando con las columnas nuevas
-- ignoradas. Es la regla que se aprendió rompiendo producción con la 0167, que
-- agregó y borró en el mismo paso: el código desplegado seguía mandando las
-- columnas viejas y CADA escritura de tarea daba 400. Lo aditivo va antes; lo
-- destructivo, después y en su propia migración.
