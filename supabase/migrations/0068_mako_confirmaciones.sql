-- =============================================================================
-- 0068 — mako_confirmaciones: cambios automáticos de MaKo pendientes de confirmar
-- =============================================================================
-- El CRM automático (lib/crm-auto.ts) aplica movimientos y, en los "fuertes"
-- (interpreta Fathom / WhatsApp), deja una fila acá. Al entrar al CRM, un modal
-- bloqueante los lista y el humano Confirma / Rechaza (revierte con el patch
-- `revert`) / elige una opción. Tenant table: scopeada por workspace_id.

CREATE TABLE IF NOT EXISTS mako_confirmaciones (
  id           BIGSERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id      BIGINT NOT NULL,
  lead_nombre  TEXT,
  regla        TEXT NOT NULL,                 -- 'T1' | 'T3' | 'T4' | 'T6'
  tipo         TEXT NOT NULL,                 -- 'reunion_check' | 'manual_vencida' | 'reactivacion' | ...
  clave        TEXT NOT NULL DEFAULT '',      -- dedup/anti-loop por (lead, regla, reunión): 'T1:j1', 'T3', ...
  titulo       TEXT NOT NULL,
  detalle      TEXT,
  aplicado     BOOLEAN NOT NULL DEFAULT false, -- MaKo ya cambió el lead (true) o pide decidir (false)
  cambios      JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{campo, antes, despues}] para mostrar
  revert       JSONB,                         -- patch de columnas del lead para deshacer (si aplicado)
  opciones     JSONB,                         -- [{key, label, stage?, motivo?, tone?}] acciones alternativas
  estado       TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'confirmado' | 'rechazado'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  TEXT
);

CREATE INDEX IF NOT EXISTS idx_mako_conf_ws_estado ON mako_confirmaciones (workspace_id, estado);
CREATE INDEX IF NOT EXISTS idx_mako_conf_lead_clave ON mako_confirmaciones (lead_id, clave);
-- Una sola confirmación pendiente por (workspace, lead, clave): evita duplicados
-- si el cron corre varias veces antes de que el humano resuelva.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mako_conf_pendiente
  ON mako_confirmaciones (workspace_id, lead_id, clave)
  WHERE estado = 'pendiente';
