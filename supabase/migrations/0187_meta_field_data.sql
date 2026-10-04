-- =============================================================================
-- 0187 — las respuestas CRUDAS del formulario de Meta y su fecha real
-- =============================================================================
-- `parseLeadFields` (lib/meta-leads-campos.ts) saca CUATRO campos de `field_data`
-- por coincidencia de palabra clave —email, nombre, teléfono, empresa— y hasta el
-- 04/10/2026 descartaba el resto sin dejar rastro. Los dos caminos de ingesta usan
-- ese parser: el webhook (app/api/webhooks/meta-leads/route.ts) y el poll
-- (lib/meta-leads.ts).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ AHORA, SI HOY NO SE PIERDE NADA
-- ─────────────────────────────────────────────────────────────────────────────
-- Medido contra la API de Meta y la base: el ÚNICO formulario que recibió leads
-- (el 686 del ws1) pregunta exactamente esos cuatro campos → 0 respuestas
-- descartadas. No hay nada que rescatar y esta migración NO rellena nada.
--
-- Pero el ws13 (Código Inmobiliario) tiene CINCO formularios con preguntas
-- personalizadas («en qué plazo busca vender», «cuál es su situación actual») y
-- cero leads todavía. El día que entre el primero, esa respuesta se descarta EN
-- SILENCIO y no hay columna donde ponerla — y **Meta borra el field_data a los 90
-- días**, así que no se recupera de ningún lado. Es el único dato de esta familia
-- que es irrecuperable: los nombres de campaña/anuncio se vuelven a pedir.
--
-- Y el `created_time`: el poll lo pedía sólo para cortar la ventana de los últimos
-- N días y el webhook ni lo pedía, así que un lead rescatado por el poll de hace
-- 60 días nacía con la fecha de la INGESTA. Un `created_at` que miente sobre
-- cuándo llegó el lead no da error: da una antigüedad plausible.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ORDEN DE DESPLIEGUE: **ANTES o JUNTO** con el deploy
-- ─────────────────────────────────────────────────────────────────────────────
-- Es aditiva y el código nuevo YA la escribe: `upsertLeadFromMeta` (lib/leads.ts)
-- manda las dos columnas en el INSERT y en el UPDATE, así que entre un deploy sin
-- ellas y la migración PostgREST rechaza la fila ENTERA y **cada lead de Meta que
-- entre en esa ventana se pierde** — con el webhook devolviendo 200. Ver AGENTS.md
-- → «Toda migración decide su ORDEN de despliegue».
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ SIN DEFAULT Y NULLABLE
-- ─────────────────────────────────────────────────────────────────────────────
-- Un lead que no vino de Meta —alta a mano, importación, Calendly, carrito— no
-- tiene nada que poner ahí, y esa diferencia importa: `null` es «no aplica» y
-- `'[]'::jsonb` sería «Meta mandó un formulario vacío». Un `default '[]'` les
-- pondría a los 1.500 leads que ya existen una respuesta vacía con cara de medida,
-- y cualquier lector pasaría a no poder distinguir los dos casos.
--
-- RLS: `leads` ya la tiene activada y es una tabla de inquilino con `workspace_id`
-- y su índice desde el día uno (está en `TENANT_TABLES`, lib/workspace.ts). Dos
-- columnas más no cambian nada de eso, y no hace falta índice: nadie filtra por
-- ellas — `meta_field_data` se lee por el lead que ya se tiene en la mano y la
-- fecha es un dato de la ficha, no un criterio de búsqueda.
-- =============================================================================

alter table leads add column if not exists meta_field_data jsonb;
alter table leads add column if not exists meta_created_at timestamptz;

comment on column leads.meta_field_data is
  'mig 0187 · Las respuestas crudas del formulario de Meta, tal como las manda (field_data). null = no vino de Meta (no es "vino vacío"). Meta las borra a los 90 días: una ingesta posterior sin respuestas NO pisa esta columna (columnasCrudasDeMeta, lib/meta-leads-campos.ts).';
comment on column leads.meta_created_at is
  'mig 0187 · Cuándo creó META el lead, no cuándo lo ingestamos (created_at). null = no vino de Meta, o la ingesta es anterior a esta columna.';
