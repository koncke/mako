'use client';

// CrearProyectoModal — crear un proyecto por formulario (de a 1 pregunta, con el
// Perro Guardián): intro → ¿de qué se trata? → ¿por qué importa? → MaKo propone
// nombre+emoji+detalle → ¿qué prioridad? (comparando con los otros). Guarda BORRADOR
// por si se sale. onCrear(nombre, emoji, detalle, score).

import { useEffect, useState } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody, textareaStyle, inputStyle, ScoreIcon } from './guardian-form';
import { EmojiPickerMini } from './EmojiPicker';

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
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('🏷');
  const [detalle, setDetalle] = useState('');
  const [score, setScore] = useState(5);
  const [prop, setProp] = useState(false);
  const [restored, setRestored] = useState(false);

  // BORRADOR: restaurar al abrir, guardar en cada cambio, limpiar al crear.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) { const d = JSON.parse(raw); setDesc(d.desc || ''); setPorque(d.porque || ''); setNombre(d.nombre || ''); setEmoji(d.emoji || '🏷'); setDetalle(d.detalle || ''); setScore(d.score || 5); if (d.nombre) { setProp(true); setIdx(3); } } } catch { /* no-op */ }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ desc, porque, nombre, emoji, detalle, score })); } catch { /* no-op */ }
  }, [restored, desc, porque, nombre, emoji, detalle, score]);
  const limpiarDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* no-op */ } };

  const pedirPropuesta = async () => {
    setLoading(true);
    const descripcion = `${desc.trim()}${porque.trim() ? `\n\nPor qué importa / qué tareas viven acá: ${porque.trim()}` : ''}`;
    const p = await proponer(descripcion);
    setNombre(p.nombre || desc.trim().slice(0, 30)); setEmoji(p.emoji || '🏷'); setDetalle(p.detalle || desc.trim());
    setLoading(false); setProp(true); setIdx(3);
  };
  const crear = () => { if (nombre.trim()) onCrear(nombre.trim(), emoji, detalle.trim(), score); limpiarDraft(); onClose(); };

  const ordenados = otros.slice().sort((a, b) => b.score - a.score);
  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿De qué se trata el proyecto?', '¿Por qué importa? ¿Qué tareas viven acá?', 'Listo, ¿lo dejamos así?', '¿Qué prioridad le pondrías?'];
  const subs = [undefined, 'Contámelo en tus palabras.', 'Con esto le pongo nombre, emoji y un buen detalle. Podés saltearlo.', 'Ajustá el nombre, el emoji o el detalle.', 'Comparalo con los demás. 10 = el Objetivo Principal (solo uno). El perro la reevalúa después.'];
  const puedeAvanzar = idx === 1 ? desc.trim() !== '' : idx === 3 ? nombre.trim() !== '' : true;
  return (
    <WizardShell
      titulo="Nuevo proyecto"
      total={5} idx={idx}
      pregunta={loading ? 'MaKo está pensando el proyecto…' : preguntas[idx]}
      sub={loading ? undefined : subs[idx]}
      puedeAvanzar={puedeAvanzar} pending={loading}
      enUltimo={idx === 4} confirmLabel="Crear proyecto"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : idx === 3 ? setIdx(2) : setIdx(idx - 1))}
      onSiguiente={() => (idx === 2 ? void pedirPropuesta() : setIdx(idx + 1))}
      onConfirmar={crear}
    >
      {loading
        ? <div style={{ padding: '22px 0', color: 'var(--dim)', fontSize: 14 }}>Buscando nombre, emoji y detalle…</div>
        : idx === 0
          ? <IntroBody que="crear un proyecto nuevo" mi="agrupar tus tareas por lo que de verdad mueve la aguja" />
          : idx === 1
            ? <textarea value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus placeholder="Ej: todo lo de conseguir y nutrir leads por WhatsApp y email" style={{ ...textareaStyle }} />
            : idx === 2
              ? <textarea value={porque} onChange={(e) => setPorque(e.target.value)} autoFocus placeholder="Ej: es de donde sale la facturación; van tareas de captación, nutrición y reportes" style={{ ...textareaStyle }} />
              : idx === 3
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                      <EmojiPickerMini value={emoji} onPick={setEmoji} />
                      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" style={{ ...inputStyle, maxWidth: 320, textAlign: 'center', fontWeight: 600 }} />
                    </div>
                    <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle del proyecto…" style={{ ...textareaStyle, minHeight: 96 }} />
                    {prop && <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>propuesto por MaKo · editá lo que quieras</div>}
                  </div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 32, fontWeight: 800, color: 'var(--ink)' }}><ScoreIcon size={28} />{score}<span style={{ fontSize: 19, color: 'var(--faint)' }}>/10</span></span>
                      {score === 10 && <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>sería el Objetivo Principal</div>}
                    </div>
                    <input type="range" min={1} max={10} step={1} value={score} onChange={(e) => setScore(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                    {ordenados.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
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
                  </div>}
    </WizardShell>
  );
}
