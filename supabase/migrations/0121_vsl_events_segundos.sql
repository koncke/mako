-- =============================================================================
-- 0121 — vsl_events.segundos: el dato crudo del que se deriva la retención
-- =============================================================================
-- La curva de retención del VSL estuvo MUERTA del 2026-07-15 al 2026-08-05: en
-- 14 días entraron 299 'play' y 266 'exit', y los 266 exit con porcentaje = 0.
-- Cero hitos p5..p100.
--
-- CAUSA RAÍZ (verificada leyendo el player, no la doc): el reproductor de Panda
-- emite `panda_timeupdate` — el nombre que usa el snippet ES el correcto — pero
-- su payload trae SOLO { message, video, currentTime, isMutedIndicator,
-- isPreviousProgressLoaded }. NO trae `duration`. El snippet hacía:
--
--     if (d.duration) dur = d.duration;
--     if (!dur) return;          ← retornaba SIEMPRE
--
-- así que el porcentaje nunca se calculaba y el 'exit' salía con el 0 inicial.
-- La única fuente de `duration` en el navegador es el mensaje `panda_allData`
-- (playerData.duration), que el player emite por su cuenta y NO se le puede
-- pedir: la lista de mensajes que acepta del padre es cerrada (colors,
-- currentTime, pause, play, speed, volume, fullscreen…) y no incluye ninguno
-- de lectura.
--
-- DECISIÓN: dejar de depender del navegador para eso. El snippet manda los
-- SEGUNDOS ABSOLUTOS (currentTime, que Panda sí manda siempre) y el porcentaje
-- se deriva server-side con la duración que ya trae la API de Panda
-- (lib/panda.ts → fetchPandaRetention devuelve `duration` por video). Ventajas:
--   · un fallo del player degrada la precisión, ya no apaga la medición entera;
--   · es RETROACTIVO — si mañana cambia la duración conocida, los eventos ya
--     guardados se vuelven a porcentuar sin haber perdido nada.
--
-- Sale sola y adelantada al resto del VSL Analyst para que los datos empiecen a
-- acumularse mientras se construye la pantalla.
-- =============================================================================

begin;

alter table vsl_events add column if not exists segundos numeric;

comment on column vsl_events.segundos is
  'Posición absoluta en el video (currentTime del player, en segundos). Es el dato CRUDO: el % se deriva server-side con la duración de Panda /retention, porque panda_timeupdate no trae duration. NULL en eventos viejos (previos a 2026-08).';

-- La lectura del analyst es siempre "los eventos de ESTE video en ESTA ventana".
create index if not exists idx_vsl_events_ws_video_created
  on vsl_events (workspace_id, video_id, created_at);

-- …y la del semáforo de salud es "¿entró algo hoy en este workspace?".
create index if not exists idx_vsl_events_ws_created
  on vsl_events (workspace_id, created_at);

commit;

notify pgrst, 'reload schema';
