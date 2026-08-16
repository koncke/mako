-- =============================================================================
-- 0138 — cuándo se le avisó a esta persona que tenía cuenta
-- =============================================================================
-- Dar de alta creaba la fila y ahí terminaba: NADIE le avisaba. El estado
-- 'invitado' decía «nunca entró», que es verdad y no sirve para actuar — no
-- distingue «le llegó el mail y no entró» de «nunca supo que existía la cuenta»,
-- y son dos problemas distintos con dos arreglos distintos.
--
-- Esta columna es lo que hace accionable el botón «Reenviar acceso»: sin ella
-- reenviar es a ciegas y nadie sabe si va a ser el primer aviso o el cuarto.
--
-- NULL = nunca se le avisó (todas las filas que ya existen entran así, que es la
-- verdad: el mail no existía cuando se crearon).
alter table usuarios add column if not exists invitacion_enviada_at timestamptz;

comment on column usuarios.invitacion_enviada_at is
  'Último aviso de acceso enviado por mail. NULL = nunca se le avisó.';
