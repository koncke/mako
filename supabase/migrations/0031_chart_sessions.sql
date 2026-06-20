-- =============================================================================
-- 0031 — chart_sessions: múltiples conversaciones (New Chat) por gráfico
-- =============================================================================
-- Cada conversación con MaKo es una "session". Un gráfico (chart_key) puede tener
-- varias. La tab "Preguntale a MaKo" usa chart_key='mako-general'. Se guarda el
-- contexto del gráfico con la session para poder continuar la charla después.
-- Seguro de re-ejecutar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS chart_sessions (
  id          BIGSERIAL PRIMARY KEY,
  chart_key   TEXT NOT NULL,
  titulo      TEXT,
  contexto    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chart_sessions_key_idx ON chart_sessions (chart_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS chart_sessions_updated_idx ON chart_sessions (updated_at DESC);

-- Los mensajes pasan a colgar de una session.
ALTER TABLE chart_chats ADD COLUMN IF NOT EXISTS session_id BIGINT;
CREATE INDEX IF NOT EXISTS chart_chats_session_idx ON chart_chats (session_id, created_at);

COMMENT ON TABLE chart_sessions IS 'Conversaciones con MaKo (una por New Chat). Agrupa mensajes de chart_chats por session_id.';
