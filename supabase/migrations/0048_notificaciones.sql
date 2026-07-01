-- =============================================================================
-- 0048 — notificaciones: feed unificado de "lo que pasa en la app"
-- =============================================================================
-- Cada fila es un evento: reportes (diario/horario/semanal), alertas de semáforo,
-- fatiga de ads, wins, aprobaciones de plantilla, etc. Alimenta la campanita del
-- sidebar (centro de notificaciones) y sirve de bitácora durable de los envíos.
--
-- canal_wa: cola de reintento de WhatsApp. Cuando un reporte se quiere mandar por
-- WhatsApp pero la ventana de 24h está cerrada, queda 'pendiente' y el cron
-- horario lo reintenta al reabrirse la ventana. 'enviado' = ya salió; 'no' = ese
-- reporte no iba por WhatsApp.
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS notificaciones (
  id           BIGSERIAL PRIMARY KEY,

  tipo         TEXT NOT NULL,                 -- reporte_diario | reporte_horario | reporte_semanal
                                              -- | semaforo | ad_alert | win | plantilla | mensaje | sistema
  severidad    TEXT NOT NULL DEFAULT 'info',  -- info | ok | warn | urgente

  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  link         TEXT,                          -- ruta relativa a abrir al hacer clic

  entity_type  TEXT,                          -- lead | template | ad | reporte | null
  entity_id    TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,

  leido        BOOLEAN NOT NULL DEFAULT FALSE,
  leido_at     TIMESTAMPTZ,

  canal_wa     TEXT NOT NULL DEFAULT 'no',    -- no | pendiente | enviado
  origen       TEXT NOT NULL DEFAULT 'sistema',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_leido_created
  ON notificaciones (leido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_tipo_created
  ON notificaciones (tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_wa_pendiente
  ON notificaciones (canal_wa) WHERE canal_wa = 'pendiente';

COMMENT ON TABLE notificaciones IS
  'Feed unificado de notificaciones de la app (reportes, alertas, wins, plantillas, mensajes). Alimenta la campanita del sidebar. canal_wa = cola de reintento de WhatsApp fuera de la ventana de 24h.';

ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

COMMIT;
