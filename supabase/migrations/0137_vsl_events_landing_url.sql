-- =============================================================================
-- 0137 — `landing_url` en vsl_events: en CUÁL de tus páginas pasó cada cosa
-- =============================================================================
-- `landing_visits` tiene `landing_url` desde la mig 0061, así que siempre se supo
-- a qué página ENTRÓ alguien. Los eventos de video, clic y AGENDÓ no lo tenían:
-- se sabía qué HIZO la gente, pero no dónde.
--
-- Con una sola landing por cliente daba lo mismo. Dejó de darlo cuando el modal
-- del Pixel pasó a preguntar «¿cuál de tus páginas?» y a acotar todo lo de abajo
-- a esa elección: el filtro alcanzaba a las visitas y no a lo demás, así que el
-- chequeo «2. Reproduce tu video» podía darse por cumplido con un play de OTRA
-- página del mismo workspace. Una promesa cumplida a medias es peor que no
-- hacerla, porque nadie la audita.
--
-- ⚠️ NULLABLE Y SIN DEFAULT, y el default importa acá: los eventos de un Pixel
-- anterior a la v12 no traen la página y NUNCA la van a traer. NULL dice
-- exactamente eso — no se sabe — y el filtro de `landingDiagnostico` los DEJA
-- PASAR a propósito. Descartarlos sería más limpio y pintaría en rojo el chequeo
-- de alguien que tiene el Pixel funcionando y solo lo tiene viejo: castigarlo por
-- algo que no hizo mal. Se mezclan hasta que repegue el código, que es justo lo
-- que el aviso de «Pixel desactualizado» le pide.
--
-- Sin índice: la única consulta que la usa (`landingDiagnostico`) ya viene
-- acotada por workspace y por ventana de tiempo, y filtra en memoria sobre 40
-- filas. Un índice acá se paga en cada insert del beacon —que corre en cada
-- evento de cada visita— para no ahorrar nada.
-- =============================================================================

alter table public.vsl_events
  add column if not exists landing_url text;

comment on column public.vsl_events.landing_url is
  'URL de la página donde ocurrió el evento (viene del snippet v12+). NULL en los eventos de un Pixel anterior: no se sabe, y no se infiere.';
