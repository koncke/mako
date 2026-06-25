-- =============================================================================
-- 0037 — Análisis de llamadas de cierre (Closing Analyst)
-- =============================================================================
-- Una fila por grabación de Fathom (recording_id). El sync baja las llamadas de
-- la API de Fathom, las matchea contra un lead (por email del invitado externo),
-- clasifica si la llamada es de VENTA (R1/R2) o de ENTREGA DE SERVICIO/coaching/
-- interna, y — solo para las de venta — corre el análisis de Claude (SPIN +
-- ejecución, momentos clave, recomendaciones). La presencia de la fila evita
-- re-analizar (ahorra costo de Claude), igual que ad_transcripts.
--
-- category:  venta | entrega_servicio | interna | test | sin_clasificar
-- status:    analizada | descartada | pendiente | error
--   - venta            → status analizada (tiene score/dims/moments/recs)
--   - entrega_servicio
--     /interna/test    → status descartada (no es de venta; no se muestra en la
--                        lista principal, pero queda registrada para no reprocesar
--                        y para el contador de "excluidas")
--   - error            → falló el análisis; un humano puede re-disparar
-- =============================================================================

CREATE TABLE IF NOT EXISTS closing_analyses (
  recording_id   BIGINT PRIMARY KEY,

  -- Identidad de la llamada (denormalizada desde Fathom para render sin red)
  call_url       TEXT,           -- https://fathom.video/calls/<id>
  share_url      TEXT,           -- link público para "Ver grabación"
  title          TEXT,
  call_date      DATE,           -- fecha de la grabación en zona Tijuana (YYYY-MM-DD)
  started_at     TIMESTAMPTZ,    -- recording_start_time exacto
  duration_min   INTEGER,
  closer         TEXT,           -- closer derivado (lead.closer o host de Fathom)
  invitee_email  TEXT,           -- email del invitado externo matcheado

  -- Match con el lead (null si no hubo match en el CRM)
  lead_id        BIGINT,
  lead_nombre    TEXT,           -- snapshot del nombre del lead (display canónico)
  lead_empresa   TEXT,

  -- Clasificación
  category       TEXT NOT NULL DEFAULT 'sin_clasificar',
  origen_clasif  TEXT,           -- 'heuristica' | 'claude'  (cómo se clasificó)

  -- Análisis (solo category='venta') — el detalle vive en JSON
  tipo           TEXT,           -- 'R1' | 'R2' | null
  score          NUMERIC,        -- 0..10
  outcome        TEXT,           -- texto corto del desenlace ("Cierre ganado", …)
  outcome_tone   TEXT,           -- 'good' | 'warn' | 'bad'
  summary        TEXT,           -- resumen del análisis (1 párrafo)
  dims           JSONB,          -- [{g,label,score,note}]  SPIN + ejecución
  moments        JSONB,          -- [{t,tone,tag,quote}]    momentos clave
  recs           JSONB,          -- ["…", "…"]              coaching

  status         TEXT NOT NULL DEFAULT 'pendiente',
  error          TEXT,
  model          TEXT,           -- modelo usado en el análisis
  analyzed_at    TIMESTAMPTZ,    -- cuándo se corrió Claude

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closing_analyses_category ON closing_analyses (category);
CREATE INDEX IF NOT EXISTS idx_closing_analyses_call_date ON closing_analyses (call_date DESC);
CREATE INDEX IF NOT EXISTS idx_closing_analyses_lead ON closing_analyses (lead_id);

COMMENT ON TABLE closing_analyses IS
  'Análisis de cierre por grabación de Fathom (Closing Analyst). Llenada por el sync /api/closing/sync y el cron closing-sync; mostrada en /closing. Una fila por recording_id evita re-analizar.';

ALTER TABLE closing_analyses ENABLE ROW LEVEL SECURITY;
