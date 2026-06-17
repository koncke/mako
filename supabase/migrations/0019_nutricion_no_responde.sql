-- =============================================================================
-- 0019 — Nutrición + estado "no responde" (Mejoras v3, Fase G)
-- =============================================================================
-- Dos cambios sobre la tabla leads para el tab "Pendientes":
--   1) nutricion_realizada: marca si Mauricio corrió la serie de WhatsApp+email
--      de 7 días sobre un formulario que no agendó.
--   2) estado_lead gana el valor 'no_responde' (form que tras nutrición no
--      contesta ni agenda). Se extiende el CHECK existente.
-- =============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS nutricion_realizada BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN leads.nutricion_realizada IS
  'true si se corrió la etapa de nutrición (serie WhatsApp+email 7 días) sobre un form sin agenda. v3 Fase G.';

-- Extender el CHECK de estado_lead para incluir no_responde.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_estado_lead_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_estado_lead_check
  CHECK (estado_lead IN ('abierto', 'ganado', 'perdido', 'descalificado', 'no_responde'));
