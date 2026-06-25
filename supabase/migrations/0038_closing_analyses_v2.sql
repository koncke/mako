-- =============================================================================
-- 0038 — Closing Analyst v2: análisis más profundo + grabación embebida
-- =============================================================================
-- Columnas nuevas para el rediseño de /closing:
--   embed_token       — token del share_url, para thumbnail (/share/<t>/thumbnail)
--                       y player embebido (/embed/<t>?timestamp=<seg>).
--   has_transcript    — true si el análisis SÍ vio un transcript real. El v1 a
--                       veces analizó con transcript vacío (rate-limit silenciado)
--                       y dejó score 0 falsos; estos quedan has_transcript=false y
--                       SE EXCLUYEN del promedio.
--   transcript_items  — cantidad de líneas del transcript (para mostrar).
--   strengths/weaknesses — [{title, quote, t_seconds, note}] con evidencia citada.
--   objections        — [{quote, t_seconds, handled(bool), note}].
--   annotations       — [{t_seconds, tone:'good'|'bad', label}] marcadores sobre
--                       el transcript completo.
--   next_step         — recomendación de próximo paso con el lead.
--   analysis_version  — 1 = v1 (frases pobres), 2 = v2 (profundo, con timestamps).
--
-- Las formas enriquecidas de moments/dims (v2) agregan t_seconds y quote:
--   moments: [{t_seconds, t:"MM:SS", tone, tag, quote}]
--   dims:    [{g, label, score, note, quote, t_seconds}]
-- =============================================================================

ALTER TABLE closing_analyses
  ADD COLUMN IF NOT EXISTS embed_token      TEXT,
  ADD COLUMN IF NOT EXISTS has_transcript   BOOLEAN,
  ADD COLUMN IF NOT EXISTS transcript_items INTEGER,
  ADD COLUMN IF NOT EXISTS strengths        JSONB,
  ADD COLUMN IF NOT EXISTS weaknesses       JSONB,
  ADD COLUMN IF NOT EXISTS objections       JSONB,
  ADD COLUMN IF NOT EXISTS annotations      JSONB,
  ADD COLUMN IF NOT EXISTS next_step        TEXT,
  ADD COLUMN IF NOT EXISTS analysis_version INTEGER NOT NULL DEFAULT 1;

-- Derivar el embed_token del share_url existente (.../share/<token>[?...]).
UPDATE closing_analyses
   SET embed_token = regexp_replace(share_url, '^.*/share/([^/?]+).*$', '\1')
 WHERE share_url ~ '/share/' AND (embed_token IS NULL OR embed_token = '');

COMMENT ON COLUMN closing_analyses.has_transcript IS
  'true si el análisis vio un transcript real. Los false (v1 con fetch fallido) se excluyen del promedio y deben re-analizarse.';
