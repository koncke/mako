'use client';

// =============================================================================
// WizardShell — chrome del asistente MaKo (una pregunta por paso), reutilizable
// =============================================================================
// Mismo look que StageMoveDialog: header con ✦ MAKO + dots de progreso, cuerpo
// centrado (una pregunta por paso) y footer Atrás/Siguiente/Confirmar. Lo usan
// los formularios de >1 pregunta del Kanban (Nutrición manual, Registrar R1/R2)
// para que TODOS se vean igual.

import type { CSSProperties, ReactNode } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Input estándar de los pasos del wizard (centrado). */
export const wizardInput: CSSProperties = { width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', textAlign: 'center' };

export function WizardShell({
  titulo, total, idx, pregunta, sub, children, error,
  puedeAvanzar, enUltimo, confirmLabel, pending = false,
  atrasLabel, onAtras, onSiguiente, onConfirmar, onClose, bloqueante = false,
}: {
  titulo: string;            // línea mono arriba (ej. "Nutrición manual · Juan")
  total: number; idx: number;
  pregunta: string; sub?: string;
  children: ReactNode;       // cuerpo del paso (input/textarea/botones)
  error?: string | null;
  puedeAvanzar: boolean;     // habilita Siguiente/Confirmar
  enUltimo: boolean;         // último paso → botón Confirmar
  confirmLabel: string;
  pending?: boolean;
  atrasLabel: string;        // "Cancelar" (primer paso) o "Atrás"
  onAtras: () => void; onSiguiente: () => void; onConfirmar: () => void; onClose: () => void;
  bloqueante?: boolean;      // true → no se puede cerrar (sin ✕, backdrop no cierra)
}) {
  return (
    <div onClick={bloqueante ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* Header: logo · dots · cerrar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px' }}>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 999, background: i === idx ? 'var(--primary)' : i < idx ? 'var(--primary-weak, #B9CDF8)' : 'var(--border)', transition: 'width .2s' }} />
            ))}
          </div>
          {bloqueante
            ? <span style={{ width: 32 }} />
            : <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14, fontFamily: SANS }}>✕</button>}
        </div>

        {/* Cuerpo: una pregunta por paso */}
        <div style={{ padding: '26px clamp(20px,6vw,56px) 30px', textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', fontFamily: MONO, marginBottom: 8 }}>{titulo}</div>
          <h3 style={{ fontSize: 'clamp(20px,4vw,26px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 6px', fontFamily: SANS }}>{pregunta}</h3>
          {sub ? <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px' }}>{sub}</p> : <div style={{ height: 12 }} />}
          <div style={{ maxWidth: 480, margin: '0 auto' }}>{children}</div>
          {error && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button onClick={onAtras} style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>← {atrasLabel}</button>
          {enUltimo ? (
            <button onClick={onConfirmar} disabled={pending || !puedeAvanzar} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: puedeAvanzar ? 'var(--primary)' : 'var(--border)', color: puedeAvanzar ? '#fff' : 'var(--faint)', fontSize: 14.5, fontWeight: 700, cursor: puedeAvanzar && !pending ? 'pointer' : 'default', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : confirmLabel}</button>
          ) : (
            <button onClick={onSiguiente} disabled={!puedeAvanzar} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: puedeAvanzar ? 'var(--primary)' : 'var(--border)', color: puedeAvanzar ? '#fff' : 'var(--faint)', fontSize: 14.5, fontWeight: 700, cursor: puedeAvanzar ? 'pointer' : 'default', fontFamily: SANS }}>Siguiente →</button>
          )}
        </div>
      </div>
    </div>
  );
}
