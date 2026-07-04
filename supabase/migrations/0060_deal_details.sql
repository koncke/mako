-- =============================================================================
-- 0060 — Deal Details: secciones del deal extraídas del contrato, comprobantes
-- de pago e identidades fiscales propias (por workspace, carga manual).
-- =============================================================================

-- Secciones del deal en el lead (JSONB: flexibles y país-agnósticas).
--   deal_fiscal        { razon, id_fiscal, domicilio, correo, doc_path, doc_nombre }
--   deal_servicio      { que_es, fecha_inicio, fecha_termino, duracion, frecuencia, modalidad, sesiones }
--   deal_promesa       { resultado, garantia }
--   deal_obligaciones  { cliente: text[], prestador: text[] }
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_fiscal jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_servicio jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_promesa jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_obligaciones jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS facturado_por_id bigint;

-- Comprobante por cuota (archivo en Storage bucket 'contratos' bajo ws/lead) +
-- hora del pago (la fecha ya existe en fecha_pago).
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comprobante_path text;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comprobante_nombre text;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS pago_hora text;

-- Identidades fiscales PROPIAS ("Facturado por"): por workspace, sin seed —
-- cada workspace carga las suyas desde /configuraciones. Puede haber varias.
CREATE TABLE IF NOT EXISTS identidades_fiscales (
  id            bigserial PRIMARY KEY,
  workspace_id  bigint NOT NULL DEFAULT 1,
  nombre        text NOT NULL,             -- razón social o nombre
  id_fiscal     text,                      -- RFC, CUIT, NIT, EIN… según país
  domicilio     text,
  correo        text,
  es_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_identidades_fiscales_ws ON identidades_fiscales (workspace_id);
