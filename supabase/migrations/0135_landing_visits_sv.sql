-- =============================================================================
-- 0135 — `sv` en landing_visits: qué versión manda CADA página
-- =============================================================================
-- `landing.snippet_version` es UN valor por workspace: lo pisa el último evento
-- que llega, venga de donde venga. Alcanza para «este cliente quedó viejo», que
-- es lo que mira el cron, pero no para la pregunta que el dueño hizo al elegir
-- una landing del desplegable: «si selecciono un dominio donde no está instalado
-- o tiene una versión vieja, me lo debe decir».
--
-- Con un solo valor por workspace eso es imposible de contestar: un cliente con
-- dos landings —la vieja que quedó publicada y la nueva— tiene UNA versión
-- guardada, la del último pageview, y la pantalla diría lo mismo de las dos.
--
-- El pageview siempre trae `sv`, así que la versión por página sale de acá sin
-- pedirle nada nuevo al snippet. Nullable: las filas anteriores a esta migración
-- no la tienen, y NULL dice exactamente eso — no «versión 0».
-- =============================================================================

alter table public.landing_visits
  add column if not exists sv smallint;

comment on column public.landing_visits.sv is
  'Versión del snippet que mandó esta visita (SNIPPET_VERSION). NULL en las filas anteriores a la mig 0135.';

-- Para «¿qué versión manda ESTA página?»: se busca por url y se quiere la última.
create index if not exists idx_landing_visits_url_fecha
  on public.landing_visits (workspace_id, landing_url, created_at desc);
