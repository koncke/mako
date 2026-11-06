-- =============================================================================
-- 0406 — Un «Email» del Calendario enlazado a un email de Email Marketing (la llamada con Thiago, 29/10/2026)
-- =============================================================================
-- Martín le dijo a Thiago que en el Calendario se programa «un anuncio, un email». Hasta hoy un evento de formato Email era
-- un recordatorio que se tildaba a mano (docs/promesas/2910-llamada-thiago.md). Desde esta migración un Email del
-- Calendario puede ENLAZARSE a un broadcast de Email Marketing: al enlazarlo se programa para la hora del evento (por la
-- misma regla que «Programar» en Email Marketing, `programar_broadcast`), y el evento muestra lo que pasó de verdad
-- (programado, enviado) en vez de un tilde.
--
-- EN PALABRAS: `email_broadcast_id` es el email que sale a esa hora. Si el email se borra en Email Marketing, el evento
-- vuelve a ser un recordatorio (`on delete set null`), sin borrarse.
--
-- ORDEN DE DESPLIEGUE: ANTES del código, o junto. La columna la leen y escriben sólo lib/calendario-email.ts y su operación
-- (`enlazar_email_calendario`); sin ella, el modal dice «falta un cambio en la base» y no enlaza nada. Ningún lector de
-- antes la nombra.
--
-- Número: 0406, libre el 6/11/2026 en main, en las ramas y en las etiquetas de origin.
-- Sin funciones: no hace falta revoke de EXECUTE. `calendario_eventos` ya tiene RLS.
-- =============================================================================

alter table calendario_eventos add column if not exists email_broadcast_id bigint references email_broadcasts(id) on delete set null;

create index if not exists calendario_eventos_email_broadcast_idx on calendario_eventos (email_broadcast_id) where email_broadcast_id is not null;
