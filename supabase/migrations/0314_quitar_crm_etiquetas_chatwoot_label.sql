-- =============================================================================
-- 0314 — Quitar crm_etiquetas.chatwoot_label (la columna del espejo con Chatwoot)
-- =============================================================================
-- SIN APLICAR (17/10/2026). La escribió «B1-Infra» para el pendiente «borrar los restos de Chatwoot»; no se corrió contra
-- producción: aplicarla es una decisión que se toma con el relevo de integraciones delante (docs/relevo/integraciones.md).
--
-- Chatwoot se borró el 09/10/2026 (código en la etiqueta de git `archivo/chatwoot-2026-10-09`). La columna guardaba el slug
-- de la etiqueta que el espejo creaba allá; sin Chatwoot no la lee ni la escribe nadie. Medido el 17/10/2026, en el código:
--   · lib/etiquetas.ts pide sus columnas por nombre (COLS) y no la incluye;
--   · lib/datos-mau.ts la ESTÁ OMITIENDO al copiar (`omitir`): quitarla de la base no cambia lo que copia;
--   · ninguna escritura la nombra (grep en app/, lib/, scripts/ y tests/: sólo comentarios y esa lista de omitir).
-- En la base tenía 2 filas con valor (docs/hallazgos-comunicacion.md): se pierden, a propósito. Si alguna vez se quiere
-- volver a Chatwoot, el espejo se vuelve a diseñar con la etiqueta de git, no con estos dos slugs.
--
-- Su CHECK (largo entre 1 y 255) era de la columna y se va con ella. Idempotente.

alter table crm_etiquetas drop column if exists chatwoot_label;

comment on table crm_etiquetas is 'Etiquetas del CRM de cada negocio. Todo lo que apunta a una etiqueta guarda su id. Vínculo opcional a una etapa como el par (funnel_id, etapa_key), NULL = producto del negocio. wa_instance+wa_label_id: la etiqueta del celular (Evolution).';
