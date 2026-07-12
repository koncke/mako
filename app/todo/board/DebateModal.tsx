'use client';

// DebateModal — el usuario debate la prioridad de una tarea con el guardián.
// MaKo escucha, es exigente y decide el score (tiene la última palabra). El
// usuario puede insistir con otro argumento o aceptar el veredicto.

import { useEffect, useState, type CSSProperties } from 'react';
import { type BoardTask, prioFromScore, PLABEL, PCOLOR } from './types';
import { GuardianIcon } from './GuardianIcon';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

async function debate(body: Record<string, unknown>): Promise<{ ok: boolean; score?: number; razon?: string; respuesta?: string; error?: string }> {
  return fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', ...body }) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

export function DebateModal({ task, planResumen, onApply, onClose }: {
  task: BoardTask; planResumen: string;
  onApply: (score: number, razon: string) => void; onClose: () => void;
}) {
  const [arg, setArg] = useState('');
  const [loading, setLoading] = useState(false);
  const [veredicto, setVeredicto] = useState<{ score: number; razon: string; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const enviar = async () => {
    if (!arg.trim() || loading) return;
    setLoading(true); setErr('');
    const tarea = `${task.title}${task.detalle ? `\n\n${task.detalle}` : ''}`;
    const j = await debate({ tarea, scoreActual: task.score, argumento: arg.trim(), plan: planResumen });
    if (j.ok && typeof j.score === 'number') setVeredicto({ score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '' });
    else setErr(j.error || 'MaKo no pudo responder ahora.');
    setLoading(false);
  };
  const aceptar = () => { if (veredicto) onApply(veredicto.score, veredicto.razon); onClose(); };

  const prioActual = prioFromScore(task.score);
  const prioNueva = veredicto ? prioFromScore(veredicto.score) : prioActual;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '82vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={20} />
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: 'var(--accent)' }}>PERRO GUARDIÁN</span>
          <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>debatir la prioridad</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', marginBottom: 16 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{task.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--dim)' }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, color: PCOLOR[prioActual] }}>⚡{task.score} · {PLABEL[prioActual]}</span>
              {task.scoreRazon && <span style={{ fontStyle: 'italic', color: 'var(--faint)' }}>“{task.scoreRazon}”</span>}
            </div>
          </div>

          {!veredicto && (
            <>
              <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', display: 'block', marginBottom: 6 }}>Tu argumento</label>
              <textarea value={arg} onChange={(e) => setArg(e.target.value)} autoFocus placeholder="¿Por qué debería ser más (o menos) prioritaria? Demostrá impacto real…"
                style={{ width: '100%', minHeight: 110, border: '1px solid var(--border-strong)', borderRadius: 10, outline: 'none', resize: 'vertical', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, lineHeight: 1.55, padding: '11px 13px', fontFamily: SANS }} />
              {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 8 }}>{err}</div>}
            </>
          )}

          {loading && <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>MaKo está evaluando tu argumento…</div>}

          {veredicto && !loading && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--faint)' }}>VEREDICTO</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: PCOLOR[prioActual] }}>⚡{task.score}</span>
                <span style={{ color: 'var(--faint)' }}>→</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15, color: PCOLOR[prioNueva] }}>⚡{veredicto.score} · {PLABEL[prioNueva]}</span>
                {veredicto.score === task.score && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>(sin cambios)</span>}
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)', borderRadius: 10, padding: '12px 14px' }}>{veredicto.respuesta}</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '13px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          {!veredicto
            ? <button type="button" onClick={enviar} disabled={!arg.trim() || loading} style={{ ...primaryBtn, opacity: !arg.trim() || loading ? 0.5 : 1 }}>Debatir →</button>
            : <>
                <button type="button" onClick={() => { setVeredicto(null); setArg(''); }} style={ghostBtn}>Insistir</button>
                <button type="button" onClick={aceptar} style={primaryBtn}>Aceptar veredicto</button>
              </>}
        </div>
      </div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '10px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
