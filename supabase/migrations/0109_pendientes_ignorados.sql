-- =============================================================================
-- 0109 — ignorar "Datos sin marcar" a nivel lead
-- =============================================================================
-- El usuario puede decidir que un lead no vale la pena completar (dato viejo,
-- lead muerto, etc.). Al ignorarlo, deja de aparecer en el worklist "Datos sin
-- marcar" del CRM general y de sumar al conteo — pero los mismos avisos siguen
-- vivos dentro de la ficha de cada lead (con opción de reactivar). Reversible.
-- Guarda el timestamp de cuándo se ignoró (null = no ignorado).

ALTER TABLE leads ADD COLUMN IF NOT EXISTS pendientes_ignorados timestamptz;

COMMENT ON COLUMN leads.pendientes_ignorados IS
  'Si está seteado, los "datos sin marcar" de este lead no notifican en el worklist del CRM general ni suman al conteo (siguen visibles como recordatorio suave en la ficha). Null = notifica normalmente.';
