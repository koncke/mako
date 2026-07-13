'use client';

// AsignarProyectoModal — cambiar el/los proyecto(s) de una tarea (CHECKLIST, multi).
// Los proyectos ACTUALES vienen marcados con el chip "Actual"; no se puede avanzar si
// no cambiás nada. La pregunta final es PERSONALIZADA según el cambio (sin proyecto /
// cambiás de X a Y / agregás A, B, C). El motivo queda en el historial (feedback #19).

import { useState } from 'react';
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

  const nombre = (id: string) => labels.find((l) => l.id === id)?.name ?? '';
  const actuales = task.labels;
  const mismos = sel.length === actuales.length && sel.every((id) => actuales.includes(id));
  const agregados = sel.filter((id) => !actuales.includes(id));
  const quitados = actuales.filter((id) => !sel.includes(id));

  // pregunta final personalizada según el tipo de cambio
  const preguntaPorque = (): string => {
    if (sel.length === 0) return '¿Por qué dejás esta tarea sin proyecto?';
    if (quitados.length === actuales.length && actuales.length > 0 && agregados.length) {
      if (actuales.length === 1 && sel.length === 1) return `¿Por qué la cambiás del proyecto ${nombre(actuales[0])} a ${nombre(sel[0])}?`;
      return `¿Por qué la movés a ${sel.map(nombre).join(', ')}?`;
    }
    if (agregados.length && !quitados.length) return `¿Por qué agregás ${agregados.map(nombre).join(', ')}?`;
    if (quitados.length && !agregados.length) return `¿Por qué sacás ${quitados.map(nombre).join(', ')}?`;
    return `¿Por qué la movés a ${sel.map(nombre).join(', ')}?`;
  };

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿En qué proyecto(s) va esta tarea?', preguntaPorque()];
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
      {idx === 2 && <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ej: es parte del núcleo, no de growth…" style={{ ...textareaStyle }} />}
    </WizardShell>
  );
}
