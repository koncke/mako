-- =============================================================================
-- 0017 — Profundidad de visualización del VSL (Mejoras v3, Fase A)
-- =============================================================================
-- Al quitar el botón de play de la landing para el autoplay de Panda, se perdió
-- el beacon por persona. La v3 lo recupera con un listener de los eventos
-- nativos de Panda (panda_play, panda_watchtime). Ahora el beacon manda, además
-- del play, el milestone de % visto (p10..p100). Guardamos esa profundidad.
--
-- vsl_events ya existía (v2 Fase 6) con event/play_count. Agregamos:
--   tipo_evento: 'play' | 'p10'..'p100'
--   porcentaje:  0-100 (del watchtime)
-- El `event` legacy se mantiene (lo derivamos en el endpoint) para no romper
-- contarVslPlays. Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

ALTER TABLE vsl_events
  ADD COLUMN IF NOT EXISTS tipo_evento TEXT,
  ADD COLUMN IF NOT EXISTS porcentaje  SMALLINT;

COMMENT ON COLUMN vsl_events.tipo_evento IS
  'play | p10..p100 (milestone de watchtime de Panda). Fuente por-persona del VSL (v3 Fase A).';
COMMENT ON COLUMN vsl_events.porcentaje IS
  'Porcentaje (0-100) del milestone de watchtime. NULL para el evento play.';

-- Engagement por visitante: índice de apoyo.
CREATE INDEX IF NOT EXISTS idx_vsl_events_visitor ON vsl_events (visitor_id);

COMMIT;
