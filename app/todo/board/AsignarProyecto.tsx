'use client';

// AsignarProyectoModal — cambiar/asignar el/los proyecto(s) de una tarea pasa por el
// Perro Guardián (feedback #7): es un CHECKLIST (puede ir a más de un proyecto), con
// los proyectos actuales YA marcados, más una pregunta "¿por qué en esos proyectos?"
// para que el perro tome nota. Muestra el impacto en la prioridad antes de confirmar.

import { useState } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody, textareaStyle } from './guardian-form';
import { type BoardTask, type Label, prioFromScore, PLABEL, PCOLOR, displayPrio, EMERGENCY_SCORE } from './types';

const SANS = "'Geist', sans-serif";

export function AsignarProyectoModal({ task, labels, topProjectId, onAsignar, onClose }: {
  task: BoardTask; labels: Label[]; topProjectId: string | null;
  onAsignar: (labelIds: string[], motivo: string) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<string[]>(task.labels.slice());   // proyectos actuales pre-marcados
  const [motivo, setMotivo] = useState('');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const confirmar = () => { onAsignar(sel, motivo.trim()); onClose(); };

  // impacto: adónde caería la tarea con la nueva asignación (misma regla de displayPrio).
  const prioCruda = prioFromScore(task.score);
  const prioNueva = displayPrio({ ...task, labels: sel }, topProjectId);
  const topea = prioCruda === 'alta' && prioNueva !== 'alta';
  const emergencia = task.score >= EMERGENCY_SCORE;

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿En qué proyecto(s) va esta tarea?', '¿Por qué en esos proyectos?'];
  const subs: (string | undefined)[] = [undefined, 'Podés elegir más de uno. El proyecto define si puede estar en Alta.', 'Contame tu criterio: así entiendo dónde encaja de verdad.'];
  const puedeAvanzar = idx === 0 ? true : idx === 1 ? true : motivo.trim() !== '';

  return (
    <WizardShell
      titulo="Asignar proyecto"
      total={3} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 2} confirmLabel="Asignar"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={confirmar}
    >
      {idx === 0 && <IntroBody que={`mover "${task.title.slice(0, 44)}" de proyecto`} mi="cuidar que solo lo del Objetivo Principal pise la columna Alta" />}
      {idx === 1 && (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {labels.map((l) => {
            const on = sel.includes(l.id);
            const esTop = l.id === topProjectId;
            return (
              <button key={l.id} type="button" onClick={() => toggle(l.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
                <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
                <span style={{ flex: 1 }}>{l.emoji} {l.name}</span>
                {esTop && <span style={{ fontSize: 11, fontWeight: 700, color: l.color }}>🎯</span>}
              </button>
            );
          })}
          <div style={{ fontSize: 12.5, lineHeight: 1.5, borderRadius: 10, padding: '10px 13px', marginTop: 4, color: topea ? 'var(--warn)' : 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {sel.length === 0
              ? <>Sin proyecto: queda en <strong style={{ color: PCOLOR[prioNueva] }}>{PLABEL[prioNueva]}</strong> (score {task.score}).</>
              : emergencia
                ? <>Es una emergencia (score {task.score}) → entra a <strong style={{ color: PCOLOR.alta }}>Alta</strong> igual.</>
                : topea
                  ? <>No incluís al Objetivo Principal: esta tarea (score {task.score}) queda topeada en <strong style={{ color: PCOLOR[prioNueva] }}>{PLABEL[prioNueva]}</strong> en vez de Alta.</>
                  : <>Queda en <strong style={{ color: PCOLOR[prioNueva] }}>{PLABEL[prioNueva]}</strong> (score {task.score}).</>}
          </div>
        </div>
      )}
      {idx === 2 && <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ej: es parte del núcleo, no de growth…" style={{ ...textareaStyle }} />}
    </WizardShell>
  );
}
