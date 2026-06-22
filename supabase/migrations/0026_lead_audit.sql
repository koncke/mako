-- =============================================================================
-- 0026 — lead_audit: historial real de cambios por lead
-- =============================================================================
-- Cada fila = un campo que cambió, con valor anterior/nuevo, quién lo hizo
-- (CRM / Fathom / Calendly / …) y cuándo. Lo escribe logLeadChanges() en
-- lib/leads.ts; lo lee la ficha del lead. Si la tabla no existe, el historial
-- simplemente sale vacío (no rompe nada).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lead_audit (
  id             BIGSERIAL PRIMARY KEY,
  lead_id        BIGINT NOT NULL,
  campo          TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  autor          TEXT NOT NULL DEFAULT 'CRM',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_audit_lead ON lead_audit (lead_id, created_at DESC);

COMMENT ON TABLE lead_audit IS 'Historial de cambios por lead (campo, valor anterior/nuevo, autor, fecha).';

COMMIT;
