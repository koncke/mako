-- =============================================================================
-- 0194 — leads.web: la web del lead, en lugar de «Dirección» en la ficha
-- =============================================================================
-- Pedido de Martín (06/10/2026): «Saca en el resumen el dato de "Dirección" eso no
-- importa. En su lugar, pon "Web"». La dirección que se mostraba era el domicilio FISCAL
-- del deal (`deal_fiscal.domicilio`), que sigue viviendo en el deal; lo que la ficha
-- necesita a la vista es por dónde mirar el negocio del lead.
--
-- Texto libre: la escribe una persona en la ficha (se edita en el lugar, como el nombre o
-- la empresa) y la ficha de Customer Success la lee de acá también.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. El código nuevo la ESCRIBE (`saveLeadMeta`) y
-- la audita; sin la columna, guardar la web devolvería error y el historial no podría
-- diffearla. No hay backfill: no existe un dato previo de dónde sacarla.
-- =============================================================================

alter table leads add column if not exists web text;

comment on column leads.web is
  'Web del lead (texto libre, la escribe una persona en la ficha). Reemplazó a «Dirección» en la ficha el 06/10/2026.';
