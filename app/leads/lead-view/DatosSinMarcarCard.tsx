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

export function DatosSinMarcarCard({ faltantes, onSolucionar, label = 'Solucionar', nota, ignorado = false, onReactivar }: {
  faltantes: Step[];
  onSolucionar: () => void;
  label?: string;
  /** Texto de ayuda opcional debajo del título. */
  nota?: string;
  /** El lead tiene los avisos ignorados en el worklist del CRM general (mig 0109). */
  ignorado?: boolean;
  /** Reactivar los avisos (vuelve al worklist). Requerido si ignorado. */
  onReactivar?: () => void;
}) {
  if (!faltantes.length) return null;
  // Ignorado: mismo bloque pero en tono "recordatorio suave" (ámbar, sin parpadeo).
  const tone = ignorado
    ? { bg: 'var(--warn-bg)', border: 'var(--warn)', accent: 'var(--warn)', chipBorder: '#E7D6A6' }
    : { bg: 'var(--bad-bg)', border: 'var(--bad)', accent: 'var(--bad)', chipBorder: '#EBBFBC' };
  return (
    <section style={{ ...card, background: tone.bg, borderColor: tone.border }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: tone.accent, animation: ignorado ? undefined : 'blinkRed 1.4s infinite', flex: 'none' }} />
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: tone.accent, fontWeight: 700 }}>
          Datos sin marcar · {faltantes.length}{ignorado ? ' · ignorado' : ''}
        </span>
      </div>
      {ignorado
        ? <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.45 }}>Estos avisos están <b>ignorados</b> en el CRM general (no notifican ni cuentan). Seguís pudiendo completarlos acá, o reactivarlos para que vuelvan al worklist.</p>
        : nota && <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.45 }}>{nota}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {faltantes.map((f) => (
          <span key={f.id} style={{ fontSize: 12.5, fontWeight: 600, color: tone.accent, background: 'var(--surface)', border: `1px solid ${tone.chipBorder}`, borderRadius: 999, padding: '4px 11px' }}>{f.label}</span>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button
          type="button"
          onClick={onSolucionar}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, border: 'none', background: tone.accent, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS, boxShadow: ignorado ? 'none' : '0 2px 8px rgba(207,78,41,.28)' }}
        >
          <span aria-hidden style={{ fontSize: 15 }}>🛠️</span> {label}
        </button>
        {ignorado && onReactivar && (
          <button
            type="button"
            onClick={onReactivar}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}
          >
            🔔 Reactivar avisos
          </button>
        )}
      </div>
    </section>
  );
}
