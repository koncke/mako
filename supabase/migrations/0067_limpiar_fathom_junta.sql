-- =============================================================================
-- 0067 — Limpieza de fathom_links: quitar placeholders viejos sin URL
-- =============================================================================
-- Algunos leads viejos quedaron con entradas placeholder en fathom_links
-- ({"url":"","label":"Junta 1"/"Junta 2"}) que aparecían en la edición de
-- Meetings para "completar". No son links reales: se quitan las entradas con URL
-- vacía (los links de verdad, con URL, se conservan).

UPDATE leads
SET fathom_links = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(fathom_links) AS elem
  WHERE COALESCE(elem->>'url', '') <> ''
)
WHERE fathom_links IS NOT NULL
  AND jsonb_typeof(fathom_links) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(fathom_links) AS e WHERE COALESCE(e->>'url', '') = ''
  );
