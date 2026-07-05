'use client';

// =============================================================================
// DatosSinMarcarCard — el aviso rojo unificado de "Datos sin marcar"
// =============================================================================
// Mismo bloque en la ficha (todas las tabs) y en el modal. El botón "Solucionar"
// vive DENTRO del cuadro, es cuadrado y con emoji para que se vea clickeable.

import type { CSSProperties } from 'react';
import type { Step } from '@/lib/stage-requirements';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const card: CSSProperties = { background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 16, padding: '18px 20px' };

export function DatosSinMarcarCard({ faltantes, onSolucionar, label = 'Solucionar', nota }: {
  faltantes: Step[];
  onSolucionar: () => void;
  label?: string;
  /** Texto de ayuda opcional debajo del título. */
  nota?: string;
}) {
  if (!faltantes.length) return null;
  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--bad)', animation: 'blinkRed 1.4s infinite', flex: 'none' }} />
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--bad)', fontWeight: 700 }}>
          Datos sin marcar · {faltantes.length}
        </span>
      </div>
      {nota && <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.45 }}>{nota}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {faltantes.map((f) => (
          <span key={f.id} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--bad)', background: 'var(--surface)', border: '1px solid #EBBFBC', borderRadius: 999, padding: '4px 11px' }}>{f.label}</span>
        ))}
      </div>
      <button
        type="button"
        onClick={onSolucionar}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, border: 'none', background: 'var(--bad)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, boxShadow: '0 2px 8px rgba(207,78,41,.28)' }}
      >
        <span aria-hidden style={{ fontSize: 15 }}>🛠️</span> {label}
      </button>
    </section>
  );
}
