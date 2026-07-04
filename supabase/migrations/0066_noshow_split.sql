-- =============================================================================
-- 0066 — Rediseño del funnel: No Show separado por reunión (R1/R2/R3) + quitar
-- las nutriciones POSITIVAS como etapa (ahora derivadas).
-- =============================================================================
-- El tablero ya no genera 'noshow' único ni 'postagenda'/'postreunion' como
-- etapas. Migramos los overrides de pipeline_stage de los leads:
--   'noshow'      → 'noshow_r1'  (asumimos No Show de la R1; es lo más común)
--   'postagenda'  → NULL         (vuelve a derivarse: sigue en su etapa activa)
--   'postreunion' → NULL
-- Los leads con pipeline_stage NULL ya se re-derivan solos (deriveStageKey).

UPDATE leads SET pipeline_stage = 'noshow_r1' WHERE pipeline_stage = 'noshow';
UPDATE leads SET pipeline_stage = NULL        WHERE pipeline_stage IN ('postagenda', 'postreunion');
