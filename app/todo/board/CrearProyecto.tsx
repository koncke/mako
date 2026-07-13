'use client';

// CrearProyectoModal — crear un proyecto por formulario (de a 1 pregunta, con el
// Perro Guardián): intro → ¿de qué se trata? → MaKo propone nombre + emoji →
// confirmás (editable). onCrear(nombre, emoji, detalle).

import { useState } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody, textareaStyle, inputStyle } from './guardian-form';
import { EmojiPickerMini } from './EmojiPicker';

const MONO = "'Geist Mono', monospace";

async function proponer(descripcion: string): Promise<{ nombre: string; emoji: string }> {
  try {
    const j = await fetch('/api/checklist-coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'proyecto', descripcion }) }).then((r) => r.json());
    return j.ok ? { nombre: String(j.nombre || ''), emoji: String(j.emoji || '🏷') } : { nombre: '', emoji: '🏷' };
  } catch { return { nombre: '', emoji: '🏷' }; }
}

export function CrearProyectoModal({ onCrear, onClose }: { onCrear: (nombre: string, emoji: string, detalle: string) => void; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('🏷');
  const [prop, setProp] = useState(false); // ya se propuso

  const pedirPropuesta = async () => {
    setLoading(true);
    const p = await proponer(desc.trim());
    setNombre(p.nombre || desc.trim().slice(0, 30)); setEmoji(p.emoji || '🏷');
    setLoading(false); setProp(true); setIdx(2);
  };
  const crear = () => { if (nombre.trim()) onCrear(nombre.trim(), emoji, desc.trim()); onClose(); };

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿De qué se trata el proyecto?', 'Listo, ¿lo dejamos así?'];
  const subs = [undefined, 'Contámelo en tus palabras y le pongo nombre + emoji.', 'Podés ajustar el nombre o el emoji.'];
  const puedeAvanzar = idx === 1 ? desc.trim() !== '' : idx === 2 ? nombre.trim() !== '' : true;
  return (
    <WizardShell
      titulo="Nuevo proyecto"
      total={3} idx={idx}
      pregunta={loading ? 'MaKo está pensando el nombre…' : preguntas[idx]}
      sub={loading ? undefined : subs[idx]}
      puedeAvanzar={puedeAvanzar} pending={loading}
      enUltimo={idx === 2} confirmLabel="Crear proyecto"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => (idx === 1 ? void pedirPropuesta() : setIdx(idx + 1))}
      onConfirmar={crear}
    >
      {loading
        ? <div style={{ padding: '22px 0', color: 'var(--dim)', fontSize: 14 }}>Buscando un buen nombre…</div>
        : idx === 0
          ? <IntroBody que="crear un proyecto nuevo" mi="agrupar tus tareas por lo que de verdad mueve la aguja" />
          : idx === 1
            ? <textarea value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus placeholder="Ej: todo lo de conseguir y nutrir leads por WhatsApp y email" style={{ ...textareaStyle }} />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                  <EmojiPickerMini value={emoji} onPick={setEmoji} />
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto" style={{ ...inputStyle, maxWidth: 320, textAlign: 'center', fontWeight: 600 }} />
                </div>
                {prop && <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>propuesto por MaKo · editá si querés</div>}
              </div>}
    </WizardShell>
  );
}
