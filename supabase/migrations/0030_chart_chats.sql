-- =============================================================================
-- 0030 — chart_chats: historial de conversaciones de IA por gráfico
-- =============================================================================
-- Cada gráfico que tenga el botón de IA guarda su hilo de conversación con Claude
-- acá, identificado por chart_key (ej. 'comercial-revenue-mensual'). El primer
-- mensaje siempre es del assistant (análisis automático).
-- Seguro de re-ejecutar (IF NOT EXISTS).
-- =============================================================================

CREATE TABLE IF NOT EXISTS chart_chats (
  id          BIGSERIAL PRIMARY KEY,
  chart_key   TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chart_chats_key_idx ON chart_chats (chart_key, created_at);

COMMENT ON TABLE chart_chats IS
  'Hilos de conversación con Claude por gráfico (botón de IA). chart_key agrupa el hilo.';
