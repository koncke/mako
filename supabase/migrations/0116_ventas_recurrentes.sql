-- =============================================================================
-- 0116 — ventas recurrentes / suscripción en el CRM (#363)
-- =============================================================================
-- El CRM solo soportaba pago ÚNICO high-ticket: las cuotas tenían que sumar el
-- monto de cierre, así que una mensualidad tiraba "las cuotas exceden el cierre".
-- Se agrega el tipo de venta y los datos de la suscripción:
--   · venta_tipo = 'unico' (default, no toca nada existente) | 'suscripcion'
--   · suscripcion_monto_usd = importe MENSUAL (MRR)
--   · suscripcion_meses     = plazo fijo (N meses) o NULL = indefinida (mes a mes)
-- Reportes: el MRR se muestra APARTE del high-ticket único (fase 3).

ALTER TABLE leads ADD COLUMN IF NOT EXISTS venta_tipo text NOT NULL DEFAULT 'unico';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS suscripcion_monto_usd numeric;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS suscripcion_meses int;

COMMENT ON COLUMN leads.venta_tipo IS
  'Tipo de venta del deal: ''unico'' (pago único high-ticket, default) o ''suscripcion'' (recurrente mensual). #363';
COMMENT ON COLUMN leads.suscripcion_monto_usd IS
  'Importe MENSUAL (MRR) de la suscripción en USD. Null si venta_tipo=''unico''.';
COMMENT ON COLUMN leads.suscripcion_meses IS
  'Plazo de la suscripción en meses (venta a plazo fijo) o NULL = indefinida (mes a mes).';
