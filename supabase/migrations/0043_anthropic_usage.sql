-- =============================================================================
-- 0043 — Registro de uso de la API de Anthropic (tokens + costo por operación)
-- =============================================================================
-- Una fila por cada llamada a Claude (chatClaude). Sirve para: mostrar el gasto
-- de cada operación, acumular el gasto del mes y derivar el "saldo restante"
-- (saldo que el usuario carga a mano − gasto real desde esa carga). El saldo
-- prepago real NO lo expone ninguna API de Anthropic; solo vive en la consola.
--   cost_usd: costo en USD calculado con el pricing del modelo (input/output +
--   caché). feature: qué parte de la app gastó (ads-rename, script-analyst, …).
-- =============================================================================

CREATE TABLE IF NOT EXISTS anthropic_usage (
  id                    BIGSERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  feature               TEXT NOT NULL DEFAULT 'otros',
  model                 TEXT,
  input_tokens          INTEGER NOT NULL DEFAULT 0,
  output_tokens         INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
  cost_usd              NUMERIC(12,6) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_anthropic_usage_created ON anthropic_usage (created_at DESC);
