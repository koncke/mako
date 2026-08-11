-- =============================================================================
-- 0127_cs_visto — mirar la clase no es contestar la tarea
-- =============================================================================
-- El webhook de Whop dice que el cliente COMPLETÓ la clase. La tarea la contesta
-- después, en MaKo. Son dos hechos distintos y meterlos en la misma columna
-- borraría justo la diferencia que hay que ver antes de cada junta: «la vio y no
-- la contestó» es el estado que dispara el recordatorio, y sin esta columna se
-- confunde con «ni la abrió».
-- =============================================================================
begin;

alter table cs_respuestas add column if not exists visto_at timestamptz;

comment on column cs_respuestas.visto_at is
  'Cuándo completó la clase en Whop (webhook course_lesson_interaction.completed). Mirarla NO es contestar la tarea: eso es contestada_at.';

commit;
