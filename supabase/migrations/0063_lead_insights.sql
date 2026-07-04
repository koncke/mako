-- =============================================================================
-- 0063 — lead_insights: análisis generativo del lead (botón Generar/Regenerar)
-- =============================================================================
-- MaKo analiza TODO lo que se sabe del lead (llamadas Fathom analizadas, forms
-- de Calendly, chat de WhatsApp, transcript del anuncio de origen, tracking y
-- cobranza) y guarda un análisis estructurado. Cada "Generar" inserta una fila
-- (historial); la ficha muestra la más reciente.

CREATE TABLE IF NOT EXISTS lead_insights (
  id            bigserial PRIMARY KEY,
  workspace_id  bigint NOT NULL DEFAULT 1,
  lead_id       bigint NOT NULL,
  etapa         text,                       -- etapa del pipeline al generar
  contenido     jsonb NOT NULL,             -- análisis estructurado (resumen, dolor, ...)
  fuentes       jsonb,                      -- qué datos alimentaron el análisis
  model         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_insights_lead ON lead_insights (lead_id, created_at DESC);
