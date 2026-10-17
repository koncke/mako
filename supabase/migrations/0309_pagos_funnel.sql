-- =============================================================================
-- 0309 — Cada PAGO guarda de qué funnel es (#897)
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: da igual, antes o después del deploy. Agrega y no saca nada, y es idempotente. El código
-- nuevo lee la columna si está y, si no, cuenta con la regla de siempre (lib/funnels-elegidos.ts, `faltaColumnaFunnel`);
-- el código viejo no la lee, y el trigger sólo llena una columna que nadie más escribe.
--
-- Por qué (lib/funnels-elegidos.ts lo cuenta entero): un OKR o un KPI de UNOS funnels (mig 0306) reparte cada pago en
-- el funnel donde estaba su lead EL DÍA DEL PAGO. Con eso, una cuota de la venta del VSL que se cobra DESPUÉS de
-- agregar al lead a «Renovación» contaba en Renovación. Ahora el pago guarda el funnel de cuando SE CREÓ (la venta, el
-- plan, la renovación), con la MISMA regla: el último funnel al que se agregó al lead (`lead_funnel`) ese día o antes;
-- si ninguno, su casa (`leads.funnel_id`); y la casa NULL es el funnel del negocio (`funnels.es_default`).
--
-- EL TRIGGER y no cada escritura: los pagos nacen en muchos lados (la ficha, la API de MaKo, los webhooks de Stripe y
-- Mercado Pago, el plan de cuotas). Uno solo, `before insert`, y sólo si quien inserta no lo puso.
--
-- EL BACKFILL usa el día en que se CREÓ cada pago. Medido el 17/10/2026, sólo lectura: con la regla de hoy (el día del
-- pago) y con esta, los pagos cobrados caen en el MISMO funnel en todos los workspaces (ws1: 33, todos en «Negocio que
-- ESCALA»; ws11: 6 y 1). No mueve ningún número de hoy.

alter table pagos add column if not exists funnel_id bigint references funnels(id) on delete set null;

comment on column pagos.funnel_id is 'El funnel de este pago, fijado al crearlo: el último funnel al que se agregó al lead (lead_funnel) ese día o antes; si ninguno, su casa; la casa NULL es el funnel del negocio. Lo llena el trigger pagos_funnel (mig 0309). NULL = no se supo (pago sin lead).';

create index if not exists pagos_funnel_idx on pagos (workspace_id, funnel_id);

create or replace function pagos_funnel_del_momento() returns trigger
language plpgsql
as $$
begin
  if new.funnel_id is null and new.lead_id is not null then
    select coalesce(
      (select lf.funnel_id from lead_funnel lf
        where lf.lead_id = new.lead_id and lf.created_at::date <= coalesce(new.created_at, now())::date
        order by lf.created_at desc, lf.id desc limit 1),
      l.funnel_id,
      (select f.id from funnels f where f.workspace_id = l.workspace_id and f.es_default limit 1)
    )
    into new.funnel_id
    from leads l where l.id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists pagos_funnel on pagos;
create trigger pagos_funnel before insert on pagos for each row execute function pagos_funnel_del_momento();

-- Los que ya existen, con la misma regla y el día en que se crearon. Sólo los que no tienen: idempotente.
update pagos p
set funnel_id = coalesce(
  (select lf.funnel_id from lead_funnel lf
    where lf.lead_id = p.lead_id and lf.created_at::date <= p.created_at::date
    order by lf.created_at desc, lf.id desc limit 1),
  l.funnel_id,
  (select f.id from funnels f where f.workspace_id = l.workspace_id and f.es_default limit 1)
)
from leads l
where l.id = p.lead_id and p.funnel_id is null;
