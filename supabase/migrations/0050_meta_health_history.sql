-- =============================================================================
-- 0050 — meta_health_history: historial de estados NEGATIVOS de la cuenta de Meta
-- =============================================================================
-- Guarda un snapshot cuando la cuenta NO está sana (severidad != verde o entrega
-- frenada). Se escribe al ver /integraciones y en el cron horario, deduplicado
-- por cambio de estado (no repite la misma fila si nada cambió).
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS meta_health_history (
  id              BIGSERIAL PRIMARY KEY,
  severidad       TEXT NOT NULL,            -- rojo | ambar (nunca verde)
  status_label    TEXT,
  disable_reason  TEXT,
  entrega_frenada BOOLEAN NOT NULL DEFAULT FALSE,
  balance_mxn     NUMERIC,
  detalle         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_health_hist_created ON meta_health_history (created_at DESC);

COMMENT ON TABLE meta_health_history IS
  'Historial de estados negativos de la cuenta de Meta (severidad != verde o entrega frenada), deduplicado por cambio de estado.';

ALTER TABLE meta_health_history ENABLE ROW LEVEL SECURITY;

COMMIT;
