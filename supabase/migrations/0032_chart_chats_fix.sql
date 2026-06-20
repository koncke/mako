-- =============================================================================
-- 0032 — fix chart_chats.chart_key + pin/archive en chart_sessions
-- =============================================================================
-- Los mensajes ahora cuelgan de session_id (0031); chart_key dejó de cargarse →
-- quitamos su NOT NULL. Sumamos pinned/archived a las sesiones.
-- =============================================================================

ALTER TABLE chart_chats ALTER COLUMN chart_key DROP NOT NULL;

ALTER TABLE chart_sessions ADD COLUMN IF NOT EXISTS pinned   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE chart_sessions ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
