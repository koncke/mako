-- =============================================================================
-- 0092 — capa: qué le vendimos a cada cliente
-- =============================================================================
-- La "capa" (de la oferta cebolla) deja de ser una rama del código y pasa a ser
-- un atributo del cliente: un workspace 'pm' compró el Plan + el Perro Guardián
-- y NO conecta ninguna integración; uno 'completo' compró todo el producto.
-- De la capa se derivan las tabs visibles, los pasos del onboarding y qué se
-- siembra al dar de alta — el catálogo vive en lib/capas.ts, esta columna solo
-- guarda cuál le tocó a cada uno.
--
-- Default 'completo' a propósito: los workspaces que ya existen (el dueño y el
-- cliente de prueba) tienen todo el producto, así que el default los deja
-- exactamente como están. Un cliente nuevo elige capa en el alta.
-- workspaces NO es tenant table (es el catálogo de inquilinos), así que no lleva
-- workspace_id; su RLS ya está declarada en 0054.

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS capa text NOT NULL DEFAULT 'completo';

COMMENT ON COLUMN workspaces.capa IS
  'Capa de la oferta que compró el cliente (lib/capas.ts): pm | completo. Deriva tabs, onboarding y seeds.';

-- Red de seguridad: una capa desconocida rompería el gating de tabs en silencio
-- (fail-open). Mejor que la base rechace el valor a que el cliente vea de más.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_capa_valida'
  ) THEN
    ALTER TABLE workspaces
      ADD CONSTRAINT workspaces_capa_valida CHECK (capa IN ('pm', 'completo'));
  END IF;
END $$;
