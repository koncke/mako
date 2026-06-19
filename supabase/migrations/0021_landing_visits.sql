-- =============================================================================
-- 0021 — landing_visits: pageviews de la landing, separados del VSL
-- =============================================================================
-- El beacon (app/api/track/vsl) ahora también recibe un evento de visita a la
-- landing { visitor_id, tipo_evento: 'pageview' }. Lo guardamos en una tabla
-- propia para NO contaminar vsl_events (que queda solo para play y retención).
-- =============================================================================

CREATE TABLE IF NOT EXISTS landing_visits (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_visits_visitor_created
  ON landing_visits (visitor_id, created_at);

COMMENT ON TABLE landing_visits IS
  'Pageviews de la landing por visitor_id (cookie nqe_visitor_id). Una fila por visita. Separada de vsl_events para no inflar las métricas de play/retención del VSL.';
