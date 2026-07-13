'use client';

// ReunionExtractModal — G3: MaKo lee una reunión de Fathom y saca los action items
// del equipo como tarjetas del plan. Dos fases: elegir la reunión → revisar los
// candidatos (incluir/excluir + reasignar proyecto) → agregar al plan. El perro
// guardián los re-puntúa solo cuando entran (cambia la firma del plan).

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { ScoreIcon } from './guardian-form';
import { type Label, type Prio, PLABEL } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type ReunionMeta = { recordingId: number; titulo: string; fecha: string | null; durMin: number | null; url: string | null };
type Candidata = { titulo: string; detalle: string; prioridad: Prio; proyectoId: string | null };
type Fila = Candidata & { incluir: boolean };

const banda = (p: Prio): string => (p === 'alta' ? '#D0504A' : p === 'media' ? '#C8870C' : p === 'baja' ? '#1E9E57' : '#98A0AC');

async function apiFathom(body: Record<string, unknown>): Promise<{ ok: boolean; reuniones?: ReunionMeta[]; tareas?: Candidata[]; usage?: unknown; error?: string }> {
  return fetch('/api/plan-fathom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; }
}

export function ReunionExtractModal({ labels, onCrear, onUsage, onClose }: {
  labels: Label[];
  onCrear: (cands: Candidata[]) => void;
  onUsage?: (u: unknown) => void;
  onClose: () => void;
}) {
  const [fase, setFase] = useState<'lista' | 'extrayendo' | 'revisar'>('lista');
  const [reuniones, setReuniones] = useState<ReunionMeta[] | null>(null);
  const [elegida, setElegida] = useState<ReunionMeta | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let vivo = true;
    apiFathom({ action: 'reuniones' }).then((j) => {
      if (!vivo) return;
      if (j.ok && j.reuniones) setReuniones(j.reuniones);
      else { setErr(j.error || 'No pude traer las reuniones.'); setReuniones([]); }
    });
    return () => { vivo = false; };
  }, []);

  const extraer = async (r: ReunionMeta) => {
    setElegida(r); setFase('extrayendo'); setErr('');
    const proyectos = labels.map((l) => ({ id: l.id, emoji: l.emoji, nombre: l.name }));
    const j = await apiFathom({ action: 'extraer', recordingId: r.recordingId, proyectos, uso: 'Extraer tareas de reunión' });
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && j.tareas) { setFilas(j.tareas.map((t) => ({ ...t, incluir: true }))); setFase('revisar'); }
    else { setErr(j.error || 'MaKo no pudo leer la reunión.'); setFase('lista'); setElegida(null); }
  };

  const nIncluidas = useMemo(() => filas.filter((f) => f.incluir).length, [filas]);
  const confirmar = () => { onCrear(filas.filter((f) => f.incluir).map(({ incluir: _i, ...c }) => c)); onClose(); };
  const setFila = (i: number, patch: Partial<Fila>) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={34} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · REUNIÓN → PLAN</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>
              {fase === 'lista' ? 'Elegí una reunión' : fase === 'extrayendo' ? 'Leyendo la reunión…' : `Action items · ${elegida?.titulo.slice(0, 40) ?? ''}`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* cuerpo */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px' }}>
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 12 }}>{err}</div>}

          {/* lista de reuniones */}
          {fase === 'lista' && (
            reuniones == null
              ? <Cargando texto="Buscando tus reuniones en Fathom…" />
              : reuniones.length === 0
                ? <Vacio texto="No encontré reuniones recientes en Fathom." />
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {reuniones.map((r) => (
                      <button key={r.recordingId} type="button" onClick={() => extraer(r)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', fontFamily: SANS }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}>
                        <span style={{ fontSize: 20 }}>🎙️</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.titulo}</span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{fmtFecha(r.fecha)}{r.durMin ? ` · ${r.durMin} min` : ''}</span>
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Extraer →</span>
                      </button>
                    ))}
                  </div>
          )}

          {/* extrayendo */}
          {fase === 'extrayendo' && <Cargando texto="MaKo está sacando los action items del equipo…" grande />}

          {/* revisar candidatos */}
          {fase === 'revisar' && (
            filas.length === 0
              ? <Vacio texto="MaKo no encontró action items concretos del equipo en esta reunión." />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 2 }}>Elegí cuáles agregar. El perro guardián les pone la prioridad final cuando entren al plan.</div>
                  {filas.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 11, padding: '12px 13px', borderRadius: 12, border: `1px solid ${f.incluir ? 'var(--primary)' : 'var(--border)'}`, background: f.incluir ? 'var(--primary-bg)' : 'var(--surface-2)', opacity: f.incluir ? 1 : 0.6 }}>
                      <button type="button" onClick={() => setFila(i, { incluir: !f.incluir })} aria-label="Incluir"
                        style={{ width: 20, height: 20, flex: 'none', marginTop: 1, borderRadius: 6, border: `1.5px solid ${f.incluir ? 'var(--primary)' : 'var(--border-strong)'}`, background: f.incluir ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.incluir ? '✓' : ''}</button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{f.titulo}</div>
                        {f.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>{f.detalle}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: banda(f.prioridad), fontFamily: MONO }}><ScoreIcon size={11} color={banda(f.prioridad)} />{PLABEL[f.prioridad]}</span>
                          <select value={f.proyectoId ?? ''} onChange={(e) => setFila(i, { proyectoId: e.target.value || null })} style={selProj}>
                            <option value="">Sin proyecto</option>
                            {labels.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          )}
        </div>

        {/* footer */}
        {fase === 'revisar' && filas.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={() => { setFase('lista'); setElegida(null); setFilas([]); }} style={ghostBtn}>← Otra reunión</button>
            <button type="button" onClick={confirmar} disabled={nIncluidas === 0}
              style={{ padding: '12px 24px', borderRadius: 11, border: 'none', background: nIncluidas ? 'var(--primary)' : 'var(--border)', color: nIncluidas ? '#fff' : 'var(--faint)', fontSize: 14, fontWeight: 700, cursor: nIncluidas ? 'pointer' : 'default', fontFamily: SANS }}>
              {nIncluidas ? `Agregar ${nIncluidas} al plan →` : 'Elegí al menos una'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Cargando({ texto, grande }: { texto: string; grande?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: grande ? '46px 0' : '30px 0', color: 'var(--dim)', textAlign: 'center' }}>
      {grande && <GuardianIcon size={48} />}
      <Spinner />
      <div style={{ fontSize: 13.5 }}>{texto}</div>
    </div>
  );
}
function Vacio({ texto }: { texto: string }) {
  return <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--faint)', fontSize: 14, lineHeight: 1.5 }}>{texto}</div>;
}
function Spinner() {
  return (
    <>
      <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid var(--border-strong)', borderTopColor: 'var(--primary)', display: 'inline-block', animation: 'makoSpin 0.7s linear infinite' }} />
      <style>{'@keyframes makoSpin{to{transform:rotate(360deg)}}'}</style>
    </>
  );
}

const selProj: CSSProperties = { padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12, fontFamily: SANS, maxWidth: 200, cursor: 'pointer' };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: SANS };
