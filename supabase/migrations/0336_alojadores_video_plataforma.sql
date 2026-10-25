-- =============================================================================
-- Migración 0336: los otros alojadores de video en marketing_metrics_daily
-- =============================================================================
-- Pedido de Martín (25/10/2026, por el Cerebro): «Implementa otros alojadores de video, no solo panda». El cron
-- app/api/cron/videos-daily escribe una fila por día del VSL del negocio cuando está en Wistia o en Bunny Stream, con la
-- misma forma que Panda (las columnas video_* de la 0010). El CHECK sólo aceptaba meta, youtube y panda: sin esto, el
-- insert rebota y el cron lo dice.
-- Vimeo y Cloudflare entran ya en la lista (su API no da reproducciones por día fuera de Enterprise / da minutos), para
-- que el día que se sumen no haga falta otra migración.
-- Idempotente: se puede correr dos veces.
-- =============================================================================

BEGIN;

ALTER TABLE marketing_metrics_daily
  DROP CONSTRAINT IF EXISTS marketing_metrics_daily_plataforma_check;
ALTER TABLE marketing_metrics_daily
  ADD CONSTRAINT marketing_metrics_daily_plataforma_check
  CHECK (plataforma IN ('meta', 'youtube', 'panda', 'wistia', 'bunny', 'vimeo', 'cloudflare'));

COMMIT;
