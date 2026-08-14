-- =============================================================================
-- 0134 — `prueba`: qué eventos son de ESTA sesión de prueba
-- =============================================================================
-- El probador de tracking mostraba TODOS los eventos de las últimas 24 h, así que
-- al apretar «Probar» aparecían horarios de la mañana mezclados con los de recién
-- y no había forma de saber cuáles eran los propios. El dueño lo notó por los
-- horarios: «cuando hago una prueba de pixel en Meta solo se me prueban esos
-- eventos».
--
-- Es el mismo mecanismo que el `test_event_code` de Meta: la app abre la landing
-- con `?mko_test=<id>`, el snippet lo guarda en sessionStorage —para que
-- sobreviva a navegar dentro de esa pestaña— y lo manda en cada evento. El panel
-- filtra por ese id.
--
-- ⚠️ Por qué un marcador y no solo filtrar por hora: filtrar desde que arrancó la
-- prueba deja afuera los eventos viejos, pero NO los de otra gente que esté
-- visitando la página en ese momento — y esta landing tiene tráfico real (entran
-- leads cada pocos minutos). Un probador que te muestra la visita de un
-- desconocido como si fuera tuya es peor que uno que muestra de más: te hace
-- creer que tu código anda cuando lo que anda es el de la visita ajena.
--
-- Nullable y sin default en las dos tablas: un evento de tráfico normal NO es de
-- una prueba, y NULL dice exactamente eso.
-- =============================================================================

alter table public.vsl_events
  add column if not exists prueba text;

alter table public.landing_visits
  add column if not exists prueba text;

comment on column public.vsl_events.prueba is
  'Id de la sesión de prueba del probador de /integraciones (viene de ?mko_test=). NULL en el tráfico real.';
comment on column public.landing_visits.prueba is
  'Id de la sesión de prueba del probador de /integraciones (viene de ?mko_test=). NULL en el tráfico real.';

-- Índices parciales: el probador siempre filtra por marcador, y los eventos de
-- prueba son una fracción mínima de las dos tablas. Un índice completo ocuparía
-- de más para contestar lo mismo.
create index if not exists idx_vsl_events_prueba
  on public.vsl_events (workspace_id, prueba)
  where prueba is not null;

create index if not exists idx_landing_visits_prueba
  on public.landing_visits (workspace_id, prueba)
  where prueba is not null;
