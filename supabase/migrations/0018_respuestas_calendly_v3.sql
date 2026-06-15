-- =============================================================================
-- 0018 — Respuestas faltantes del formulario de Calendly (Mejoras v3, Fase B)
-- =============================================================================
-- El formulario real tiene 7 preguntas; v2 capturaba 4 y con keywords sueltas
-- que se cruzaban (ej: "equipo" matcheaba la pregunta de inversión en vez de
-- la de colaboradores). v3 mapea por frase distintiva y agrega las dos que
-- faltaban: inversión (Q3) y decisor (Q6).
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS respuesta_inversion TEXT,
  ADD COLUMN IF NOT EXISTS respuesta_decisor   TEXT;

COMMENT ON COLUMN leads.respuesta_inversion IS
  'Q3 Calendly: ¿Tienes posibilidad de invertir…? (Fase B v3).';
COMMENT ON COLUMN leads.respuesta_decisor IS
  'Q6 Calendly: además de ti, ¿hay alguien más que deba participar en la decisión? (Fase B v3).';

COMMIT;
