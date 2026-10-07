-- =============================================================================
-- 0215 — meta_campaign_drafts: la clave de idempotencia de una publicación
-- =============================================================================
-- ⚠️ SE APLICA ANTES DEL DEPLOY del código que la lee (tarea #59, 07/10/2026).
--
-- Desde ese commit, campaign-create, ad-add y adset-add reciben `idem_key` del
-- navegador y abren su fila en esta tabla ANTES de crear nada en Meta. Un reintento con
-- la misma clave —el caso real: la respuesta se perdió (504, pestaña cerrada) y el
-- borrador se volvió a publicar— contesta desde esa fila en vez de crear otra campaña.
--
-- Qué pasa si el código llega primero: la ruta detecta que la columna no existe (42703 /
-- PGRST204), lo loguea («falta la columna idem_key (migración 0215)») y publica por el
-- camino viejo, SIN idempotencia. No se bloquea a nadie, a propósito: en un clon
-- compartido cualquier sesión puede pushear este commit antes de que alguien aplique la
-- migración, y un 503 para todas las publicaciones de todos los clientes es peor que la
-- protección que todavía no había. Pero mientras falte, «reintentar es seguro» (el texto
-- que ve la persona después de un corte) es FALSO. Por eso: antes.
--
-- El índice es único y PARCIAL: las filas viejas, y las de los pedidos sin clave, no la
-- tienen y no compiten. La unicidad es por workspace: la clave la genera el navegador.
-- No hace falta un status nuevo (el CHECK de la 0157 sólo deja borrador / creando /
-- publicada / error): «a medias» se deriva de la fila (lib/meta-idempotencia.ts).
-- =============================================================================

begin;

alter table meta_campaign_drafts add column if not exists idem_key text;

create unique index if not exists uq_meta_campaign_drafts_idem
  on meta_campaign_drafts (workspace_id, idem_key)
  where idem_key is not null;

comment on column meta_campaign_drafts.idem_key is
  'Clave de idempotencia que manda el navegador al publicar (mig 0215). Misma clave = misma publicación: un reintento contesta desde esta fila en vez de crear de nuevo. Cambia cuando cambia lo que se publica.';

commit;

notify pgrst, 'reload schema';
