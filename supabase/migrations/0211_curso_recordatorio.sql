-- =============================================================================
-- 0211 — El RECORDATORIO de clases: cuándo se le recordó a un cliente, si le llegó, y cuándo le
--        llegó su link por WhatsApp
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: ANTES del deploy. El cron /api/cron/curso-sesiones
-- (lib/curso-mensajes.ts → `correrRecordatoriosDeClases`) LEE y ESCRIBE estas tres columnas, y
-- todo WhatsApp del curso con el link escribe `link_enviado_at` (`mandar`, mismo archivo).
-- Si el deploy llega primero, el cron NO se cae: la lectura detecta la columna faltante,
-- contesta `recordatorios.sinColumna: true` y el recordatorio no corre (los mensajes de las
-- llamadas salen igual, y el link sale aunque no se pueda anotar). Agrega y no saca nada: la
-- versión desplegada no las mira.
--
-- ⚠️ SI YA SE APLICÓ LA 0211 DE DOS COLUMNAS (la de antes de la revisión del 07/10/2026), SE
-- REAPLICA ENTERA: es idempotente, agrega `link_enviado_at` y corre su backfill. Sin la tercera
-- columna el cron contesta `sinColumna` y el recordatorio no corre.
--
-- POR QUÉ (#780). Decisión de Martín (06/10/2026): «por WhatsApp, a los 3 días sin entrar al
-- portal, sólo los videos sin ver de su etapa». El envío del ws1 está PRENDIDO, así que esto le
-- escribe de verdad a los clientes de Mauricio, y lo que impide escribirle dos veces es la marca.
--
-- LAS COLUMNAS.
--   · `recordatorio_at` = la marca del último recordatorio. Se escribe con COMPARE-AND-SET
--     (contra el valor recién leído) ANTES de mandar: dos corridas del mismo tick no le mandan
--     dos veces. Significa «se procesó», NO «le llegó» — igual que `curso_sesiones.aviso_*_at`.
--     También es el reloj de «no más de uno cada 3 días».
--   · `recordatorio_motivo` = por qué NO le llegó el último intento (sin teléfono, línea caída,
--     falló el envío). NULL = le llegó (o nunca se intentó). Lo que dice si le llegó es la marca
--     SIN motivo; un motivo con la marca vieja es un intento que ni se marcó (se sabía sin mandar).
--   · `link_enviado_at` = el último WhatsApp del curso que le LLEGÓ con su link («Mandar su link»
--     de la ficha, la etapa nueva, el previo y el posterior de una llamada, el recordatorio). Se
--     escribe sólo cuando el envío contestó ok.
--     POR QUÉ (revisión del 07/10/2026): `invitacion_enviada_at` es SÓLO la invitación por mail.
--     Sin esta columna, el cliente al que Mauricio le mandó el link por WhatsApp y nunca lo abrió
--     —sin invitación y sin ingresos— quedaba fuera del recordatorio, que es el caso más típico
--     de «nunca entró»; y a quien invitaron por mail hace días le podía llegar el recordatorio una
--     hora después de su link. El reloj de los 3 días arranca del contacto más reciente: el último
--     ingreso, la invitación por mail o esta columna.
--
-- EL BACKFILL, sólo de `link_enviado_at`: el último saliente de `wa_mensajes` que lleva SU link.
-- El link es `…/compartido/curso/c1.<ws>.<lead>.<versión>.<firma>` (lib/curso-acceso.ts), así
-- que el texto dice a quién se lo mandaron sin adivinar: se exige ese ws y ese lead con el punto
-- después (el lead 21 no matchea el 210), y si la fila del espejo nombra un lead, que sea él (un
-- link reenviado a otro no cuenta). Cubre lo mandado entre el 06/10/2026 (cuando se prendió el
-- envío del ws1) y este deploy, que hacia adelante lo escribe `mandar`. Sólo llena lo vacío:
-- reaplicarla no pisa nada. `recordatorio_*` van sin default ni backfill, a propósito: NULL es
-- «nunca se le recordó», que es lo cierto para todos hoy.
--
-- `curso_accesos` ya está en TENANT_TABLES y tiene RLS + revoke (mig 0202): no hay tabla nueva.
-- Idempotente: se puede reaplicar.

alter table curso_accesos add column if not exists recordatorio_at timestamptz;
alter table curso_accesos add column if not exists recordatorio_motivo text;
alter table curso_accesos add column if not exists link_enviado_at timestamptz;

comment on column curso_accesos.recordatorio_at is
  'Último recordatorio de clases (#780): se marca con compare-and-set ANTES de mandar. Significa que se procesó, no que le llegó.';
comment on column curso_accesos.recordatorio_motivo is
  'Por qué NO le llegó el último recordatorio de clases. NULL = le llegó (o nunca se intentó).';
comment on column curso_accesos.link_enviado_at is
  'Último WhatsApp del curso que le llegó con su link (se escribe sólo si el envío salió). Ancla del recordatorio de clases junto al último ingreso y la invitación por mail.';

with ultimo as (
  select a.id, max(m.wa_timestamp) as cuando
    from curso_accesos a
    join wa_mensajes m
      on m.workspace_id = a.workspace_id
     and (m.lead_id = a.lead_id or m.lead_id is null)
   where a.link_enviado_at is null
     and m.from_me
     and m.wa_timestamp is not null
     and m.texto like ('%/compartido/curso/c1.' || a.workspace_id::text || '.' || a.lead_id::text || '.%')
   group by a.id
)
update curso_accesos a
   set link_enviado_at = u.cuando
  from ultimo u
 where a.id = u.id
   and a.link_enviado_at is null;
