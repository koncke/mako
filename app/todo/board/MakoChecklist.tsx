'use client';

// MakoChecklistModal — MaKo te ayuda a OPTIMIZAR una tarea.
// Paso 1: MaKo hace preguntas de encuadre. Paso 2: propone un título más claro,
// un detalle accionable y una checklist (elegís qué aplicar).
// onApply recibe { titulo?, detalle?, items } → el board los aplica.

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type Sugerido = { texto: string; razon?: string };
export type CoachApply = { titulo?: string; detalle?: string; items: string[] };

async function coach(body: Record<string, unknown>): Promise<{ ok: boolean; preguntas?: string; titulo?: string; detalle?: string; items?: Sugerido[]; error?: string }> {
  return fetch('/api/checklist-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json())
    .catch((e) => ({ ok: false, error: String(e) }));
}

export function MakoChecklistModal({ title, detalle, yaOptimizada = false, onApply, onClose }: { title: string; detalle: string; yaOptimizada?: boolean; onApply: (r: CoachApply) => void; onClose: () => void }) {
  const tarea = (title + (detalle ? `\n\n${detalle}` : '')).trim();
  const [fase, setFase] = useState<'preguntando' | 'preguntas' | 'proponiendo' | 'propuesta'>('preguntando');
  const [preguntas, setPreguntas] = useState('');
  const [respuestas, setRespuestas] = useState('');
  const [items, setItems] = useState<Sugerido[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [propTit, setPropTit] = useState('');
  const [propDet, setPropDet] = useState('');
  const [useTit, setUseTit] = useState(false);
  const [useDet, setUseDet] = useState(false);
  const [err, setErr] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; started.current = true;
    (async () => {
      const j = await coach({ action: 'ask', tarea });
      if (j.ok && j.preguntas) { setPreguntas(j.preguntas); setFase('preguntas'); }
      else { setErr(j.error || 'No pude generar preguntas.'); setFase('preguntas'); }
    })();
  }, [tarea]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const proponer = async () => {
    setFase('proponiendo'); setErr('');
    const j = await coach({ action: 'propose', tarea, respuestas });
    const its = j.items || [];
    if (j.ok && (its.length || j.titulo || j.detalle)) {
      setItems(its); setSel(new Set(its.map((_, i) => i)));
      setPropTit(j.titulo || ''); setPropDet(j.detalle || '');
      setUseTit(!!j.titulo && j.titulo.trim() !== title.trim());
      setUseDet(!!j.detalle && j.detalle.trim() !== detalle.trim());
      setFase('propuesta');
    } else { setErr(j.error || 'MaKo no devolvió nada. Probá dando más contexto.'); setFase('preguntas'); }
  };
  const nApply = (useTit && propTit ? 1 : 0) + (useDet && propDet ? 1 : 0) + sel.size;
  const aplicar = () => {
    onApply({ titulo: useTit && propTit ? propTit : undefined, detalle: useDet && propDet ? propDet : undefined, items: items.filter((_, i) => sel.has(i)).map((x) => x.texto) });
    onClose();
  };

  const loading = fase === 'preguntando' || fase === 'proponiendo';
  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(18,21,27,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '9vh 16px 16px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 30px 70px rgba(18,21,27,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO</span>
          <span style={{ fontSize: 13.5, color: 'var(--dim)' }}>optimiza tu tarea</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: 'var(--faint)' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', overflowY: 'auto' }}>
          {/* contexto de la tarea, para no perder de vista de qué se trata */}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', marginBottom: 16 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{title || 'Tarea sin título'}</div>
            {detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{detalle}</div>}
          </div>
          {yaOptimizada && <div style={{ fontSize: 12.5, color: 'var(--good)', background: 'var(--good-bg, var(--surface-2))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', marginBottom: 14 }}>✓ Esta tarea ya fue optimizada por MaKo antes. Podés refinar la checklist si querés.</div>}
          {loading && <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>{fase === 'preguntando' ? 'MaKo está leyendo la tarea…' : 'MaKo está optimizando la tarea…'}</div>}

          {(fase === 'preguntas') && (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>{preguntas || 'Contame un poco más sobre esta tarea.'}</div>
              <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', display: 'block', marginBottom: 6 }}>Tus respuestas</label>
              <textarea value={respuestas} onChange={(e) => setRespuestas(e.target.value)} autoFocus placeholder="Respondé lo que puedas (no hace falta todo)…" style={{ width: '100%', minHeight: 110, border: '1px solid var(--border-strong)', borderRadius: 10, outline: 'none', resize: 'vertical', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, lineHeight: 1.55, padding: '11px 13px', fontFamily: SANS }} />
              {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 8 }}>{err}</div>}
            </>
          )}

          {fase === 'propuesta' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12 }}>Elegí qué aplicar:</div>
              {propTit && (
                <button type="button" onClick={() => setUseTit((v) => !v)} style={{ ...propCard(useTit), marginBottom: 8 }}>
                  <Check on={useTit} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 3 }}>Título mejorado</span>
                    <span style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)', fontWeight: 600 }}>{propTit}</span>
                  </span>
                </button>
              )}
              {propDet && (
                <button type="button" onClick={() => setUseDet((v) => !v)} style={{ ...propCard(useDet), marginBottom: 8 }}>
                  <Check on={useDet} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 3 }}>Detalle mejorado</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--dim)', lineHeight: 1.5 }}>{propDet}</span>
                  </span>
                </button>
              )}
              {items.length > 0 && <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', margin: '12px 0 6px' }}>Checklist</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {items.map((it, i) => (
                  <button key={i} type="button" onClick={() => setSel((s) => { const c = new Set(s); if (c.has(i)) c.delete(i); else c.add(i); return c; })}
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${sel.has(i) ? 'var(--primary-weak)' : 'var(--border)'}`, background: sel.has(i) ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', fontFamily: SANS }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${sel.has(i) ? 'var(--primary)' : 'var(--border-strong)'}`, background: sel.has(i) ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>{sel.has(i) ? '✓' : ''}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{it.texto}</span>
                      {it.razon && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>{it.razon}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {(fase === 'preguntas' || fase === 'propuesta') && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '13px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {fase === 'preguntas'
              ? <button type="button" onClick={proponer} style={primaryBtn}>Que MaKo lo optimice →</button>
              : <>
                  <button type="button" onClick={() => setFase('preguntas')} style={ghostBtn}>← Ajustar</button>
                  <button type="button" onClick={aplicar} disabled={nApply === 0} style={{ ...primaryBtn, opacity: nApply === 0 ? 0.5 : 1, cursor: nApply === 0 ? 'default' : 'pointer' }}>Aplicar {nApply}</button>
                </>}
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '10px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 500, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
const propCard = (on: boolean): CSSProperties => ({ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${on ? 'var(--primary-weak)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', fontFamily: SANS });
function Check({ on }: { on: boolean }) {
  return <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>{on ? '✓' : ''}</span>;
}
