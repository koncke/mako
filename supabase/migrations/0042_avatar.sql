-- =============================================================================
-- 0042 — Avatar (público objetivo) del anuncio: clasificación IA + override
-- =============================================================================
-- avatar: la clave del avatar que la IA le asignó al guion (de la lista editable
--   en lib/script-avatares.ts; vacío si no hay avatares definidos o no aplica).
-- avatar_override: corrección manual del usuario. Tiene prioridad sobre avatar y
--   NO se pisa al re-analizar. La vista resuelve coalesce(avatar_override, avatar).
-- Espeja el patrón de angle / angle_override (migración 0041).
-- =============================================================================

ALTER TABLE script_analyses
  ADD COLUMN IF NOT EXISTS avatar          TEXT,
  ADD COLUMN IF NOT EXISTS avatar_override TEXT;

COMMENT ON COLUMN script_analyses.avatar_override IS
  'Avatar corregido a mano por el usuario. Tiene prioridad sobre avatar (IA) y no se pisa al re-analizar.';
