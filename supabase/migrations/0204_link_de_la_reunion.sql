-- =============================================================================
-- 0204_link_de_la_reunion — el link para ENTRAR a la R1/R2, guardado al agendar
-- =============================================================================
-- Proyecto «Feature: Chatbot», tarea #17 (06/10/2026). Decisión de Martín: «A: 24h, 1h y 15min
-- con link, ws1, apago n8n». El recordatorio al lead (lib/reunion-recordatorio.ts →
-- `mandarRecordatoriosAlLead`) le manda al lead el link de su reunión, y hasta hoy no se guardaba
-- en ningún lado: `lib/calendly-agenda.ts` lo conocía para las reservas que hace MaKo y el webhook
-- de Calendly lo tiraba.
--
--  · `junta_1_url` / `junta_2_url` — el `scheduled_event.location.join_url` de la reserva (Meet,
--    Zoom…). Lo escribe app/api/webhooks/calendly/route.ts en cada reserva (también en NULL: una
--    reserva por teléfono no puede heredar el link de la anterior) y lo borra la cancelación de
--    ESA reunión. Sin link, el recordatorio sale con el texto sin el renglón del link.
--
-- No hay backfill: las reservas ya hechas salen sin link hasta que se reagenden. La mig sólo
-- AGREGA columnas nullable, así que no toca ni una fila.
--
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES O JUNTO con el deploy. El emisor LEE estas dos columnas en su
-- `select`, y PostgREST rechaza la consulta ENTERA si una columna no existe: sin la migración, el
-- recordatorio al lead no sale para nadie (el cron lo cuenta en `errores`, nada más). El webhook,
-- en cambio, las escribe en un update APARTE que no tira (`guardarLinkDeReunion` en lib/leads.ts),
-- así que la agenda sigue entrando aunque la migración llegue tarde.
-- =============================================================================

begin;

alter table leads
  add column if not exists junta_1_url text,
  add column if not exists junta_2_url text;

comment on column leads.junta_1_url is
  'Link para entrar a la R1 (join_url de Calendly). Lo usa el recordatorio al lead (lib/reunion-recordatorio.ts). NULL = sin link: el recordatorio sale sin ese renglón.';
comment on column leads.junta_2_url is
  'Link para entrar a la R2 (join_url de Calendly). Ver junta_1_url.';

commit;
