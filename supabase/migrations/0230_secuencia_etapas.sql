-- =============================================================================
-- 0230_secuencia_etapas — el CRON de una automatización puede colgarse de VARIAS etapas
-- =============================================================================
-- Pedido de Martín (09/10/2026, cuarta tanda, punto 14): «le pedí "Quiero enviar una felicitaciones
-- a un alumno que terminó una clase", está bien que el CRON haya seleccionado la opción de Entrega en
-- lugar de Adquisición, pero... tal vez yo quiera enviar esa automatización en varias etapas, entonces
-- quiero que en el CRON se puedan seleccionar más de 1 etapa». El contrato, en
-- docs/chatbot-flujo-ramas-diseno.md → «CUARTA TANDA», decisión 14.
--
--  · `nutricion_secuencias.etapas` (text[]) — las etapas de UN kanban (las de venta de un embudo, o
--    las de la entrega de un producto) que disparan la automatización. Se llama como `etapa` en
--    plural a propósito: es la misma clave del stage, varias veces, y el ámbito (embudo o producto)
--    sigue en `funnel_id` / `producto_id`, que es uno solo. Mezclar adquisición y entrega, o dos
--    productos, no se puede escribir: el ámbito es UNA columna.
--
--  · LA REGLA DE LECTURA (`etapasDe`, lib/nutricion-etapa.ts, pura y con test): `etapas` manda
--    cuando no está vacía Y su PRIMERA es `etapa`; si no, vale `etapa` sola. `etapa` NO se borra ni
--    se deja de escribir: la escritura nueva pone ahí la primera (`setDisparadorEtapa` /
--    `setDisparadorEntrega`, lib/setting-secuencias.ts). La condición de coherencia es lo que hace
--    inofensivos a los escritores VIEJOS que sólo tocan `etapa` (la API de MaKo, /email): si
--    cambian la etapa, `etapas` deja de coincidir y queda ignorada, en vez de seguir mandando con la
--    lista vieja.
--
-- SIN BACKFILL: NULL ES el comportamiento de hoy (una sola etapa, la de `etapa`), así que las 62+
-- filas que ya están no necesitan nada. Un backfill `etapas = array[etapa]` no agregaría ningún dato
-- y le daría a cada fila una segunda copia de lo mismo que se puede desincronizar.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY. El motor (`getSecuenciasActivas`,
-- `getSecuenciasConStats`, lib/nutricion.ts) pasa a LEER `etapas`. Con el deploy adelantado NO se
-- rompe nada, A PROPÓSITO y al revés que la 0229: la lectura distingue la columna que falta
-- (42703 / PGRST204) de cualquier otro error, vuelve a pedir sin `etapas` y deja un log — el motor
-- es el que manda los mensajes de TODOS los clientes, y un `select` rechazado entero lo apagaba en
-- silencio. Lo que sí queda sin poder hacerse hasta aplicarla es GUARDAR varias etapas: una sola se
-- guarda como siempre; dos o más contestan «Aún no se pueden varias etapas».
-- =============================================================================

begin;

alter table public.nutricion_secuencias add column if not exists etapas text[];

comment on column public.nutricion_secuencias.etapas is
  'Las etapas (claves de stage) de UN kanban que disparan la automatización (/chatbot, CRON). Manda si no está vacía y su primera es `etapa`; si no, vale `etapa` sola (etapasDe, lib/nutricion-etapa.ts). NULL = una sola etapa, la de `etapa`. Lo escriben setDisparadorEtapa / setDisparadorEntrega (lib/setting-secuencias.ts).';

commit;
