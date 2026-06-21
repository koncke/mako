-- =============================================================================
-- 0025 — funnel_config: toda la config del funnel (etapas + flechas) en JSON
-- =============================================================================
-- El rediseño del funnel (tab /funnel) guarda etapas y transiciones como un
-- único documento JSON (fila id=1). El CRM y "Datos sin marcar" leen de acá.
-- Si la tabla/fila no existe, la app cae a los defaults de lib/pipeline.ts
-- (todo renderiza igual; solo no persisten los cambios hasta aplicar esto).
--
-- Reemplaza el enfoque normalizado de 0024 (funnel_transitions / pipeline_stages
-- seguían existiendo pero ya no se usan para el funnel). Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS funnel_config (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT funnel_config_singleton CHECK (id = 1)
);

COMMENT ON TABLE funnel_config IS
  'Config del funnel (etapas + transiciones) como JSON, fila única id=1. Vacía = defaults de lib/pipeline.ts.';

COMMIT;
