-- =============================================================================
-- 0020 — Pipeline editable + Closer/Setter + links de Fathom (rediseño CRM)
-- =============================================================================
-- El rediseño del CRM (Claude Design) introduce un tablero Kanban con etapas
-- EDITABLES (agregar / renombrar / eliminar), además de los datos "Closer"
-- (en Agenda/Datos comerciales) y "Setter" (en Nutrición - Manual), y los
-- links a las grabaciones de Fathom por lead.
--
-- estado_lead se MANTIENE como fuente de verdad del desenlace (ganado/perdido/
-- descalificado/no_responde) — Revenue y CAPI lo siguen leyendo. `pipeline_stage`
-- es una capa de organización del tablero: cuando está seteada manda para
-- ubicar la tarjeta; cuando es NULL, la etapa se DERIVA de los campos del lead
-- (ver lib/pipeline.ts → deriveStageKey). lib/leads.ts mantiene ambos en sync
-- en los desenlaces terminales.
--
-- Seguro de re-ejecutar: IF NOT EXISTS en todo.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Columnas nuevas en leads
-- -----------------------------------------------------------------------------
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT,
  ADD COLUMN IF NOT EXISTS closer         TEXT,
  ADD COLUMN IF NOT EXISTS setter         TEXT,
  ADD COLUMN IF NOT EXISTS fathom_links   JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads (pipeline_stage);

COMMENT ON COLUMN leads.pipeline_stage IS
  'Etapa del tablero Kanban del CRM (override manual). NULL = derivar de los campos del lead. Ver lib/pipeline.ts.';
COMMENT ON COLUMN leads.closer IS 'Nombre del closer asignado (Datos comerciales / Agenda).';
COMMENT ON COLUMN leads.setter IS 'Nombre del setter asignado (Nutrición - Manual).';
COMMENT ON COLUMN leads.fathom_links IS
  'Links a grabaciones de Fathom: [{ "label": "Junta 1", "url": "https://fathom.video/..." }].';

-- -----------------------------------------------------------------------------
-- 2) Definición de las etapas del pipeline (editables por el usuario)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_stages (
  key        TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  dot        TEXT NOT NULL DEFAULT '#C8870C',
  tone       TEXT NOT NULL DEFAULT 'neutral',
  sort       INTEGER NOT NULL DEFAULT 0,
  custom     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pipeline_stages IS
  'Columnas del tablero Kanban del CRM. Si la tabla está vacía, la app usa DEFAULT_STAGES (lib/pipeline.ts).';

-- Semilla con las 13 etapas por defecto del diseño (idempotente).
INSERT INTO pipeline_stages (key, label, dot, tone, sort, custom) VALUES
  ('lead',       'Lead (Instant form)',     '#3B6FB0', 'info',    0,  false),
  ('agenda',     'Agenda J1',               '#C8870C', 'accent',  1,  false),
  ('agendaj2',   'Agenda J2',               '#2E7DBE', 'sky',     2,  false),
  ('facturando', 'Facturando',              '#0E8E7E', 'teal',    3,  false),
  ('ganado',     'Ganado',                  '#1C8A54', 'good',    4,  false),
  ('perdido',    'Perdido',                 '#CF4E29', 'bad',     5,  false),
  ('descal',     'Descalificado',           '#8A6D3B', 'taupe',   6,  false),
  ('noshow',     'Nutrición - No Show',     '#B5630A', 'orange',  7,  false),
  ('nutri',      'Nutrición - No Agenda',   '#6A4BD8', 'violet',  8,  false),
  ('nopaga',     'Nutrición - No Paga',     '#C7417B', 'rose',    9,  false),
  ('manual',     'Nutrición - Manual',      '#4F5BD5', 'indigo',  10, false),
  ('postagenda', 'Nutrición - Post Agenda', '#9D4EDD', 'magenta', 11, false),
  ('noresp',     'No responde',             '#A39E91', 'neutral', 12, false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
