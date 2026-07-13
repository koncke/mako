-- =============================================================================
-- 0082 — Motivo de cada gasto de IA (para el historial en Integraciones)
-- =============================================================================
-- `feature` es la categoría gruesa (mako-guardian, checklist-coach, …). `motivo`
-- es la razón concreta y legible de esa llamada ("Debate de prioridad", "Nueva
-- tarea", "Eliminar tarea", "Re-priorización del plan", …). Se muestra en el
-- historial de gasto dentro de /integraciones, al lado del Saldo de IA.
-- =============================================================================

ALTER TABLE anthropic_usage ADD COLUMN IF NOT EXISTS motivo TEXT;

NOTIFY pgrst, 'reload schema';
