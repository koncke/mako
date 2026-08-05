-- =============================================================================
-- 0117 — catálogo de PRODUCTOS / OFERTAS del workspace (#374, #2 del pedido)
-- =============================================================================
-- Hoy la "oferta" es UNA sola, plana, en app_settings (grupo 'oferta' del
-- onboarding). Los negocios tienen VARIOS productos (escalera de valor, low/high
-- ticket, suscripciones). Este catálogo los vuelve entidades: el CRM referencia
-- un producto al cerrar (producto_id en leads) y hereda su pricing (tipo/monto/
-- plazo), así el "¿es suscripción?" lo define el PRODUCTO, no una pregunta suelta.
--
-- Los campos espejan el grupo 'oferta' del onboarding (nombre/precio/promesa/
-- incluye/garantía) + el modelo de venta recurrente (mig 0116).
--
-- Multi-tenant SIN RLS: se scopea por el proxy getTenantDb → hay que sumar
-- 'productos' a TENANT_TABLES (lib/workspace.ts).

CREATE TABLE IF NOT EXISTS productos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id   bigint      NOT NULL,
  nombre         text        NOT NULL,
  tipo           text        NOT NULL DEFAULT 'unico',   -- 'unico' | 'suscripcion'
  monto_usd      numeric,                                 -- precio (único) o MENSUAL (suscripción)
  suscripcion_meses int,                                  -- plazo fijo; null = indefinida (solo suscripción)
  promesa        text,
  incluye        text,
  garantia       text,
  descripcion    text,
  activo         boolean     NOT NULL DEFAULT true,
  orden          int         NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_productos_ws ON productos(workspace_id);

-- El deal referencia al producto que se cerró (se completa desde el wizard, F2).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS producto_id bigint;

COMMENT ON TABLE productos IS 'Catálogo de productos/ofertas por workspace. El CRM referencia uno por deal (leads.producto_id) y hereda su pricing. #374';
COMMENT ON COLUMN leads.producto_id IS 'Producto del catálogo que se cerró en este deal (productos.id). Null = deal sin producto asignado (legacy).';
