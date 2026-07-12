'use client';

// =============================================================================
// ConfirmModal — pop-up de confirmación propio (reemplaza window.confirm())
// =============================================================================
// Cartel centrado, tema claro de la app, con Cancelar + acción. Nunca usamos el
// confirm() nativo del navegador (el que salta arriba de la ventana). Lo comparten
// PlanBoard (super-admin) y TodoBoard (cliente). Cierra con Escape o click afuera.

import { useEffect } from 'react';

const SANS = "'Geist', sans-serif";

export function ConfirmModal({ msg, confirmLabel = 'Eliminar', danger = true, onOk, onCancel }: { msg: string; confirmLabel?: string; danger?: boolean; onOk: () => void; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') onOk(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOk, onCancel]);
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(18,21,27,.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 24px 60px rgba(18,21,27,.28)', padding: '22px 24px' }}>
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 20 }}>{msg}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{ padding: '8px 15px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS }}>Cancelar</button>
          <button type="button" onClick={onOk} autoFocus style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: danger ? 'var(--bad)' : 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
