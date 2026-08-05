-- =============================================================================
-- 0115 — "esto se hace acá adentro": la tarea sabe en qué tab se resuelve
-- =============================================================================
-- El pedido: «que el Perro identifique si una tarea se puede completar DENTRO de MaKo,
-- que dentro de la tarea te indique cómo, e incluso te dé el botón para ir a la tab.
-- Si la tarea es "publicar campaña de X", eso se hace en el Ads Manager de MaKo».
--
-- Guarda el id de una capacidad de lib/mako-capacidades.ts (lista cerrada, escrita a
-- mano). Vacío = esa tarea se hace afuera, y está perfecto: la mitad del trabajo de un
-- negocio no pasa por una pantalla.
-- =============================================================================

begin;

alter table plan_tareas        add column if not exists hacelo_en text;
alter table experimento_tareas add column if not exists hacelo_en text;

comment on column plan_tareas.hacelo_en is 'id de lib/mako-capacidades: la tarea se resuelve DENTRO de MaKo, en esa tab (mig 0115).';

commit;

notify pgrst, 'reload schema';
