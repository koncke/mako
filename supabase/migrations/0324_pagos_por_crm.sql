-- =============================================================================
-- 0324 — Los pagos son de un CRM: el plan de una renovación arranca de cero
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: se aplica ANTES del deploy que la lee. El código nuevo numera las cuotas de un CRM agregado
-- desde 1 (la cuota 1 de la renovación), y con el índice viejo `(lead_id, numero)` esa fila choca con la cuota 1 de la
-- venta de la casa: el plan no se guarda (lo dice: «falta la migración 0324»). Las columnas nuevas de `lead_funnel` las
-- lee la ficha; sin ellas, la ficha muestra el CRM agregado sin plan y no se puede escribir. Es idempotente.
--
-- Por qué (llamada con un cliente del 22/10/2026, Fathom 195129619, 10:00-12:19): en el CRM de renovaciones, la tab
-- Pagos de un cliente mostraba el plan de su PRIMER servicio («cuota 1, cobrada el 01/04»). El plan colgaba del LEAD
-- (`leads.cobro_inicial_usd`, `total_cuotas`, … y todas las filas de `pagos` del lead), no del par (lead, CRM). Un lead
-- está en su casa (`leads.funnel_id`) y en los CRMs a los que se lo agregó (`lead_funnel`, mig 0207), y cada CRM es un
-- servicio que se le vende aparte: «una vez que un cliente pasa a un nuevo CRM, se reinicia la etapa de pago».
--
-- LO QUE CAMBIA:
--   1. El TRATO de un CRM agregado vive en su fila de `lead_funnel` (estas columnas). El de la casa sigue en `leads`,
--      como siempre: nada se mueve de lugar.
--   2. Las cuotas se numeran POR CRM: el índice único pasa de `(lead_id, numero)` a `(lead_id, funnel_id, numero)`.
--   3. Un pago que nace SIN decir de qué CRM es (la pasarela, la API de MaKo, el asistente de Ganado) va a la CASA, no
--      al último CRM al que se agregó al lead (la regla de la 0310). Con los CRMs de prospección masiva (300 agregados
--      al «Sprint» del ws1 el 22/10), esa regla mandaba la cuota de la venta de siempre a un CRM donde nadie compró, y
--      la tab Pagos de la casa la dejaba de ver. Lo de un CRM agregado lo escribe su tab Pagos, diciendo el CRM.
--      La diferencia de un cobro por menos (`resto_de`, mig 0323) va al CRM de la cuota de la que salió.
--
-- LO QUE NO SE PIERDE: ningún pago cambia de CRM. Cada fila conserva el `funnel_id` que le puso la 0310 (el del día en
-- que se creó). Medido el 22/10/2026 (sólo lectura): ws1, 34 pagos, todos en la casa; ws11, 22 pagos y UNO (US$40,
-- cobrado) en un CRM agregado, que pasa a verse en la tab Pagos de ese CRM; ws13, 1 en la casa. Ningún pago sin funnel.

begin;

-- 1 · El trato de un CRM agregado (sin suscripción: una mensualidad sigue siendo de la casa).
alter table lead_funnel
  add column if not exists venta_tipo        text,
  add column if not exists monto_cierre_usd  numeric(12, 2),
  add column if not exists fecha_cierre      date,
  add column if not exists cobro_inicial_usd numeric(12, 2),
  add column if not exists monto_cuota_usd   numeric(12, 2),
  add column if not exists total_cuotas      smallint,
  add column if not exists dia_de_pago       smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lead_funnel_venta_tipo_check') then
    alter table lead_funnel add constraint lead_funnel_venta_tipo_check check (venta_tipo is null or venta_tipo in ('unico', 'sin_cobro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lead_funnel_total_cuotas_check') then
    alter table lead_funnel add constraint lead_funnel_total_cuotas_check check (total_cuotas is null or total_cuotas between 1 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lead_funnel_dia_de_pago_check') then
    alter table lead_funnel add constraint lead_funnel_dia_de_pago_check check (dia_de_pago is null or dia_de_pago between 1 and 28);
  end if;
end $$;

comment on column lead_funnel.monto_cierre_usd is 'El trato de ESTE CRM (mig 0324): lo vendido acá. El de la casa sigue en leads.monto_cierre_usd.';
comment on column lead_funnel.total_cuotas is 'El plan uniforme de ESTE CRM (mig 0324), como leads.total_cuotas para la casa. Sus filas son los pagos con este funnel_id.';

-- 2 · Las cuotas se numeran por CRM. Primero el índice nuevo (lo de hoy lo cumple: es más laxo), después se va el viejo.
create unique index if not exists idx_pagos_lead_crm_numero on pagos (lead_id, coalesce(funnel_id, 0), numero);
drop index if exists idx_pagos_lead_numero;

-- 3 · Sin CRM dicho: la diferencia de un cobro, el de su cuota; lo demás, la casa (NULL = el funnel del negocio).
create or replace function pagos_funnel_del_momento() returns trigger
language plpgsql
as $$
begin
  if new.funnel_id is null and new.resto_de is not null then
    select p.funnel_id into new.funnel_id from pagos p where p.id = new.resto_de;
  end if;
  if new.funnel_id is null and new.lead_id is not null then
    select coalesce(
      l.funnel_id,
      (select f.id from funnels f where f.workspace_id = l.workspace_id and f.es_default limit 1)
    )
    into new.funnel_id
    from leads l where l.id = new.lead_id;
  end if;
  return new;
end;
$$;
-- `create or replace` conserva lo que cerró la 0319; se repite para que quede dicho (es la función de un trigger: sin grant).
revoke execute on function public.pagos_funnel_del_momento() from public, anon, authenticated;

commit;
