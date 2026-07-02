'use client';

// =============================================================================
// ConfirmDialog — diálogo de confirmación reutilizable (acciones irreversibles)
// =============================================================================
// Overlay con blur, panel centrado y dos botones. Usado para borrados y otras
// acciones destructivas desde cualquier superficie (CRM, WhatsApp, desgloses).

import type { CSSProperties, ReactNode } from 'react';

const SANS = "'Geist', sans-serif";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
  zIndex = 120,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  zIndex?: number;
}) {
  const confirmBg = tone === 'danger' ? 'var(--bad)' : 'var(--primary)';
  const btnBase: CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS };
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', padding: '22px 24px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{ ...btnBase, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)' }}>{cancelLabel}</button>
          <button onClick={onConfirm} style={{ ...btnBase, border: 'none', background: confirmBg, color: '#fff', fontWeight: 700 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
