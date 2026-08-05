-- =============================================================================
-- 0119 — el canal «esta ya está hecha» de un borrador
-- =============================================================================
-- Un borrador de MaKo sabía decir tres cosas: creá estas tareas, preguntame esto y
-- (muerto en la UI) borrá aquellas. Le faltaba la cuarta, que es la que el dueño más
-- necesita: «esta que ya tenés en el tablero YA ESTÁ HECHA, mirá la evidencia».
--
-- CERRAR NO ES BORRAR, y por eso es una columna aparte y no un uso de `eliminar`:
-- borrar pierde el historial, la checklist y la razón; cerrar deja la tarjeta con su
-- rastro y suma la evidencia. Cada ítem: {id, evidencia, confianza}.
-- =============================================================================

alter table plan_propuestas add column if not exists cerrar jsonb not null default '[]'::jsonb;

comment on column plan_propuestas.cerrar is
  'Tareas que MaKo dice que ya están hechas: [{id, evidencia, confianza}]. Se confirman de a una en /plan/revisar; nunca se cierran solas.';
