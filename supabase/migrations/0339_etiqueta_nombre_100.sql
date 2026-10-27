-- =============================================================================
-- 0339_etiqueta_nombre_100 — el nombre de una etiqueta del CRM llega a 100 (26/10/2026)
-- =============================================================================
-- Martín, 26/10/2026, sobre «Extraer de un grupo de WhatsApp»: «al agregarse al CRM siempre con una etiqueta con el nombre
-- del grupo donde vinieron... y tampoco quiero cambiar el nombre del grupo, que se llame exactamente igual». La etiqueta de
-- origen ES el nombre del grupo, sin campo para editarla (app/crm/TraerDeGrupoWA.tsx, `etiquetaDeGrupo` en
-- lib/grupo-wa-reglas.ts). El asunto de un grupo de WhatsApp llega a 100 caracteres y el de los 221 de Martín tiene 47
-- («16, 17 y 18 de JUNIO | RETO del Anuncio Ganador»): con el tope de 40 de la 0224, la etiqueta salía cortada.
--
--   · `crm_etiquetas.nombre`: el check pasa de 1..40 a 1..100. El mismo número es `TOPE_NOMBRE_ETIQUETA`
--     (lib/etiquetas-reglas.ts). Las etiquetas de WhatsApp sólo se LEEN de la línea (lib/evolution-labels.ts): MaKo no
--     crea ninguna allá con este nombre.
--
-- ORDEN: PRIMERO esta migración, después el código. Con el código nuevo y el check viejo, una etiqueta de 41 a 100 no se
-- crea: los traídos quedan sin la etiqueta y la pantalla lo dice («La etiqueta «…» no se pudo poner»), sin romper nada más.
-- Con la migración y el código viejo no cambia nada (el código corta en 40).
-- SÓLO AFLOJA un check: ninguna fila existente deja de cumplirlo. Seguro de re-ejecutar.
-- =============================================================================

alter table crm_etiquetas drop constraint if exists crm_etiquetas_nombre_check;
alter table crm_etiquetas add constraint crm_etiquetas_nombre_check check (length(btrim(nombre)) between 1 and 100);
