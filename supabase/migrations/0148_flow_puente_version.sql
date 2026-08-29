-- =============================================================================
-- 0148 · El puente dice QUÉ VERSIÓN está corriendo
-- =============================================================================
-- La extensión se distribuye COPIADA (una carpeta desempaquetada por cliente), y
-- una copia se desincroniza el mismo día que se toca el código. Ya pasó dos
-- veces: un cliente estuvo una tarde entera con una versión de dos horas antes
-- mientras se diagnosticaban los síntomas de código que no corría, y el 29/08 no
-- se pudo saber desde el server si un arreglo del captcha estaba puesto.
--
-- No es telemetría: es la primera pregunta de cualquier diagnóstico. Sin esto,
-- cada uno arranca preguntándole al cliente qué versión tiene, y la respuesta
-- llega en minutos y a veces mal.
alter table public.flow_puentes
  add column if not exists version text not null default '';

comment on column public.flow_puentes.version is
  'Versión del manifest de la extensión que reportó el último latido. Vacío = una versión anterior a que esto existiera.';
