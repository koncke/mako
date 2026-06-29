-- =============================================================================
-- 0041 — Override de ángulo (edición manual) + flag de creativo de imagen
-- =============================================================================
-- angle_override: si el usuario corrige el ángulo de un anuncio, se guarda acá.
--   El re-análisis pisa `angle` (lo de la IA) pero NUNCA `angle_override`, así la
--   corrección manual sobrevive. La vista resuelve `coalesce(angle_override, angle)`.
-- es_imagen: true para creativos de imagen (sin video). Antes se descartaban;
--   ahora se analizan igual (ángulo/tags/nota desde el OCR + descripción) y se
--   muestran en Guiones, pero quedan fuera del cuadrante/embudo de retención.
-- =============================================================================

ALTER TABLE script_analyses
  ADD COLUMN IF NOT EXISTS angle_override TEXT,
  ADD COLUMN IF NOT EXISTS es_imagen      BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN script_analyses.angle_override IS
  'Ángulo corregido a mano por el usuario. Tiene prioridad sobre angle (IA) y no se pisa al re-analizar.';
