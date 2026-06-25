-- =============================================================================
-- 0040 — Historial de guiones nuevos valorados ("Analizá un guion nuevo")
-- =============================================================================
-- Cada vez que se valora un guion que TODAVÍA no está en Meta, se guarda acá el
-- guion pegado + la valoración completa de MaKo (jsonb). No se vincula a ad_id
-- (no es un anuncio): es el banco de borradores/ideas del usuario con su análisis.
-- Denormalizamos short/angle/hook_type/verdicto para la lista del historial.
-- =============================================================================

CREATE TABLE IF NOT EXISTS script_drafts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guion       TEXT NOT NULL,            -- el guion pegado
  short       TEXT,                     -- etiqueta corta (de la valoración)
  angle       TEXT,
  hook_type   TEXT,
  verdicto    TEXT,                     -- veredicto predicho
  valoracion  JSONB NOT NULL,           -- la Valoracion completa
  model       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_drafts_created ON script_drafts (created_at DESC);

COMMENT ON TABLE script_drafts IS
  'Historial de guiones nuevos (sin subir a Meta) valorados por MaKo en /script-analyst. Guion pegado + valoración completa. Lo llena POST /api/script-analyst/valorar.';

ALTER TABLE script_drafts ENABLE ROW LEVEL SECURITY;
