-- =============================================================================
-- 0091 — credenciales_auditoria: quién tocó qué llave, en la base y no en un log
-- =============================================================================
-- Hasta acá el único rastro de "alguien miró una credencial" era un console.warn
-- que caía en los logs de Vercel. Eso tiene tres problemas para una promesa BYOK:
--   1. Dura lo que dure la retención del plan.
--   2. No se puede consultar desde la app.
--   3. El cliente NO puede auditar su propio espacio — solo lo ve quien tiene la
--      consola de Vercel, o sea la agencia. El auditado controlaba la auditoría.
--
-- Acá el registro vive al lado de lo auditado, con el mismo workspace_id, y se
-- le puede mostrar al dueño del espacio.
--
-- NUNCA guarda el valor de la credencial: solo qué clave, quién y cuándo.
-- `permitido` = false registra los INTENTOS rechazados, que es lo que más
-- interesa (alguien probando de leer llaves de un espacio que no es suyo).
--
-- Seguro de re-ejecutar.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS credenciales_auditoria (
  id           BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES workspaces(id),
  clave        TEXT NOT NULL,                       -- env var (META_ACCESS_TOKEN, …). NUNCA el valor.
  accion       TEXT NOT NULL,                       -- revelar | guardar | borrar
  permitido    BOOLEAN NOT NULL DEFAULT TRUE,       -- false = intento rechazado
  autor        TEXT,                                -- email o sub de la sesión
  motivo       TEXT,                                -- por qué se rechazó, si aplica
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La consulta real es "qué pasó en MI espacio, lo más nuevo arriba".
CREATE INDEX IF NOT EXISTS credenciales_auditoria_ws_fecha_idx
  ON credenciales_auditoria (workspace_id, created_at DESC);

-- Igual que el resto de las tablas del repo: RLS activo, sin policies. La app
-- entra con la service_role (que bypassa RLS) y scopea a mano; esto solo cierra
-- la puerta a una conexión anon directa. Ver lib/workspace.ts.
ALTER TABLE credenciales_auditoria ENABLE ROW LEVEL SECURITY;

COMMIT;
