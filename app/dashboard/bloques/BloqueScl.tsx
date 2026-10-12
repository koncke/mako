'use client';

// =============================================================================
// BloqueScl — el ciclo de venta: la línea de tiempo de los tramos, el más lento en rojo
// =============================================================================
// El de la tab vieja (SCLTimeline de app/comercial/page.tsx, hasta 7527b8c2): Formulario → Agenda R1 →
// Reunión 1 → Reunión 2 → Confirmó → Primer pago, con los días promedio y la muestra de cada tramo, y
// la caja «SCL promedio · agenda → pago · P90 · ver leads →», que abre los leads con su ciclo completo.
//
// ⚠️ Es TODO EL HISTÓRICO, como en la vieja: getSCL / getTramosSCL no reciben período. La caja lo dice
//    («histórico») para que debajo de un control de «Últimos 30 días» no se lea como de ese período.
// ⚠️ getSCL devuelve null con menos de 3 casos («no es honesto mostrar un promedio con muy pocos
//    datos»): la caja muestra «—».

import type { DesgloseData } from '@/app/_components/Desglose';
import { nodosDeTramos, type DatosScl } from './datos-comercial';
import { Abrible, MONO, fecha } from './piezas';

const NODO_LINDO: Record<string, string> = { Formulario: 'Formulario', Agenda: 'Agenda R1' };

export function BloqueScl({ d }: { d: DatosScl }) {
  const tramos = d.tramos.tramos;
  const lento = d.tramos.tramo_mas_lento;
  const nodos = nodosDeTramos(d.tramos);
  const prom = d.scl.avg_dias != null ? `${d.scl.avg_dias.toFixed(1)} días` : '—';
  const p90 = d.scl.p90_dias != null ? `${d.scl.p90_dias}d` : '—';

  const desglose: DesgloseData | null = d.leads.length ? {
    label: 'Ciclo de venta · agenda → pago',
    value: `${d.leads.length} leads`,
    color: 'var(--ink)',
    items: d.leads.map((l) => ({
      nombre: l.nombre,
      valor: `${l.dias} d`,
      detalle: `agenda ${fecha(l.agenda)} → R2 ${fecha(l.j2)} → conf. ${fecha(l.confirmacion)} → pago ${fecha(l.pago)}`,
      leadId: l.leadId,
      focus: 'plan-pagos',
    })),
  } : null;

  // La geometría de la vieja; el SVG escala al ancho de la tarjeta y scrollea si no entra.
  const segW = 220;
  const padX = 100;
  const baseY = 104;
  const W = padX * 2 + Math.max(nodos.length - 1, 1) * segW;
  const H = 200;
  const x = (i: number) => padX + i * segW;

  const caja = (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '11px 18px', textAlign: 'right', background: 'var(--surface)' }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' }}>SCL promedio</div>
      <div style={{ fontWeight: 600, fontSize: 25, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{prom}</div>
      <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>
        agenda → pago · histórico · P90: {p90}{desglose ? <span className="bq-link"> · ver leads →</span> : null}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ flex: 'none', display: 'flex', justifyContent: 'flex-end' }}>
        {desglose ? <Abrible data={desglose} style={{ width: 'auto', display: 'inline-block' }}>{caja}</Abrible> : caja}
      </div>

      {nodos.length === 0 ? (
        <div className="bq-msg">Sin datos de ciclo todavía</div>
      ) : (
        <div style={{ flex: 'none', overflowX: 'auto', padding: '6px 0 4px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 760, height: 'auto', display: 'block', overflow: 'visible', fontFamily: 'var(--dash-letra, Geist, sans-serif)' }}
            role="img" aria-label="Línea de tiempo del ciclo de venta">
            <line x1={x(0)} y1={baseY} x2={x(nodos.length - 1)} y2={baseY} stroke="var(--border-strong)" strokeWidth={2} />
            {tramos.map((t, i) => {
              const x1 = x(i);
              const x2 = x(i + 1);
              const medio = (x1 + x2) / 2;
              const hay = t.dias_promedio != null;
              const esLento = hay && lento === t.label;
              return (
                <g key={`tramo-${t.label}`}>
                  {esLento && <line x1={x1} y1={baseY} x2={x2} y2={baseY} stroke="var(--bad)" strokeWidth={4} strokeLinecap="round" />}
                  <text x={medio} y={86} textAnchor="middle" fontSize={16} fontWeight={esLento ? 700 : 600}
                    fill={hay ? (esLento ? 'var(--bad)' : 'var(--ink)') : 'var(--faint)'} style={{ fontFamily: MONO }}>
                    {hay ? `+${t.dias_promedio!.toFixed(1)} d` : 's/d'}
                  </text>
                  <text x={medio} y={130} textAnchor="middle" fontSize={12} fill="var(--faint)" style={{ fontFamily: MONO }}>
                    n={t.n}{esLento ? ' · lento' : ''}
                  </text>
                </g>
              );
            })}
            {nodos.map((crudo, i) => {
              const cx = x(i);
              const arriba = i % 2 === 0;
              const entra = i === 0 ? null : tramos[i - 1];
              const activo = i === 0 || (entra?.dias_promedio ?? null) != null;
              const relleno = i === 0 ? 'var(--accent-soft)' : activo ? 'var(--good)' : 'var(--border-strong)';
              return (
                <g key={`nodo-${i}`}>
                  <line x1={cx} y1={arriba ? 96 : 112} x2={cx} y2={arriba ? 74 : 140} stroke="var(--border-strong)" strokeWidth={1} />
                  <circle cx={cx} cy={baseY} r={8} fill={relleno} stroke="var(--surface)" strokeWidth={3} />
                  <text x={cx} y={arriba ? 62 : 162} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--ink)">{NODO_LINDO[crudo] ?? crudo}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </>
  );
}
