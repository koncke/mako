'use client';

// =============================================================================
// ChatItemMenu — menú "⋮" (3 puntitos) de un chat + confirmación
// =============================================================================
// Reemplaza los botones sueltos: un solo botón de 3 puntitos abre el desplegable
// con Cambiar nombre / Pinear / Archivar / Eliminar. Archivar y Eliminar piden
// confirmación en un pop-up. Reutilizable (lista de la tab y dropdown del chat).

import { useState } from 'react';

const SANS = "'Geist', sans-serif";

export function ConfirmDialog({
  titulo, detalle, confirmLabel = 'Confirmar', danger = false, onCancel, onConfirm,
}: {
  titulo: string; detalle?: string; confirmLabel?: string; danger?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(18,21,27,.32)', padding: '20px 22px' }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{titulo}</div>
        {detalle && <div style={{ fontSize: 13.5, color: 'var(--dim)', marginTop: 6, lineHeight: 1.5 }}>{detalle}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}>Cancelar</button>
          <button type="button" onClick={onConfirm} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: danger ? 'var(--bad)' : 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function ChatItemMenu({
  pinned, dark = false, onRename, onPin, onArchive, onDelete,
}: {
  pinned?: boolean; dark?: boolean; onRename: () => void; onPin: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState<null | 'archive' | 'delete'>(null);

  const item = (danger = false) => ({
    display: 'block', width: '100%', textAlign: 'left' as const, padding: '8px 12px',
    background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13,
    color: danger ? 'var(--bad)' : 'var(--ink)',
  });

  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        title="Opciones"
        aria-label="Opciones del chat"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{ width: 28, height: 28, borderRadius: 7, border: dark ? '1px solid transparent' : '1px solid var(--border)', background: dark ? 'transparent' : 'var(--surface)', color: dark ? 'var(--sidebar-text)' : 'var(--dim)', cursor: 'pointer', fontSize: 17, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >⋮</button>

      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 80 }} aria-hidden />
          <div style={{ position: 'absolute', top: 32, right: 0, zIndex: 81, width: 172, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: '0 16px 40px rgba(18,21,27,.22)', overflow: 'hidden', padding: '4px 0' }}>
            <button type="button" style={item()} onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(); }}>Cambiar nombre</button>
            <button type="button" style={item()} onClick={(e) => { e.stopPropagation(); setOpen(false); onPin(); }}>{pinned ? 'Despinear' : 'Pinear'}</button>
            <button type="button" style={item()} onClick={(e) => { e.stopPropagation(); setOpen(false); setAsk('archive'); }}>Archivar</button>
            <button type="button" style={item(true)} onClick={(e) => { e.stopPropagation(); setOpen(false); setAsk('delete'); }}>Eliminar</button>
          </div>
        </>
      )}

      {ask === 'archive' && (
        <ConfirmDialog
          titulo="¿Archivar este chat?"
          detalle="Se oculta de la lista, pero no se borra."
          confirmLabel="Archivar"
          onCancel={() => setAsk(null)}
          onConfirm={() => { setAsk(null); onArchive(); }}
        />
      )}
      {ask === 'delete' && (
        <ConfirmDialog
          titulo="¿Eliminar este chat?"
          detalle="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={() => { setAsk(null); onDelete(); }}
        />
      )}
    </div>
  );
}
