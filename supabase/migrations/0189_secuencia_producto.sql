-- =============================================================================
-- 0189 — una secuencia puede colgarse de la ENTREGA de un producto
-- =============================================================================
-- Martín, textual (05/10/2026): «si un CLIENTE actual llega a X etapa de mi SERVICIO
-- (onboarding, hito 1, hito 2…) … Y así también tu puedes aprovechar esto para poder
-- hacer secuencias de mensajes, ahora cuando caen en una etapa de CUSTOMER SUCCESS».
--
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy. Es aditiva y el código nuevo ya
-- la lee (`lib/nutricion.ts` la pide en el select de secuencias): desplegar primero el
-- código sin la columna hace que PostgREST rechace la consulta ENTERA —no la columna—,
-- o sea que el motor de nutrición se queda sin secuencias y deja de mandar TODO, en
-- silencio. Ver AGENTS.md → «Toda migración decide su ORDEN de despliegue» y «Un
-- `select` de PostgREST con UNA columna que no existe rechaza la consulta ENTERA».
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ POR QUÉ UNA COLUMNA NUEVA Y NO `funnel_id`
-- ─────────────────────────────────────────────────────────────────────────────
-- `nutricion_secuencias.funnel_id` (mig 0170) acota una secuencia al EMBUDO que la
-- vende, y el ámbito se resuelve contra `leads.funnel_id`. La entrega de un servicio
-- no tiene embudo: sus etapas viven en `producto_entrega` (mig 0188) y el cliente está
-- en `cliente_entrega`, las dos keyeadas por **producto**.
--
-- Y del producto al embudo hay DOS saltos (`producto ──oferta_productos──> oferta
-- ──funnel_ofertas──> funnel`), así que escribir el id de un producto en la columna del
-- embudo es un número correcto sobre la pregunta equivocada: haría match con el embudo
-- que tenga ese id, que es el de cualquier otra cosa. Lo midió la sesión de Customer
-- Success antes de que nadie lo escribiera, y por eso esto es una columna aparte.
--
-- Las dos columnas conviven y NO se pisan: una secuencia de venta usa `funnel_id` y una
-- de entrega usa `producto_id`. Lo que decide cuál se mira es el `trigger_tipo`
-- (`etapa_actual` vs `entrega_actual`), no la presencia del dato.
-- =============================================================================

alter table nutricion_secuencias
  add column if not exists producto_id bigint references productos(id) on delete cascade;

comment on column nutricion_secuencias.producto_id is
  'El PRODUCTO de cuya ENTREGA se cuelga la secuencia (trigger_tipo = entrega_actual). NULL = la etapa dispara en la entrega de cualquier producto. No es el embudo: para eso está funnel_id (mig 0170).';

-- El motor pregunta «¿qué secuencias activas se cuelgan de la entrega de este producto?»
-- en cada movimiento del kanban de Customer Success, así que el índice es por lo que se
-- filtra. Parcial: hoy las 62 filas tienen producto_id NULL y no hace falta indexarlas.
create index if not exists idx_nutricion_secuencias_producto
  on nutricion_secuencias (workspace_id, producto_id)
  where producto_id is not null;
