-- =============================================================================
-- 0026 — Secciones estructuradas + tipo en las transcripciones
-- =============================================================================
-- secciones: array [{ "titulo": "Hook", "texto": "..." }] generado con OpenAI a
-- partir del guion (video) o del análisis de la imagen (anuncios sin video).
-- tipo: 'video' | 'imagen' — cómo se obtuvo el contenido.
-- Para anuncios sin video, ahora SÍ se procesan con visión (texto en la imagen
-- + descripción), así que su status pasa a 'ok' con tipo='imagen'.
-- =============================================================================

ALTER TABLE ad_transcripts
  ADD COLUMN IF NOT EXISTS secciones JSONB,
  ADD COLUMN IF NOT EXISTS tipo TEXT;

COMMENT ON COLUMN ad_transcripts.secciones IS
  'Guion/anuncio dividido en secciones con título (Hook, Problema, Oferta, CTA…). Generado por OpenAI.';
COMMENT ON COLUMN ad_transcripts.tipo IS
  'video (transcripción de audio) | imagen (OCR + descripción visual).';
