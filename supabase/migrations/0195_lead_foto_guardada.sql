-- =============================================================================
-- 0195 — leads.foto_auto_url: la foto de WhatsApp del lead, GUARDADA en nuestro bucket
-- =============================================================================
-- Martín (06/10/2026), a la pregunta de si guardar las fotos: «Sí, guarda las fotos sin
-- problemas». La foto de WhatsApp de un contacto llega como una URL firmada de
-- pps.whatsapp.net que VENCE a los 10 días (medido: el parámetro `oe` menos la fecha de
-- guardado da 10,0 días en p50, p90 y máximo; hoy están vencidas 1298 de 1807 en el
-- cliente más grande). Con la URL vencida la ficha cae a las iniciales. Se copian los
-- BYTES a nuestro bucket mientras la URL vale, y la ficha usa esa copia.
--
-- ⚠️ NO ES `avatar_url`. Esa columna es la cara que ELIGIÓ una persona (mig 0173/0174) y
-- gana siempre; ésta la llena un cron y es sólo el respaldo de las iniciales. Mezclarlas
-- haría que la foto automática tapara la elegida, o que un refresco la pisara.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. El cron la escribe y la ficha la lee.
-- =============================================================================

alter table leads add column if not exists foto_auto_url text;
alter table leads add column if not exists foto_auto_at timestamptz;

comment on column leads.foto_auto_url is
  'Copia en nuestro bucket de la foto de WhatsApp del lead (la escribe el cron fotos-contacto). Respaldo de las iniciales; la cara elegida es avatar_url/icono.';
comment on column leads.foto_auto_at is
  'Cuándo se copió por última vez foto_auto_url. El cron la refresca pasados 30 días.';
