-- =============================================================================
-- 0024 — Funnel: transiciones (grafo) + etapa "Post Reunión" + rename a "Reunión"
-- =============================================================================
-- 1) Tabla funnel_transitions: el grafo etapa→etapa editable en la tab /funnel.
--    Alimenta las opciones contextuales de "Datos sin marcar". Si está vacía, la
--    app usa DEFAULT_TRANSITIONS (lib/pipeline.ts).
-- 2) Nueva etapa de nutrición "Post Reunión" (entre Reunión 1 y Reunión 2).
-- 3) Renombra los labels visibles "Agenda J1/J2" → "Agenda R1/R2" (las columnas
--    de BD fecha_junta_1/2, asistio_j1/2 NO se tocan: son internas).
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Transiciones del funnel
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funnel_transitions (
  id          BIGSERIAL PRIMARY KEY,
  from_stage  TEXT NOT NULL,
  to_stage    TEXT NOT NULL,
  label       TEXT NOT NULL,
  tone        TEXT NOT NULL DEFAULT 'accent',
  asistio_j1  BOOLEAN,
  asistio_j2  BOOLEAN,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE funnel_transitions IS
  'Grafo de transiciones del funnel (etapa → etapa). Editable en /funnel. Vacía = DEFAULT_TRANSITIONS (lib/pipeline.ts).';

-- Semilla con el grafo por defecto (idempotente: solo si la tabla está vacía).
INSERT INTO funnel_transitions (from_stage, to_stage, label, tone, asistio_j1, asistio_j2, sort)
SELECT * FROM (VALUES
  ('lead',        'agenda',      'Agendó R1',                'accent', NULL,  NULL,  0),
  ('lead',        'postagenda',  'Nutrición - Post Agenda',  'nutri',  NULL,  NULL,  1),
  ('lead',        'nutri',       'Nutrición - No Agenda',    'nutri',  NULL,  NULL,  2),
  ('agenda',      'agendaj2',    'Asistió · Agenda R2',      'accent', true,  NULL,  3),
  ('agenda',      'postreunion', 'Nutrición - Post Reunión', 'nutri',  true,  NULL,  4),
  ('agenda',      'noshow',      'No Show',                  'nutri',  false, NULL,  5),
  ('agenda',      'perdido',     'Perdido',                  'bad',    true,  NULL,  6),
  ('agenda',      'descal',      'Descalificado',            'bad',    true,  NULL,  7),
  ('postreunion', 'agendaj2',    'Agenda R2',                'accent', NULL,  NULL,  8),
  ('postreunion', 'perdido',     'Perdido',                  'bad',    NULL,  NULL,  9),
  ('postreunion', 'descal',      'Descalificado',            'bad',    NULL,  NULL,  10),
  ('postreunion', 'noresp',      'No responde',              'bad',    NULL,  NULL,  11),
  ('agendaj2',    'facturando',  'Asistió · Facturando',     'accent', NULL,  true,  12),
  ('agendaj2',    'ganado',      'Ganado',                   'good',   NULL,  true,  13),
  ('agendaj2',    'postagenda',  'No Show',                  'nutri',  NULL,  false, 14),
  ('agendaj2',    'perdido',     'Perdido',                  'bad',    NULL,  true,  15),
  ('agendaj2',    'descal',      'Descalificado',            'bad',    NULL,  true,  16),
  ('facturando',  'ganado',      'Ganado',                   'good',   NULL,  NULL,  17),
  ('facturando',  'nopaga',      'Nutrición - No Paga',      'nutri',  NULL,  NULL,  18),
  ('facturando',  'perdido',     'Perdido',                  'bad',    NULL,  NULL,  19)
) AS v(from_stage, to_stage, label, tone, asistio_j1, asistio_j2, sort)
WHERE NOT EXISTS (SELECT 1 FROM funnel_transitions);

-- -----------------------------------------------------------------------------
-- 2) Nueva etapa de nutrición "Post Reunión" (entre Agenda R1 y Agenda R2)
-- -----------------------------------------------------------------------------
-- Idempotente: solo hace lugar (+1 al sort desde Agenda R2) e inserta si la
-- etapa aún no existe (re-ejecutar no vuelve a correr el sort).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE key = 'postreunion') THEN
    UPDATE pipeline_stages SET sort = sort + 1 WHERE sort >= 2;
    INSERT INTO pipeline_stages (key, label, dot, tone, sort, custom)
      VALUES ('postreunion', 'Nutrición - Post Reunión', '#D9A400', 'warn', 2, false);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) Rename visible J1/J2 → R1/R2 en los labels de las etapas
-- -----------------------------------------------------------------------------
UPDATE pipeline_stages SET label = 'Agenda R1' WHERE key = 'agenda'   AND label = 'Agenda J1';
UPDATE pipeline_stages SET label = 'Agenda R2' WHERE key = 'agendaj2' AND label = 'Agenda J2';

COMMIT;
