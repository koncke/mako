'use client';

// DatosModal — modal batch de "datos sin marcar" de las tareas (feedback jul-19).
// Reemplaza al gauntlet card-by-card: el deadline se pone inline, y cada tarea se puede
// ignorar ("no pedir"). Se abre SOLO desde el ⚠ del header, y cerrarlo es «más tarde»:
// sin segundo pop-up (08-T46 — «me da miedo picarle a Maco»).
//
// ⚠️ ACÁ TAMBIÉN VIVÍA LA CHECKLIST, y se fue el 22/09/2026 con todas las demás («que no
// existan checklists, quitan mucho tiempo, son incómodas e imprácticas»). Lo que queda es
// el único dato que el Perro necesita y no puede adivinar: CUÁNDO vence.

import { type CSSProperties } from 'react';
import { type BoardTask } from './types';

const SANS = "'Geist', -apple-system, sans-serif";
const MONO = "'Geist Mono', monospace";

export type FaltanteItem = { task: BoardTask; needDl: boolean };

export function DatosModal({ items, onSetDeadline, onAbrir, onIgnorarDl, onClose }: {
  items: FaltanteItem[];
  onSetDeadline: (id: string, fecha: string) => void;
  onAbrir: (id: string) => void;
  onIgnorarDl: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 660, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>◷</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Tareas sin fecha</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 1, lineHeight: 1.4 }}>La fecha le dice al Perro qué urge, y es lo único que no puede deducir solo. Nada es obligatorio: cerrar es «más tarde».</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* lista */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 22px' }}>
          {items.length === 0 ? (
            <div style={{ padding: '44px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 14 }}>No falta ninguna fecha. 🎉</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {items.map(({ task: t }) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 17, flex: 'none' }}>{t.emoji || '•'}</span>
                  <button type="button" onClick={() => onAbrir(t.id)} title="Abrir la tarea"
                    style={{ flex: '1 1 180px', minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: SANS }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>#{t.num}</span>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title || 'Sin título'}</span>
                  </button>

                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                    <input type="date" onChange={(e) => { if (e.target.value) onSetDeadline(t.id, e.target.value); }} title="Poner deadline"
                      style={fechaStyle} />
                    <button type="button" onClick={() => onIgnorarDl(t.id)} title="No pedir el deadline de esta tarea" aria-label="Ignorar deadline"
                      style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>El deadline es opcional. Nada de esto bloquea el plan.</span>
        </div>
      </div>
    </div>
  );
}

const fechaStyle: CSSProperties = { padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, outline: 'none', fontFamily: SANS };
