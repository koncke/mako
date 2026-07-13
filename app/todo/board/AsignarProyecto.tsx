'use client';

// AsignarProyectoModal — cambiar/asignar el proyecto de una tarea pasa por el
// Perro Guardián: elegís el proyecto y MaKo te muestra el IMPACTO en la prioridad
// (la restricción de Alta al Objetivo Principal) antes de confirmar.

import { useState } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody } from './guardian-form';
import { type BoardTask, type Label, prioFromScore, PLABEL, PCOLOR, displayPrio, EMERGENCY_SCORE } from './types';

const SANS = "'Geist', sans-serif";

export function AsignarProyectoModal({ task, labels, topProjectId, onAsignar, onClose }: {
  task: BoardTask; labels: Label[]; topProjectId: string | null;
  onAsignar: (labelId: string) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState('');
  const confirmar = () => { if (sel) onAsignar(sel); onClose(); };

  // impacto: adónde caería la tarea si se asigna al proyecto elegido
  const prioCruda = prioFromScore(task.score);
  const prioNueva = sel ? displayPrio({ ...task, labels: [sel] }, topProjectId) : prioCruda;
  const topea = sel && prioCruda === 'alta' && prioNueva !== 'alta';
  const emergencia = task.score >= EMERGENCY_SCORE;

  return (
    <WizardShell
      titulo="Asignar proyecto"
      total={2} idx={idx}
      pregunta={idx === 0 ? 'Hola, soy el Perro Guardián MaKo' : '¿A qué proyecto la mando?'}
      sub={idx === 0 ? undefined : 'El proyecto define si puede estar en Alta.'}
      puedeAvanzar={idx === 0 ? true : sel !== ''}
      enUltimo={idx === 1} confirmLabel="Asignar"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(0))}
      onSiguiente={() => setIdx(1)}
      onConfirmar={confirmar}
    >
      {idx === 0
        ? <IntroBody que={`cambiar el proyecto de "${task.title.slice(0, 44)}"`} mi="cuidar que solo lo del Objetivo Principal pise la columna Alta" />
        : <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {labels.map((l) => {
              const on = sel === l.id;
              const esTop = l.id === topProjectId;
              return (
                <button key={l.id} type="button" onClick={() => setSel(on ? '' : l.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
                  <span style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2.5px var(--surface)' : 'none' }} />
                  <span style={{ flex: 1 }}>{l.emoji} {l.name}</span>
                  {esTop && <span style={{ fontSize: 10.5, fontWeight: 700, color: l.color }}>🎯</span>}
                </button>
              );
            })}
            {sel && (
              <div style={{ fontSize: 12.5, lineHeight: 1.5, borderRadius: 10, padding: '10px 13px', marginTop: 4, color: topea ? 'var(--warn)' : 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {emergencia
                  ? <>Es una emergencia (score {task.score}) → entra a <strong style={{ color: PCOLOR.alta }}>Alta</strong> igual.</>
                  : topea
                    ? <>No es el Objetivo Principal: esta tarea (score {task.score}) queda topeada en <strong style={{ color: PCOLOR[prioNueva] }}>{PLABEL[prioNueva]}</strong> en vez de Alta.</>
                    : <>Queda en <strong style={{ color: PCOLOR[prioNueva] }}>{PLABEL[prioNueva]}</strong> (score {task.score}).</>}
              </div>
            )}
          </div>}
    </WizardShell>
  );
}
