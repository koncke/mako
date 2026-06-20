-- =============================================================================
-- 0028 — Duración del servicio (meses) en el lead
-- =============================================================================
-- El plan de pagos del CRM captura "Duración del servicio (meses)". No había
-- columna para persistirla; se agrega aquí.
-- =============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS duracion_meses SMALLINT;

COMMENT ON COLUMN leads.duracion_meses IS
  'Duración del servicio en meses (del plan de pagos del CRM).';
