-- =============================================================================
-- 0088 — empresa_omitido: ignorar el dato "Empresa" de un lead
-- =============================================================================
-- El dueño muchas veces NO tiene la empresa del lead (B2C, form incompleto). Con
-- este flag, "Empresa" deja de contar como "dato sin marcar" en el CRM GENERAL
-- (el worklist getPendientesDeMarcar), aunque sigue visible como recordatorio
-- suave dentro de la ficha del lead. Se setea en lote desde "Marcar en lote".
-- Columna de la tabla leads (ya tiene RLS + workspace_id) → nada más que agregar.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS empresa_omitido boolean NOT NULL DEFAULT false;
