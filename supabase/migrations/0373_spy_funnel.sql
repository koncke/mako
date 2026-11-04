-- =============================================================================
-- 0373 — lo que hay detrás de la web de un competidor (Competitors Spy, 3/11/2026)
-- =============================================================================
-- Sus píxeles, a dónde manda a pagar y con qué reproductor muestra el video (lib/spy-funnel.ts).
--
-- ⚠️ COLUMNA PROPIA Y NO `etiquetas`: `podarVencido` tacha `etiquetas` a los 30 días, porque ahí viven
-- las etiquetas de los videos de YouTube. Lo de acá no es texto de YouTube, y `nombresDe` ya tiraba el
-- píxel que se guardaba ahí.
--
-- Va en la fila de la landing (`canal = 'landing'`) y no en el competidor: un competidor puede tener
-- varias páginas, y volver a leer una no le borra lo visto en otra.
--
-- Sólo AGREGA una columna que puede quedar en null: no cambia ninguna fila existente.
-- =============================================================================
begin;

alter table spy_piezas
  add column if not exists funnel jsonb;

comment on column spy_piezas.funnel is
  'Píxeles, checkout y video de una landing, como los vio cada lector: { pagina, navegador }. Cada lector escribe su lugar y la pantalla dibuja la unión: el servidor no ve lo que carga Tag Manager y el navegador no ve lo que frena un bloqueador. lib/spy-funnel.ts.';

commit;
