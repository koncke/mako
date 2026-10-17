-- =============================================================================
-- 0306 — Un OKR y un KPI suman UNO O VARIOS funnels
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy que la lee (o junto). El código nuevo pide la columna al leer; si todavía
-- no está, la lectura reintenta sin ella y todo OKR/KPI se lee como «todos los funnels» (lo de siempre), y guardar
-- uno CON funnels elegidos falla diciendo que falta esta migración. Agrega y no saca nada: idempotente.
--
-- Pedido del 17/10/2026 (un cliente por WhatsApp): «al momento de poner un OKR objetivo se referencia vs el funnel VSL
-- de negocio que escala y no del funnel de renovación. ¿Hay forma de relacionar ambos…? ¿cómo le digo de dónde tomar
-- los ingresos?». Martín: «Voy a agregar la opción de poder referenciar a varios CRM… que sea una selección múltiple y
-- que puedas seleccionar 1 o varios».
--
-- `funnel_ids` NULL (o vacío) = TODOS los funnels, el negocio entero: es lo que un OKR medía antes, así que las filas
-- que ya existen siguen dando el mismo número sin backfill. Los ids son de `funnels` (el del negocio, con SU id, no
-- NULL como en `leads.funnel_id`). Sin FK: un array no la admite, y un funnel borrado se muestra «ya no está».
--
-- Cómo cuenta un pago en un funnel (un pago no guarda su funnel): lib/funnels-elegidos.ts.

alter table objectives add column if not exists funnel_ids bigint[];
alter table kpis       add column if not exists funnel_ids bigint[];

comment on column objectives.funnel_ids is 'Los funnels cuyo avance suma este OKR. NULL o vacío = todos (mig 0306).';
comment on column kpis.funnel_ids       is 'Los funnels que cuenta este KPI automático (sólo las fuentes del CRM). NULL o vacío = todos (mig 0306).';
