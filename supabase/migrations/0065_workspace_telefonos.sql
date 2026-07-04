-- =============================================================================
-- 0065 — Teléfonos del workspace: los números desde los que se contacta a los
-- leads (una empresa puede tener varios), con su fuente y setters asignados.
-- =============================================================================
-- fuente: cómo está conectado el número —
--   'chatwoot'     → pasa por el inbox de Chatwoot (MaKo lo detecta si hay conexión)
--   'whatsapp_api' → API no oficial de WhatsApp (todavía no implementada)
--   'personal'     → número personal, sin integración
-- setters: emails de los setters que atienden ese número (jsonb array).

CREATE TABLE IF NOT EXISTS workspace_telefonos (
  id            bigserial PRIMARY KEY,
  workspace_id  bigint NOT NULL DEFAULT 1,
  numero        text NOT NULL,             -- número tal cual lo carga el usuario
  numero_norm   text,                      -- solo dígitos, para matchear con Chatwoot
  etiqueta      text,                      -- ej. "Setter Ana", "Línea principal"
  fuente        text NOT NULL DEFAULT 'personal',
  setters       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workspace_telefonos_ws ON workspace_telefonos (workspace_id);

COMMENT ON TABLE workspace_telefonos IS 'Números desde los que se contacta a los leads (por workspace), con fuente y setters.';
COMMENT ON COLUMN workspace_telefonos.fuente IS 'chatwoot | whatsapp_api | personal — cómo está conectado el número.';
COMMENT ON COLUMN workspace_telefonos.setters IS 'jsonb array de emails de setters que atienden este número.';
