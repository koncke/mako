-- =============================================================================
-- 0062 — lead_respuestas: respuestas del form de Calendly POR REUNIÓN
-- =============================================================================
-- R1 y R2 son agendas distintas con formularios propios: el lead puede responder
-- dos veces cosas distintas. Hoy solo existían columnas para UN set (el de R1).
-- Se guarda el set CRUDO (q/a) por reunión; se insertan históricos (reagendas) y
-- la ficha muestra el más reciente de cada reunión. Las columnas respuesta_* del
-- lead quedan como fallback legacy para R1.

CREATE TABLE IF NOT EXISTS lead_respuestas (
  id            bigserial PRIMARY KEY,
  workspace_id  bigint NOT NULL DEFAULT 1,
  lead_id       bigint NOT NULL,
  reunion       text NOT NULL CHECK (reunion IN ('R1','R2')),
  respuestas    jsonb NOT NULL,            -- [{ q, a }] crudo del webhook
  evento_inicio date,                      -- fecha de la reunión agendada
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_respuestas_lead ON lead_respuestas (lead_id, reunion, created_at DESC);
