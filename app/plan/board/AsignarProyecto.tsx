'use client';

// AsignarProyectoModal — cambiar el/los proyecto(s) de una tarea (CHECKLIST, multi).
// Los proyectos ACTUALES vienen marcados con el chip "Actual"; no se puede avanzar si
// no cambiás nada. La pregunta final es PERSONALIZADA según el cambio (sin proyecto /
// cambiás de X a Y / agregás A, B, C). El motivo queda en el historial (feedback #19).

import { useState, type CSSProperties } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody, textareaStyle } from './guardian-form';
import { type BoardTask, type Label } from './types';

const SANS = "'Geist', sans-serif";

export function AsignarProyectoModal({ task, labels, onAsignar, onClose }: {
  task: BoardTask; labels: Label[];
  onAsignar: (labelIds: string[], motivo: string) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<string[]>(task.labels.slice());
  const [motivo, setMotivo] = useState('');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const confirmar = () => { onAsignar(sel, motivo.trim()); onClose(); };

  const actuales = task.labels;
  const mismos = sel.length === actuales.length && sel.every((id) => actuales.includes(id));
  const agregados = sel.filter((id) => !actuales.includes(id));
  const quitados = actuales.filter((id) => !sel.includes(id));

  const chip = (id: string) => { const l = labels.find((x) => x.id === id); return l ? <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 700, padding: '3px 10px', borderRadius: 999, border: `1px solid ${l.color}59`, background: `${l.color}1f`, color: l.color }}>{l.emoji} {l.name}</span> : null; };
  // encabezado del cambio, con emojis + chips (se lee más fácil que un texto plano)
  const cambioHeader = () => {
    const flecha = <span style={{ color: 'var(--faint)', fontSize: 18, margin: '0 2px' }}>→</span>;
    if (sel.length === 0) return <div style={cambioBox}><span style={{ color: 'var(--dim)', fontSize: 14 }}>La dejás <b style={{ color: 'var(--ink)' }}>sin proyecto</b>.</span></div>;
    if (quitados.length === actuales.length && actuales.length > 0 && agregados.length) {
      if (actuales.length === 1 && sel.length === 1) return <div style={cambioBox}>{chip(actuales[0])}{flecha}{chip(sel[0])}</div>;
      return <div style={cambioBox}>{sel.map(chip)}</div>;
    }
    if (agregados.length && !quitados.length) return <div style={cambioBox}><span style={{ color: 'var(--dim)', fontSize: 13.5 }}>Agregás</span>{agregados.map(chip)}</div>;
    if (quitados.length && !agregados.length) return <div style={cambioBox}><span style={{ color: 'var(--dim)', fontSize: 13.5 }}>Sacás</span>{quitados.map(chip)}</div>;
    return <div style={cambioBox}>{sel.map(chip)}</div>;
  };

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿En qué proyecto(s) va esta tarea?', sel.length === 0 ? '¿Por qué la dejás sin proyecto?' : '¿Por qué el cambio?'];
  const subs: (string | undefined)[] = [undefined, 'Podés elegir más de uno. Tenés que cambiar algo para seguir.', 'Contame tu criterio: así entiendo dónde encaja de verdad.'];
  const puedeAvanzar = idx === 0 ? true : idx === 1 ? !mismos : motivo.trim() !== '';

  return (
    <WizardShell
      titulo="Cambiar proyecto"
      total={3} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 2} confirmLabel="Guardar →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={confirmar}
    >
      {idx === 0 && <IntroBody que={`mover "${task.title.slice(0, 44)}" de proyecto`} mi="que cada tarea viva donde de verdad corresponde" />}
      {idx === 1 && (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {labels.map((l) => {
            const on = sel.includes(l.id);
            const esActual = actuales.includes(l.id);
            return (
              <button key={l.id} type="button" onClick={() => toggle(l.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
                <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
                <span style={{ flex: 1 }}>{l.emoji} {l.name}</span>
                {esActual && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 5, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Actual</span>}
              </button>
            );
          })}
        </div>
      )}
      {idx === 2 && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{cambioHeader()}<textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ej: es parte del núcleo, no de growth…" style={{ ...textareaStyle }} /></div>}
    </WizardShell>
  );
}

const cambioBox: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' };
