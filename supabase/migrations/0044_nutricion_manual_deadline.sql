-- =============================================================================
-- 0044 — deadline para la nutrición manual
-- =============================================================================
-- Cuando un lead se aparca en "Nutrición - Manual" se fija una fecha límite.
-- Si vence sin que el lead se resuelva (sigue en 'manual' y 'abierto'), vuelve a
-- "datos sin marcar" con semáforo rojo. La columna se limpia al mover el lead a
-- cualquier otra etapa (lo hace setPipelineStage).

ALTER TABLE leads ADD COLUMN IF NOT EXISTS nutricion_manual_deadline date;

COMMENT ON COLUMN leads.nutricion_manual_deadline IS
  'Fecha límite de la nutrición manual; si vence sin resolución el lead reaparece en "datos sin marcar" (rojo). Null si el lead no está aparcado en manual.';
