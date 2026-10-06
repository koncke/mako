-- =============================================================================
-- 0198_varias_lineas_whatsapp — varias líneas de WhatsApp por negocio (la parte que AGREGA)
-- =============================================================================
-- Pedido de Martín (06/10/2026): «haz que los usuarios puedan escanear varios QR, tener
-- varios WhatsApp… es la misma dinámica que "Productos" en el CRM: un desplegable que
-- cambiaría el chat. Y dentro del chatbot una opción para seleccionar de qué número sale
-- esa automatización».
--
-- ⚠️ ORDEN DE DESPLIEGUE: **ANTES** del deploy. Todo lo de acá lo LEE el código nuevo
-- (`es_default`, `etiqueta`, `nutricion_secuencias.instance_name`,
-- `wa_borradores.instance_name`) con listas de columnas explícitas: sin las columnas,
-- PostgREST rechaza la consulta entera y el motor de secuencias no lee ninguna.
--
-- ⚠️ Y LO QUE SACA va en OTRA migración, la 0199, DESPUÉS del deploy. El `unique
-- (workspace_id)` de la 0072 es lo que hoy usa el `upsert … onConflict: 'workspace_id'` del
-- código DESPLEGADO para conectar la línea: quitarlo antes de que llegue el código nuevo
-- (que hace `onConflict: 'instance_name'`) rompería «conectar» para todos en ese rato.
--
-- Medido contra producción el 06/10/2026, antes de escribirla:
--   · evolution_instancias: 3 filas (ws1, ws11, ws13), cada una `mako_ws<id>`.
--   · wa_mensajes con `instance_name = ''`: 12 (9 del ws1, 3 del ws11), todos salientes.
--     Los escribía `enviarYEspejar` con el nombre vacío; salieron por la ÚNICA línea que
--     esos workspaces tenían, así que el relleno de abajo es exacto, no una suposición.
-- =============================================================================

begin;

-- ── 1. Las líneas: cómo se llaman y cuál es la de por default ─────────────────
-- La ETIQUETA es el nombre que la persona le pone («Ventas», «Soporte») y es lo que dibuja
-- el desplegable. Nunca el `instance_name`: ése es un nombre NUESTRO.
alter table evolution_instancias add column if not exists etiqueta text;

-- La línea POR DEFAULT: por la que sale todo lo que no nombra una. Es lo que hace que
-- ningún camino viejo cambie de comportamiento.
alter table evolution_instancias add column if not exists es_default boolean not null default false;

-- A lo sumo UNA por workspace, y lo garantiza la base.
-- ⚠️ Sin esto, dos marcadas dejan al resolvedor eligiendo por el orden que devuelva
-- Postgres: el mensaje saldría un día por una línea y otro día por la otra, sin error.
create unique index if not exists idx_evolution_default_por_ws
  on evolution_instancias (workspace_id) where es_default;

-- Las filas de hoy son, por construcción, la única línea de su workspace: pasan a ser la
-- de por default. Sin el relleno, un workspace con una línea queda con CERO por default
-- (una regla que se aplica al escribir no arregla ni una fila ya escrita).
update evolution_instancias e set es_default = true
 where not e.es_default
   and not exists (select 1 from evolution_instancias b where b.workspace_id = e.workspace_id and b.es_default);

-- ── 2. De qué línea sale una automatización ──────────────────────────────────
-- `null` = la de por default, que es lo que dicen TODAS las filas de hoy: una secuencia que
-- nadie tocó se comporta igual que siempre, y quien tiene un solo número no elige nada.
-- Guarda el `instance_name` y no el id de la fila: es la llave con la que el espejo
-- (`wa_mensajes.instance_name`) y Evolution identifican la línea.
alter table nutricion_secuencias add column if not exists instance_name text;
comment on column nutricion_secuencias.instance_name is
  'Por qué línea de WhatsApp sale esta automatización (evolution_instancias.instance_name). NULL = la de por default. El resolvedor (lib/lineas-whatsapp.ts) exige que la línea sea del workspace: una ajena acá sería mandar desde el WhatsApp de otro cliente, y en ese caso NO se manda.';

-- ── 3. De qué línea sale un borrador ─────────────────────────────────────────
-- Un borrador que deja una secuencia tiene que salir por la línea de esa secuencia: si no,
-- el lead recibe el mensaje desde un número distinto del que le venía escribiendo.
alter table wa_borradores add column if not exists instance_name text;

-- ── 4. Los salientes del espejo que quedaron sin línea ───────────────────────
-- Ver la cabecera: salieron por la única línea de su workspace. Se rellena sólo donde esa
-- línea existe, para no inventarle una a nadie.
update wa_mensajes m set instance_name = 'mako_ws' || m.workspace_id
 where coalesce(m.instance_name, '') = ''
   and exists (select 1 from evolution_instancias e
                where e.workspace_id = m.workspace_id and e.instance_name = 'mako_ws' || m.workspace_id);

-- La bandeja filtra por línea: sin índice, cada apertura recorre el espejo entero del
-- workspace (33 mil filas en el ws11).
create index if not exists idx_wa_mensajes_linea on wa_mensajes (workspace_id, instance_name);

commit;
