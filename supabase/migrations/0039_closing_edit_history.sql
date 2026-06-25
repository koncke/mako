-- =============================================================================
-- 0039 — Closing Analyst: revisión humana del análisis + historial
-- =============================================================================
-- Permite editar/revisar las valoraciones que hizo la IA (a mano o pidiéndole a
-- MaKo que re-evalúe con un comentario). Cada cambio queda registrado en
-- edit_history; los cambios pisan los valores del análisis (dims/score/outcome)
-- y recalculan el puntaje final.
--   edit_history: [{ at, autor, tipo:'manual'|'mako', resumen, score_antes, score_despues }]
-- =============================================================================

ALTER TABLE closing_analyses
  ADD COLUMN IF NOT EXISTS edit_history JSONB,
  ADD COLUMN IF NOT EXISTS edited_at    TIMESTAMPTZ;

COMMENT ON COLUMN closing_analyses.edit_history IS
  'Historial de revisiones humanas del análisis (manual o con MaKo). Cada cambio pisa los valores y recalcula el score.';
