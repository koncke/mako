'use client';

// =============================================================================
// BloqueRevenue — la barra cobrado / pendiente, Sold · Cash · Outstanding y el MRR
// =============================================================================
// El de la tab vieja (RevenueSection + RevenueKpis de app/comercial, hasta 7527b8c2). Las tres KPI se
// aprietan y abren su desglose lead por lead (con «✎ Editar lead», que salta al plan de pagos). El
// Outstanding es el MISMO número que suma «A quién cobrarle»: sale de la misma lectura y de la misma
// ventana (lib/graficos-bloques.ts).

import type { EstiloEfectivo } from '@/lib/graficos-temas';
import { partesBarra, textoVentana, type DatosRevenue } from './datos-comercial';
import { Abrible, Kpi, MONO, itemsDePlata, plural, usd } from './piezas';

export function BloqueRevenue({ d, estilo }: { d: DatosRevenue; estilo: EstiloEfectivo }) {
  const c = estilo.compacto;
  const barra = partesBarra(d.cash, d.outstanding);
  // El color de lo vendido es el acento del tema (el mismo que la KPI genérica de «vendido», tonoDe).
  const acento = estilo.colores[1] ?? estilo.colores[0] ?? 'var(--accent)';

  const kpis = [
    {
      clave: 'sold', rotulo: 'Sold Revenue', valor: usd(d.sold, c), color: acento,
      sub: `${plural(d.cierres, 'cierre', 'cierres')} en el período`,
      items: itemsDePlata(d.soldItems, 'cierre'),
    },
    {
      clave: 'cash', rotulo: 'Cash Collected', valor: usd(d.cash, c), color: 'var(--good)',
      sub: `incluye cuotas previas · ${plural(d.primerosPagos, 'primer pago', 'primeros pagos')}`,
      items: itemsDePlata(d.cashItems, 'pago'),
    },
    {
      clave: 'out', rotulo: 'Outstanding', valor: usd(d.outstanding, c), color: 'var(--bad)',
      sub: d.ventana.desde ? `cuotas que vencen · ${textoVentana(d.ventana)}` : 'cuotas por cobrar · todo el pipeline',
      items: itemsDePlata(d.outItems, 'vence'),
    },
  ];

  return (
    <>
      {/* La barra: lo cobrado sobre lo cobrado más lo que falta. */}
      <div style={{ flex: 'none' }}>
        <div style={{ display: 'flex', width: '100%', height: 42, borderRadius: 11, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface-2)' }}
          role="img" aria-label={barra ? `Cobrado ${barra.cash}%, pendiente ${barra.out}%` : 'Sin cobros ni cuotas pendientes'}>
          {barra && (
            <>
              <div style={{ width: `${barra.cash}%`, background: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-ink)', fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>
                {barra.cash > 6 ? `${barra.cash}%` : ''}
              </div>
              <div style={{ width: `${barra.out}%`, background: 'var(--bad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-ink)', fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>
                {barra.out > 6 ? `${barra.out}%` : ''}
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 13, color: 'var(--dim)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--good)' }} />Cash Collected
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--bad)' }} />Outstanding
          </span>
        </div>
      </div>

      {/* Las tres KPI, cada una con su desglose. */}
      <div className="bq-kpis" style={{ flex: 'none' }}>
        {kpis.map((k) => (
          <Abrible key={k.clave} data={{ label: k.rotulo, value: k.valor, color: k.color, items: k.items }}>
            <Kpi rotulo={k.rotulo} valor={k.valor} color={k.color} sub={k.sub} estilo={estilo} ver="ver detalle →" />
          </Abrible>
        ))}
      </div>

      {/* El MRR va aparte del high-ticket, y sólo si hay alguna suscripción activa. */}
      {d.mrr.activas > 0 && (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 16px' }}>
          <span style={{ fontSize: 22 }} aria-hidden>🔁</span>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>MRR · ingreso mensual recurrente</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {usd(d.mrr.mrr, c)}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}> /mes</span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--dim)' }}>{plural(d.mrr.activas, 'suscripción activa', 'suscripciones activas')}</div>
        </div>
      )}
    </>
  );
}
