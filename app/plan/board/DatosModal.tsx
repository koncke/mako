'use client';

// DatosModal — modal batch de "datos sin marcar" de las tareas (feedback jul-19).
// Reemplaza al gauntlet card-by-card y unifica DEADLINE + CHECKLIST en UN solo lugar:
//   · deadline: lo ponés inline (opcional).
//   · checklist: la ARMA MaKo (no te pregunta los pasos); solo si falla, la hacés a mano.
// Cada dato se puede ignorar ("no pedir"). Al CERRARSE (si se abrió solo), el padre
// dispara un 2do pop-up (DatosConfirm) que decide si seguir recordándolo — este modal
// no lo maneja, para que nunca se vean los dos apilados.

import { useState, type CSSProperties } from 'react';
import { MakoStar } from '@/app/_components/MakoBrand';
import { type BoardTask } from './types';

const SANS = "'Geist', -apple-system, sans-serif";
const MONO = "'Geist Mono', monospace";

export type FaltanteItem = { task: BoardTask; needDl: boolean; needCl: boolean };
type GenState = 'idle' | 'loading' | 'done' | 'error';

export function DatosModal({ items, onSetDeadline, onGenChecklist, onAbrir, onIgnorarDl, onIgnorarCl, onClose }: {
  items: FaltanteItem[];
  onSetDeadline: (id: string, fecha: string) => void;
  onGenChecklist: (id: string) => Promise<boolean>; // MaKo arma la checklist; true si pudo
  onAbrir: (id: string) => void;
  onIgnorarDl: (id: string) => void;
  onIgnorarCl: (id: string) => void;
  onClose: () => void;
}) {
  const [gen, setGen] = useState<Record<string, GenState>>({});
  const [batch, setBatch] = useState(false);

  const genUna = async (id: string) => {
    setGen((g) => ({ ...g, [id]: 'loading' }));
    const ok = await onGenChecklist(id);
    setGen((g) => ({ ...g, [id]: ok ? 'done' : 'error' }));
    return ok;
  };
  const genTodas = async () => {
    setBatch(true);
    for (const it of items.filter((x) => x.needCl)) { if (gen[it.task.id] !== 'loading') await genUna(it.task.id); }
    setBatch(false);
  };
  const faltanCl = items.filter((x) => x.needCl).length;

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 660, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>◷</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Datos sin marcar</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 1, lineHeight: 1.4 }}>Deadline (opcional) y checklist de tus tareas. La checklist la arma MaKo — no tienes que escribir los pasos. Lo que no quieras, lo ignoras.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* lista */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 22px' }}>
          {items.length === 0 ? (
            <div style={{ padding: '44px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 14 }}>No falta ningún dato. 🎉</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {items.map(({ task: t, needDl, needCl }) => {
                const st = gen[t.id] ?? 'idle';
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 17, flex: 'none' }}>{t.emoji || '•'}</span>
                    <button type="button" onClick={() => onAbrir(t.id)} title="Abrir la tarea"
                      style={{ flex: '1 1 180px', minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: SANS }}>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>#{t.num}</span>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title || 'Sin título'}</span>
                    </button>

                    {/* control de deadline */}
                    {needDl && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                        <input type="date" onChange={(e) => { if (e.target.value) onSetDeadline(t.id, e.target.value); }} title="Poner deadline"
                          style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, outline: 'none', fontFamily: SANS }} />
                        <button type="button" onClick={() => onIgnorarDl(t.id)} title="No pedir el deadline de esta tarea" aria-label="Ignorar deadline"
                          style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
                      </span>
                    )}

                    {/* control de checklist — la arma MaKo */}
                    {needCl && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                        {st === 'error'
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11.5, color: 'var(--bad)' }}>No pudo — </span>
                              <button type="button" onClick={() => onAbrir(t.id)} style={mkBtn('var(--border-strong)', 'var(--dim)')}>hacela a mano</button>
                            </span>
                          : <button type="button" disabled={st === 'loading' || batch} onClick={() => void genUna(t.id)}
                              style={mkBtn('var(--primary-weak)', 'var(--primary)', st === 'loading' || batch)}>
                              {st === 'loading' ? '✦ armando…' : <><MakoStar size={12} color="var(--primary)" /> arma la checklist</>}
                            </button>}
                        <button type="button" onClick={() => onIgnorarCl(t.id)} title="No pedir la checklist de esta tarea" aria-label="Ignorar checklist"
                          style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>El deadline es opcional. Nada de esto bloquea el plan.</span>
          {faltanCl > 0 && (
            <button type="button" disabled={batch} onClick={() => void genTodas()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 11, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: batch ? 'wait' : 'pointer', fontFamily: SANS, opacity: batch ? 0.7 : 1 }}>
              <MakoStar size={14} color="var(--primary)" /> {batch ? 'MaKo armando…' : `MaKo arma las ${faltanCl} checklists`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const mkBtn = (border: string, color: string, disabled = false): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`, background: 'var(--surface)', color, fontSize: 12, fontWeight: 700, cursor: disabled ? 'wait' : 'pointer', fontFamily: SANS, whiteSpace: 'nowrap', opacity: disabled ? 0.7 : 1,
});

// 2do pop-up (feedback jul-19): aparece DESPUÉS de cerrar el DatosModal (nunca apilado).
// NO se cierra por afuera ni con Escape — SOLO por uno de sus 2 botones.
export function DatosConfirm({ onNoPreguntar, onLuego }: { onNoPreguntar: () => void; onLuego: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 146, background: 'rgba(18,21,27,.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: SANS }}>
      <div role="alertdialog" aria-modal="true"
        style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 24px 60px rgba(18,21,27,.3)', padding: '22px 24px' }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>¿Seguir recordándote los datos que faltan?</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 20 }}>Puedes reabrirlo cuando quieras desde el ícono ⚠ del plan.</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={onNoPreguntar}
            style={{ padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>No volver a pedir todos</button>
          <button type="button" onClick={onLuego}
            style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: SANS }}>Recordármelo más tarde</button>
        </div>
      </div>
    </div>
  );
}
