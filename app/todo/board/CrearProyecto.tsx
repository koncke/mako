'use client';

// CrearProyectoModal — crear un proyecto por formulario (de a 1 pregunta, con el
// Perro Guardián): intro → ¿de qué se trata? → ¿por qué importa / qué tareas viven
// acá? → MaKo propone nombre + emoji + DETALLE → confirmás (todo editable).
// onCrear(nombre, emoji, detalle).

import { useState } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody, textareaStyle, inputStyle } from './guardian-form';
import { EmojiPickerMini } from './EmojiPicker';

const MONO = "'Geist Mono', monospace";

async function proponer(descripcion: string): Promise<{ nombre: string; emoji: string; detalle: string }> {
  try {
    const j = await fetch('/api/checklist-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'proyecto', descripcion }) }).then((r) => r.json());
    return j.ok ? { nombre: String(j.nombre || ''), emoji: String(j.emoji || '🏷'), detalle: String(j.detalle || '') } : { nombre: '', emoji: '🏷', detalle: '' };
  } catch { return { nombre: '', emoji: '🏷', detalle: '' }; }
}

export function CrearProyectoModal({ onCrear, onClose }: { onCrear: (nombre: string, emoji: string, detalle: string) => void; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [desc, setDesc] = useState('');
  const [porque, setPorque] = useState('');
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('🏷');
  const [detalle, setDetalle] = useState('');
  const [prop, setProp] = useState(false); // ya se propuso

  const pedirPropuesta = async () => {
    setLoading(true);
    const descripcion = `${desc.trim()}${porque.trim() ? `\n\nPor qué importa / qué tareas viven acá: ${porque.trim()}` : ''}`;
    const p = await proponer(descripcion);
    setNombre(p.nombre || desc.trim().slice(0, 30)); setEmoji(p.emoji || '🏷'); setDetalle(p.detalle || desc.trim());
    setLoading(false); setProp(true); setIdx(3);
  };
  const crear = () => { if (nombre.trim()) onCrear(nombre.trim(), emoji, detalle.trim()); onClose(); };

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿De qué se trata el proyecto?', '¿Por qué importa? ¿Qué tareas viven acá?', 'Listo, ¿lo dejamos así?'];
  const subs = [undefined, 'Contámelo en tus palabras.', 'Con esto le pongo nombre, emoji y un buen detalle. Podés saltearlo.', 'Ajustá el nombre, el emoji o el detalle.'];
  const puedeAvanzar = idx === 1 ? desc.trim() !== '' : idx === 3 ? nombre.trim() !== '' : true;
  return (
    <WizardShell
      titulo="Nuevo proyecto"
      total={4} idx={idx}
      pregunta={loading ? 'MaKo está pensando el proyecto…' : preguntas[idx]}
      sub={loading ? undefined : subs[idx]}
      puedeAvanzar={puedeAvanzar} pending={loading}
      enUltimo={idx === 3} confirmLabel="Crear proyecto"
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
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <EmojiPickerMini value={emoji} onPick={setEmoji} />
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" style={{ ...inputStyle, maxWidth: 320, textAlign: 'center', fontWeight: 600 }} />
                  </div>
                  <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle del proyecto…" style={{ ...textareaStyle, minHeight: 96 }} />
                  {prop && <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', textAlign: 'center' }}>propuesto por MaKo · editá lo que quieras</div>}
                </div>}
    </WizardShell>
  );
}
