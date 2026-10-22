-- =============================================================================
-- 0325 — Lo cobrado de la venta de la CASA, aparte de lo cobrado en todos los CRMs
-- =============================================================================
-- ⚠️ ORDEN DE DESPLIEGUE: se aplica ANTES del deploy que la lee (el filtro «Solo los que deben» y el export la piden por
-- nombre). El código la tolera ausente (vuelve a `total_cobrado_usd`), pero sin ella el saldo de un cliente con una
-- renovación cobrada sale de menos. Agrega, no borra, y es idempotente.
--
-- Por qué (segunda revisión de los pagos por CRM, 22/10/2026, mig 0324): «lo que el lead debe» se calculaba con la venta de
-- la CASA (`monto_cierre_usd`) menos lo cobrado en TODOS sus CRMs (`total_cobrado_usd`, que cuenta también las
-- renovaciones porque es la caja de esa persona: el rendimiento de un anuncio la lee). Una venta de US$2.000 con 1.000
-- pagados y 500 cobrados en una renovación decía «te falta pagar US$500» en un mensaje al cliente, en vez de 1.000. Ahora la
-- fila guarda las dos: lo cobrado de la venta de la casa va con su venta, y lo cobrado en total, con la caja.
--
-- EL BACKFILL: lo pagado que es de la casa con la regla de `esDelTrato` (lib/pagos-crm.ts): todo pago que NO es de un CRM
-- agregado del lead (su `lead_funnel`, sin la fila que repita la casa). Medido el 22/10/2026 (sólo lectura): un solo pago
-- en un CRM agregado en toda la base (ws11, lead 2632, US$40); en todos los demás leads da lo mismo que `total_cobrado_usd`.

begin;

alter table leads add column if not exists total_cobrado_casa_usd numeric(12, 2);

comment on column leads.total_cobrado_casa_usd is 'Lo cobrado de la venta de la CASA (mig 0325): sin lo de los CRMs agregados (una renovación). Se compara con monto_cierre_usd para el saldo. total_cobrado_usd es lo cobrado en todos los CRMs. Lo escribe sincronizarTotalCobrado (lib/pagos.ts).';

update leads l
set total_cobrado_casa_usd = sub.casa
from (
  select p.lead_id,
    sum(p.monto_usd) filter (
      where p.pagado and not exists (
        select 1 from lead_funnel lf
        where lf.lead_id = p.lead_id and lf.funnel_id = p.funnel_id
          and lf.funnel_id <> coalesce(l2.funnel_id, (select f.id from funnels f where f.workspace_id = l2.workspace_id and f.es_default limit 1))
      )
    ) as casa
  from pagos p
  join leads l2 on l2.id = p.lead_id
  group by p.lead_id
) sub
where sub.lead_id = l.id and l.total_cobrado_casa_usd is null;

commit;
