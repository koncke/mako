-- =============================================================================
-- 0025 — Transcripciones de los videos de los anuncios
-- =============================================================================
-- Una fila por anuncio (ad_id). El cron de transcripción baja el mp4 del video
-- (Graph API → source), lo manda a OpenAI (whisper-1) y guarda el texto aquí.
-- status: ok | sin_video (anuncio sin video) | muy_grande (>25MB, límite OpenAI)
--         | error. La presencia de la fila evita re-transcribir (ahorra costo).
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_transcripts (
  ad_id       TEXT PRIMARY KEY,
  video_id    TEXT,
  status      TEXT NOT NULL DEFAULT 'ok',
  transcript  TEXT,
  idioma      TEXT,
  duracion_s  NUMERIC,
  model       TEXT,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ad_transcripts IS
  'Transcripción del video de cada anuncio (OpenAI whisper-1). Llenada por el cron transcribe-ads y mostrada en el modal de /anuncios.';

ALTER TABLE ad_transcripts ENABLE ROW LEVEL SECURITY;
