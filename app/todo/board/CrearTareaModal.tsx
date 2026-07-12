'use client';

// CrearTareaModal — al crear una tarea, el form termina con el guardián: MaKo la
// puntúa (con el argumento del usuario, si lo da) y decide a qué columna va. El
// usuario no elige la prioridad; la pone MaKo.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { type Prio, PLABEL, PCOLOR } from './types';
import { GuardianIcon } from './GuardianIcon';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type CrearResult = { score: number; prio: Prio; razon: string; respuesta: string } | null;

export function CrearTareaModal({ onCrear, onClose }: {
  onCrear: (title: string, detalle: string, argumento: string) => Promise<CrearResult>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [detalle, setDetalle] = useState('');
  const [argumento, setArgumento] = useState('');
  const [fase, setFase] = useState<'form' | 'puntuando' | 'veredicto'>('form');
  const [res, setRes] = useState<CrearResult>(null);
  const [err, setErr] = useState('');
  const firstRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const crear = async () => {
    if (!title.trim() || fase === 'puntuando') return;
    setFase('puntuando'); setErr('');
    const r = await onCrear(title.trim(), detalle.trim(), argumento.trim());
    if (r) { setRes(r); setFase('veredicto'); }
    else { setErr('MaKo no pudo priorizar; la tarea quedó en Media.'); setFase('veredicto'); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '82vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={20} />
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: 'var(--accent)' }}>PERRO GUARDIÁN</span>
          <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>nueva tarea · la prioriza</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)' }}>×</button>
        </div>

        <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
          {fase !== 'veredicto' && (
            <>
              <label style={lbl}>Tarea</label>
              <input ref={firstRef} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) crear(); }} placeholder="¿Qué hay que hacer?" style={inp} />
              <label style={{ ...lbl, marginTop: 16 }}>Detalle · doc (opcional)</label>
              <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Contexto, alcance…" style={{ ...inp, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }} />
              <label style={{ ...lbl, marginTop: 16 }}>¿Por qué importa? (MaKo lo usa para priorizar)</label>
              <textarea value={argumento} onChange={(e) => setArgumento(e.target.value)} placeholder="Impacto en ingresos, urgencia, qué desbloquea… (si lo dejás vacío, MaKo puntúa por impacto objetivo)" style={{ ...inp, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }} />
              {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 8 }}>{err}</div>}
              {fase === 'puntuando' && <div style={{ padding: '16px 0 4px', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>MaKo está priorizando la tarea…</div>}
            </>
          )}

          {fase === 'veredicto' && res && (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>{title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>VEREDICTO</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, color: PCOLOR[res.prio] }}>⚡{res.score} · {PLABEL[res.prio]}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)', borderRadius: 10, padding: '12px 14px' }}>{res.respuesta}</div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '13px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          {fase === 'veredicto'
            ? <button type="button" onClick={onClose} style={primaryBtn}>Listo</button>
            : <button type="button" onClick={crear} disabled={!title.trim() || fase === 'puntuando'} style={{ ...primaryBtn, opacity: !title.trim() || fase === 'puntuando' ? 0.5 : 1 }}>Crear · que MaKo la priorice →</button>}
        </div>
      </div>
    </div>
  );
}

const lbl: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', display: 'block', marginBottom: 6 };
const inp: CSSProperties = { width: '100%', border: '1px solid var(--border-strong)', borderRadius: 10, outline: 'none', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, padding: '10px 13px', fontFamily: SANS };
const primaryBtn: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
