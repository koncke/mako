-- =============================================================================
-- 0256 — offer_sesiones atadas a un FUNNEL del CRM (Offer v2)
-- =============================================================================
-- Pedido de Martín (11/10/2026): «Las ofertas deben estar atadas a los productos del CRM… un mismo
-- funnel puede tener varias "ofertas"… para que yo pueda seleccionar en qué funnel analizar o crear una
-- nueva oferta». «Funnel» = una fila de `funnels` (lo que el CRM dibuja en su desplegable, `leads.funnel_id`);
-- sus ofertas salen de `funnel_ofertas` (mig 0171). Corregido por el orquestador el 11/10 ~15:20: NO es
-- un producto de `productos`.
--
-- ⚠️ ORDEN DE DESPLIEGUE: **ANTES** del deploy que trae la v2 de app/api/offer y app/offer. AGREGA dos
-- columnas que el código nuevo YA LEE (AGENTS.md «Toda migración decide su ORDEN»): lib/offer-sesiones.ts
-- las pide en su `select`, y PostgREST rechaza la consulta ENTERA si una columna no existe — sin esta
-- migración la tab no abre ninguna conversación (no hay lectura tolerante, a propósito: se aplica antes).
-- No saca nada: la v1 desplegada no las mira, así que aplicarla antes no le molesta a nadie.
--
-- ⚠️ El número: 0255 lo tiene `0255_cobros_pasarela.sql` en la rama `pagos-pasarela` (worktree
-- C:/dev/wt-pagos, commit 28f4f081). Si al integrar alguien se adelantó con 0256, se RENUMERA antes de
-- pushear y se borra este archivo.
--
-- `funnel_id`: el funnel de la conversación. null = conversación de la v1 (el árbol la muestra en
--   «sueltas»). SIN FK A PROPÓSITO, igual que `oferta_id`: archivar o borrar un funnel desde el CRM no
--   tiene por qué borrar ni bloquear la conversación (con `on delete cascade` se perdería el historial;
--   con `restrict`, el CRM no podría borrar su funnel por culpa de Offer). Si el funnel ya no está, el
--   árbol la manda a «sueltas» (lib/offer-reglas.ts → construirArbol).
-- `oferta_base_id`: la oferta EXISTENTE que se analiza (modo 'analizar'); null = crear una nueva. Sin FK
--   por lo mismo: borrar la oferta desde su editor no borra el análisis. El modo NO es una columna: se
--   deriva de esta (una columna «modo» al lado sería una segunda copia que se desincroniza).
--
-- Las dos las escribe sólo el alta de la conversación (`crearSesion`), y no cambian después.
-- =============================================================================

begin;

alter table offer_sesiones add column if not exists funnel_id bigint;
alter table offer_sesiones add column if not exists oferta_base_id bigint;

comment on column offer_sesiones.funnel_id is
  'El funnel (fila de funnels) de la conversación de Offer v2; null en las de la v1. Sin FK a propósito: archivar el funnel no borra la conversación.';
comment on column offer_sesiones.oferta_base_id is
  'La oferta existente que se analiza (modo analizar); null = crear una nueva. Sin FK a propósito.';

-- El árbol y «Nueva oferta» (buscar una conversación vacía del mismo funnel) filtran por estas dos.
create index if not exists idx_offer_sesiones_ws_funnel on offer_sesiones (workspace_id, funnel_id);

commit;
