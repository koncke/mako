-- =============================================================================
-- 0027 — Guardar la instrucción usada al re-generar la transcripción
-- =============================================================================
-- Cuando se re-genera con una instrucción propia para OpenAI, la guardamos para
-- tener registro de qué se pidió y poder mostrarla/precargarla en el modal.
-- =============================================================================

ALTER TABLE ad_transcripts
  ADD COLUMN IF NOT EXISTS instruccion TEXT;

COMMENT ON COLUMN ad_transcripts.instruccion IS
  'Última instrucción dada a OpenAI al re-generar (NULL si fue automática).';
