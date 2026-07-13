-- =============================================================================
-- 0084 — workspace_id en las vistas de cohortes (cerrar fuga cross-tenant)
-- =============================================================================
-- v_cohortes_semanales / v_cohortes_mensuales agregaban `leads` SIN workspace_id
-- (GROUP BY solo por fecha). Se consultan vía getTenantDb, PERO getTenantDb no
-- scopea VISTAS (no están en TENANT_TABLES), así que el proxy era passthrough y
-- cualquier workspace veía el agregado GLOBAL de los leads de TODOS los clientes
-- en los KPIs de cohortes/Comercial (leak + KPIs corruptos entre clientes).
--
-- Fix: agregar workspace_id al SELECT (al FINAL, para que CREATE OR REPLACE VIEW
-- conserve las columnas previas en orden) y al GROUP BY. Tras esto, sumar ambas
-- vistas a TENANT_TABLES (lib/workspace.ts) para que el proxy filtre por ws.
--
-- Hoy los 514 leads son del dueño (ws 1), así que los números del dueño quedan
-- IDÉNTICOS: agrupar por workspace_id es un no-op mientras haya un solo workspace.
-- Idempotente (CREATE OR REPLACE): re-aplicable sin efectos.
-- =============================================================================

CREATE OR REPLACE VIEW v_cohortes_semanales AS
WITH base AS (
  SELECT
    workspace_id,
    DATE_TRUNC('week', fecha_junta_1)::DATE                                                  AS semana_inicio,
    COUNT(*)                                                                                 AS total_j1,
    COUNT(*) FILTER (WHERE asistio_j1 = TRUE)                                                AS asistencias,
    COUNT(*) FILTER (WHERE asistio_j1 = TRUE AND calificado = TRUE)                          AS limpias,
    COUNT(*) FILTER (WHERE cerro = TRUE)                                                     AS cierres,
    COALESCE(SUM(monto_cierre_usd) FILTER (WHERE cerro = TRUE), 0)                           AS ingreso_total_usd,
    MAX(fecha_junta_1)                                                                       AS ultima_j1_cohorte,
    AVG(fecha_cierre - fecha_junta_1) FILTER (WHERE cerro = TRUE AND fecha_cierre IS NOT NULL) AS dias_promedio_ciclo_raw
  FROM leads
  WHERE fecha_junta_1 IS NOT NULL
  GROUP BY workspace_id, DATE_TRUNC('week', fecha_junta_1)
)
SELECT
  semana_inicio,
  total_j1,
  asistencias,
  limpias,
  cierres,
  ingreso_total_usd,
  ultima_j1_cohorte,
  (CURRENT_DATE - ultima_j1_cohorte)                                                         AS dias_desde_ultima_j1,
  CASE
    WHEN (CURRENT_DATE - ultima_j1_cohorte) >= 14 THEN 'madura'
    WHEN (CURRENT_DATE - ultima_j1_cohorte) >= 5  THEN 'madurando'
    ELSE 'reciente'
  END                                                                                        AS estado_madurez,
  ROUND(dias_promedio_ciclo_raw::NUMERIC, 1)                                                 AS dias_promedio_ciclo,
  workspace_id                                                                               AS workspace_id
FROM base
ORDER BY semana_inicio DESC;

CREATE OR REPLACE VIEW v_cohortes_mensuales AS
WITH base AS (
  SELECT
    workspace_id,
    DATE_TRUNC('month', fecha_junta_1)::DATE                                                 AS mes_inicio,
    COUNT(*)                                                                                 AS total_j1,
    COUNT(*) FILTER (WHERE asistio_j1 = TRUE)                                                AS asistencias,
    COUNT(*) FILTER (WHERE asistio_j1 = TRUE AND calificado = TRUE)                          AS limpias,
    COUNT(*) FILTER (WHERE cerro = TRUE)                                                     AS cierres,
    COALESCE(SUM(monto_cierre_usd) FILTER (WHERE cerro = TRUE), 0)                           AS ingreso_total_usd,
    MAX(fecha_junta_1)                                                                       AS ultima_j1_cohorte,
    AVG(fecha_cierre - fecha_junta_1) FILTER (WHERE cerro = TRUE AND fecha_cierre IS NOT NULL) AS dias_promedio_ciclo_raw
  FROM leads
  WHERE fecha_junta_1 IS NOT NULL
  GROUP BY workspace_id, DATE_TRUNC('month', fecha_junta_1)
)
SELECT
  mes_inicio,
  total_j1,
  asistencias,
  limpias,
  cierres,
  ingreso_total_usd,
  ultima_j1_cohorte,
  (CURRENT_DATE - ultima_j1_cohorte)                                                         AS dias_desde_ultima_j1,
  ROUND(dias_promedio_ciclo_raw::NUMERIC, 1)                                                 AS dias_promedio_ciclo,
  CASE
    WHEN (CURRENT_DATE - ultima_j1_cohorte) >= 14 THEN 'madura'
    WHEN (CURRENT_DATE - ultima_j1_cohorte) >= 5  THEN 'madurando'
    ELSE 'reciente'
  END                                                                                        AS estado_madurez,
  workspace_id                                                                               AS workspace_id
FROM base
ORDER BY mes_inicio DESC;
