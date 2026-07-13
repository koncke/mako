'use client';

// CrearProyectoModal — crear un proyecto por formulario (de a 1 pregunta). MaKo NO
// sugiere nada en el medio: primero juntás tus respuestas (de qué se trata, por qué
// importa, qué prioridad), CONFIRMÁS, y recién ahí MaKo genera nombre + emoji +
// detalle (editable). Guarda BORRADOR. onCrear(nombre, emoji, detalle, score).

import { useEffect, useState, type CSSProperties } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody, textareaStyle, inputStyle, ScoreIcon } from './guardian-form';
import { GuardianIcon } from './GuardianIcon';
import { EmojiPickerMini } from './EmojiPicker';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const DRAFT_KEY = 'mako_draft_proyecto';

async function proponer(descripcion: string): Promise<{ nombre: string; emoji: string; detalle: string }> {
  try {
    const j = await fetch('/api/checklist-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'proyecto', descripcion }) }).then((r) => r.json());
    return j.ok ? { nombre: String(j.nombre || ''), emoji: String(j.emoji || '🏷'), detalle: String(j.detalle || '') } : { nombre: '', emoji: '🏷', detalle: '' };
  } catch { return { nombre: '', emoji: '🏷', detalle: '' }; }
}

export function CrearProyectoModal({ otros, onCrear, onClose }: { otros: Array<{ name: string; emoji: string; score: number; color: string }>; onCrear: (nombre: string, emoji: string, detalle: string, score: number) => void; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [desc, setDesc] = useState('');
  const [porque, setPorque] = useState('');
  const [score, setScore] = useState(50);
  const [fase, setFase] = useState<'form' | 'generando' | 'result'>('form');
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('🏷');
  const [detalle, setDetalle] = useState('');
  const [restored, setRestored] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) { const d = JSON.parse(raw); setDesc(d.desc || ''); setPorque(d.porque || ''); setScore(d.score || 50); } } catch { /* no-op */ }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ desc, porque, score })); } catch { /* no-op */ }
  }, [restored, desc, porque, score]);
  const limpiar = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* no-op */ } };

  const generar = async () => {
    setFase('generando');
    const descripcion = `${desc.trim()}${porque.trim() ? `\n\nPor qué importa / qué tareas viven acá: ${porque.trim()}` : ''}`;
    const p = await proponer(descripcion);
    setNombre(p.nombre || desc.trim().slice(0, 30)); setEmoji(p.emoji || '🏷'); setDetalle(p.detalle || desc.trim());
    setFase('result');
  };
  const crear = () => { if (nombre.trim()) onCrear(nombre.trim(), emoji, detalle.trim(), score); limpiar(); onClose(); };

  const ordenados = otros.slice().sort((a, b) => b.score - a.score);

  // ── generando / resultado editable ──
  if (fase !== 'form') {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '26px 26px 10px' }}>
          {fase === 'generando'
            ? <div style={{ padding: '34px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}><GuardianIcon size={44} /><div style={{ marginTop: 12 }}>MaKo está armando el proyecto…</div></div>
            : <>
                <div style={{ textAlign: 'center', marginBottom: 14 }}><GuardianIcon size={44} /><div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 8, fontFamily: MONO }}>propuesto por MaKo · editá lo que quieras</div></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <EmojiPickerMini value={emoji} onPick={setEmoji} />
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" style={{ ...inputStyle, maxWidth: 320, textAlign: 'center', fontWeight: 600 }} />
                </div>
                <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle del proyecto…" style={{ ...textareaStyle, minHeight: 110 }} />
              </>}
        </div>
        {fase === 'result' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={() => setFase('form')} style={ghostBtn}>← Volver</button>
            <button type="button" onClick={crear} disabled={!nombre.trim()} style={{ ...primaryBtn, opacity: nombre.trim() ? 1 : 0.5 }}>Crear proyecto →</button>
          </div>
        )}
      </Shell>
    );
  }

  const banda = score >= 75 ? '#D0504A' : score >= 50 ? '#C8870C' : score >= 25 ? '#1E9E57' : '#98A0AC';
  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿De qué se trata el proyecto?', '¿Qué prioridad le pondrías?', '¿Por qué importa? ¿Qué tareas viven acá?', '¿Mando esto a MaKo?'];
  const subs: (string | undefined)[] = [undefined, 'Contámelo en tus palabras.', 'Comparalo con los demás. 10 = el Objetivo Principal (solo uno).', 'Con esto MaKo le pone nombre, emoji y detalle. Podés saltearlo.', 'Revisá tus respuestas; MaKo genera con esto.'];
  const puedeAvanzar = idx === 1 ? desc.trim() !== '' : true;
  return (
    <WizardShell
      titulo="Nuevo proyecto"
      total={5} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 4} confirmLabel="Generar con MaKo →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={generar}
    >
      {idx === 0 && <IntroBody que="crear un proyecto nuevo" mi="agrupar tus tareas por lo que de verdad mueve la aguja" />}
      {idx === 1 && <textarea value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus placeholder="Ej: todo lo de conseguir y nutrir leads por WhatsApp y email" style={{ ...textareaStyle }} />}
      {idx === 3 && <textarea value={porque} onChange={(e) => setPorque(e.target.value)} autoFocus placeholder="Ej: es de donde sale la facturación; van tareas de captación, nutrición y reportes" style={{ ...textareaStyle }} />}
      {idx === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 32, fontWeight: 800, color: banda }}><ScoreIcon size={28} color={banda} />{score}<span style={{ fontSize: 19, color: 'var(--faint)' }}>/100</span></span>
            {score >= 95 && <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>sería el Objetivo Principal</div>}
          </div>
          <input type="range" min={1} max={100} step={1} value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ width: '100%', accentColor: banda }} />
          {ordenados.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, textAlign: 'left' }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>Los que ya tenés</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 150, overflowY: 'auto' }}>
                {ordenados.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dim)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: p.color, background: p.color + '18', border: `1px solid ${p.color}33`, borderRadius: 5, padding: '1px 6px 1px 5px' }}><ScoreIcon size={10} color={p.color} />{p.score}</span>
                    <span>{p.emoji} {p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {idx === 4 && (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['De qué se trata', desc], ['Por qué importa', porque]].map(([k, v], i) => (
            <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 13.5, color: v ? 'var(--ink)' : 'var(--faint)', fontWeight: 500 }}>{v || '(sin respuesta)'}</div>
            </div>
          ))}
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', flex: 1 }}>Prioridad</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 18, fontWeight: 800, color: banda }}><ScoreIcon size={17} color={banda} />{score}<span style={{ fontSize: 12, color: 'var(--faint)' }}>/100</span></span>
          </div>
        </div>
      )}
    </WizardShell>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
