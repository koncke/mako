// =============================================================================
// EnElCodigo — lo que MaKo APLICA hoy, leído del código y no del documento
// =============================================================================
// El documento (docs/offer-marco.md) dice el porqué; esto dice lo que corre: las
// piezas que el chat pregunta y las dimensiones con que diagnostica salen de
// lib/offer-marco.ts, el mismo módulo que usan el chat, el PDF y el motor. Si el
// documento y el código se separan, acá se ve el código — que es lo que recibe
// el cliente.
//
// Sin 'use client': se dibuja en el servidor.
// =============================================================================

import { Tag } from '@/app/_ui';
import { PIEZAS, DIMENSIONES, DIMENSIONES_CRITICAS } from '@/lib/offer-marco';

const fila: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) minmax(0, 1fr)', gap: 14,
  alignItems: 'baseline', padding: '9px 0', borderTop: '1px solid var(--border)',
};

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)', margin: '0 0 8px' }}>{titulo}</h3>
      {children}
    </section>
  );
}

export function EnElCodigo() {
  const minimas = PIEZAS.filter((p) => p.minimo).length;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 28,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px',
      marginBottom: 'var(--sect-gap)',
    }}>
      <Bloque titulo={`Las ${PIEZAS.length} piezas · ${minimas} mínimas para analizar`}>
        {PIEZAS.map((p) => (
          <div key={p.key} style={fila}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontWeight: 600, color: 'var(--ink)' }}>
              {p.label}{p.minimo && <Tag color="var(--primary)">Mínima</Tag>}
            </span>
            <span style={{ color: 'var(--dim)', fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>{p.que}</span>
          </div>
        ))}
      </Bloque>
      <Bloque titulo={`Las ${DIMENSIONES.length} dimensiones · ${DIMENSIONES_CRITICAS.length} críticas`}>
        {DIMENSIONES.map((d) => (
          <div key={d.id} style={fila}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontWeight: 600, color: 'var(--ink)' }}>
              {d.id} · {d.label}{DIMENSIONES_CRITICAS.includes(d.id) && <Tag color="var(--bad)">Crítica</Tag>}
            </span>
            <span style={{ color: 'var(--dim)', fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>{d.mide}</span>
          </div>
        ))}
      </Bloque>
    </div>
  );
}
