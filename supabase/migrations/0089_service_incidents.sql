-- =============================================================================
-- 0089 — service_incidents: incidentes de servicios con INICIO y FIN
-- =============================================================================
-- Reemplaza el enfoque "snapshot" de meta_health_history (0050, que nunca se
-- aplicó): en vez de una fila por detección, guarda un INCIDENTE como un período
--   started_at  → cuándo se detectó el problema por primera vez
--   resolved_at → cuándo volvió a estar sano (NULL = en curso)
-- Se reconcilia al ver /integraciones y en el cron horario: abre un incidente por
-- servicio cuando aparece el problema, actualiza sus campos mientras persiste, y
-- lo cierra (resolved_at = now) cuando el servicio se recupera. Generaliza a
-- cualquier servicio (meta, openai, telegram, ...), no solo Meta.
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS service_incidents (
  id              BIGSERIAL PRIMARY KEY,
  workspace_id    BIGINT NOT NULL DEFAULT 1 REFERENCES workspaces(id),
  service         TEXT NOT NULL,                 -- meta | openai | telegram | ...
  severidad       TEXT NOT NULL,                 -- rojo | ambar
  status_label    TEXT,
  disable_reason  TEXT,
  entrega_frenada BOOLEAN NOT NULL DEFAULT FALSE,
  balance_mxn     NUMERIC,
  detalle         TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),  -- inicio del incidente
  resolved_at     TIMESTAMPTZ,                          -- fin (NULL = en curso)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Listado por workspace, más recientes primero.
CREATE INDEX IF NOT EXISTS idx_svc_inc_ws_started ON service_incidents (workspace_id, started_at DESC);
-- A lo sumo un incidente ABIERTO por (workspace, servicio): evita duplicados si
-- dos reconciliaciones corren casi a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_svc_inc_open ON service_incidents (workspace_id, service) WHERE resolved_at IS NULL;

COMMENT ON TABLE service_incidents IS
  'Incidentes de servicios (Meta y otros) como período: started_at → resolved_at (NULL = en curso). Se reconcilia al ver /integraciones y en el cron horario.';

ALTER TABLE service_incidents ENABLE ROW LEVEL SECURITY;

COMMIT;
