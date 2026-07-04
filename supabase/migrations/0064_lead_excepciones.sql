-- =============================================================================
-- 0064 — excepciones declaradas del lead: sin R1 / sin R2 / reunión sin grabar
-- =============================================================================
-- Antes estas excepciones (cierre sin reunión, Fathom omitido) solo quedaban
-- como eventos del historial: cualquier re-validación de requisitos (gate de
-- Insights, backstop de movimientos) volvía a exigir los datos eximidos y
-- obligaba a repetir el wizard. Persistidas en el lead, se declaran UNA vez.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS sin_r1 boolean,
  ADD COLUMN IF NOT EXISTS sin_r2 boolean,
  ADD COLUMN IF NOT EXISTS fathom_omitido boolean;

COMMENT ON COLUMN leads.sin_r1 IS 'Excepción declarada: el cierre ocurrió sin Reunión 1 (motivo en el historial).';
COMMENT ON COLUMN leads.sin_r2 IS 'Excepción declarada: el cierre ocurrió sin Reunión 2 (motivo en el historial).';
COMMENT ON COLUMN leads.fathom_omitido IS 'Excepción declarada: la reunión no se grabó, no se exige link de Fathom.';
