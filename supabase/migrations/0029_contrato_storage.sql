-- =============================================================================
-- 0029 — Contrato del lead: archivo guardado en Storage + descarga
-- =============================================================================
-- El contrato subido en el CRM se guarda en el bucket privado 'contratos' y en
-- el lead quedan la ruta (para generar URLs firmadas de descarga) y el nombre
-- original del archivo.
-- =============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contrato_path   TEXT,
  ADD COLUMN IF NOT EXISTS contrato_nombre TEXT;

COMMENT ON COLUMN leads.contrato_path   IS 'Ruta del contrato en el bucket de Storage "contratos".';
COMMENT ON COLUMN leads.contrato_nombre IS 'Nombre original del archivo del contrato.';

-- Bucket privado para los contratos (idempotente). El acceso es solo vía
-- service_role (el server genera URLs firmadas para descargar).
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;
