-- =============================================================================
-- 0039 — Análisis de guiones de video ads (Scripts Analyst)
-- =============================================================================
-- Una fila por anuncio (ad_id). El sync toma los anuncios con transcript en
-- ad_transcripts (0025), arma el contexto (transcript + métricas de Meta/CRM) y
-- corre Claude (Opus) que deriva lo CUALITATIVO del guion:
--   angle      — visionario | capataz | dolor | testimonio | oferta
--   hook_type  — promesa | testimonio | pregunta | dolor | resultado | recordatorio
--   format     — formato del creativo (UGC, talking head, screen-recording, …)
--   tags       — vocabulario controlado (sistema, dashboard, sin-frio, …) que
--                alimenta los "Patrones ganadores" de la vista.
--   beats      — el guion partido en bloques ordenados [{kind, t0, text}].
--   note       — diagnóstico estructural del guion (dónde frena / dónde pierde).
--   suggestion — gancho a probar (solo si el problema está en la entrada).
--
-- Lo CUANTITATIVO (spend, hook rate, retención por cuartiles, agendas, cierres,
-- frecuencia, veredicto, confianza) NO se guarda acá: se calcula EN VIVO en la
-- vista cruzando getSenalesRecon × los cuartiles de marketing_metrics_daily, así
-- las métricas nunca quedan stale. La presencia de la fila evita re-analizar y
-- ahorra costo de Claude (igual que ad_transcripts y closing_analyses).
--
-- status:  analizada | descartada | pendiente | error
--   - analizada   → tiene angle/beats/note (guion de video con transcript real)
--   - descartada  → no es analizable como guion (sin transcript / tipo imagen)
--   - pendiente   → quedó sin transcript todavía; se reintenta
--   - error       → falló el análisis; se reintenta / un humano lo re-dispara
-- =============================================================================

CREATE TABLE IF NOT EXISTS script_analyses (
  ad_id            TEXT PRIMARY KEY,

  -- Identidad del anuncio (snapshot para render sin depender del join)
  ad_name          TEXT,
  short            TEXT,           -- etiqueta corta (1-3 palabras) para mapa/tablas

  -- Clasificación del guion (derivada por Claude)
  angle            TEXT,           -- visionario | capataz | dolor | testimonio | oferta
  hook_type        TEXT,           -- promesa | testimonio | pregunta | dolor | resultado | recordatorio
  format           TEXT,           -- formato del creativo (texto corto)
  tags             JSONB,          -- ["sistema","dashboard",…]  vocabulario controlado

  -- Cuerpo del análisis
  beats            JSONB,          -- [{kind, t0, text}]  el guion en bloques ordenados
  note_title       TEXT,           -- título del diagnóstico
  note_text        TEXT,           -- diagnóstico estructural (1 párrafo)
  suggestion       TEXT,           -- gancho a probar (puede ser null)

  -- Contexto del análisis
  dur              NUMERIC,        -- duración del video analizada (segundos)
  transcript_chars INTEGER,        -- tamaño del transcript visto (para diagnóstico)

  status           TEXT NOT NULL DEFAULT 'pendiente',
  origen_clasif    TEXT,           -- 'claude' | 'heuristica'
  error            TEXT,
  model            TEXT,           -- modelo usado en el análisis
  analysis_version INTEGER NOT NULL DEFAULT 1,
  analyzed_at      TIMESTAMPTZ,    -- cuándo se corrió Claude

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_script_analyses_status ON script_analyses (status);
CREATE INDEX IF NOT EXISTS idx_script_analyses_angle  ON script_analyses (angle);

COMMENT ON TABLE script_analyses IS
  'Análisis cualitativo de guiones de video ads (Scripts Analyst). Llenada por /api/script-analyst/sync y el cron script-analyst-sync; mostrada en /script-analyst cruzada en vivo con las métricas de Meta/CRM. Una fila por ad_id evita re-analizar.';

ALTER TABLE script_analyses ENABLE ROW LEVEL SECURITY;
