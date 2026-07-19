'use client';

// SinDeadlineModal — modal batch para poner deadline a las tareas que no lo tienen.
// Reemplaza al gauntlet card-by-card (feedback jul-19): el deadline dejó de ser
// obligatorio, así que en vez de frenarte tarea por tarea te muestra TODAS juntas y
// vos ponés las que quieras. "No volver a pedir" por tarea o por todas. Al cerrar
// apretando afuera, confirma si querés que no vuelva a aparecer.

import { useState } from 'react';
import { ConfirmModal } from '@/app/_components/ConfirmModal';
import { type BoardTask } from './types';

const SANS = "'Geist', -apple-system, sans-serif";
const MONO = "'Geist Mono', monospace";

export function SinDeadlineModal({ tareas, onSet, onAbrir, onDescartarUna, onDescartarTodas, onClose }: {
  tareas: BoardTask[];                       // abiertas, sin deadline, no descartadas — ordenadas por score
  onSet: (id: string, fecha: string) => void;
  onAbrir: (id: string) => void;             // abrir el detalle de la tarea
  onDescartarUna: (id: string) => void;      // "no volver a pedir" por esta tarea
  onDescartarTodas: () => void;              // "no volver a pedir por ninguna"
  onClose: () => void;
}) {
  const [confirmarSalir, setConfirmarSalir] = useState(false); // cierre por afuera → ¿no volver a mostrar?

  return (
    <>
      <div onClick={() => setConfirmarSalir(true)}
        style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
        <div onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>◷</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Tareas sin deadline</div>
              <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 1, lineHeight: 1.4 }}>El deadline es opcional. Poné fecha a las que quieras; lo que dejes sin fecha queda igual, sin bloquear nada.</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar"
              style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>

          {/* lista */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 22px' }}>
            {tareas.length === 0 ? (
              <div style={{ padding: '44px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 14 }}>Ninguna tarea abierta sin deadline. 🎉</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {tareas.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    <span style={{ fontSize: 17, flex: 'none' }}>{t.emoji || '•'}</span>
                    <button type="button" onClick={() => onAbrir(t.id)} title="Abrir la tarea"
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: SANS }}>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>#{t.num}</span>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title || 'Sin título'}</span>
                    </button>
                    <input type="date" onChange={(e) => { if (e.target.value) onSet(t.id, e.target.value); }} title="Poner deadline"
                      style={{ flex: 'none', padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, outline: 'none', fontFamily: SANS }} />
                    <button type="button" onClick={() => onDescartarUna(t.id)} title="No volver a pedir el deadline de esta tarea"
                      style={{ flex: 'none', border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 11.5, whiteSpace: 'nowrap' }}>no pedir</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={() => { onDescartarTodas(); onClose(); }}
              style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>No volver a pedir por ninguna</button>
            <button type="button" onClick={onClose}
              style={{ padding: '10px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>Listo</button>
          </div>
        </div>
      </div>

      {confirmarSalir && (
        <ConfirmModal
          msg="¿Que no te vuelva a preguntar por los deadlines pendientes? Podés reabrirlo desde el botón “◷ sin deadline”."
          confirmLabel="No volver a mostrar" danger={false}
          onOk={() => { onDescartarTodas(); onClose(); }}
          onCancel={() => { setConfirmarSalir(false); onClose(); }}
        />
      )}
    </>
  );
}
