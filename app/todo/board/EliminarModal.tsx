'use client';

// EliminarModal — borrar con fricción: el Perro Guardián pide un MOTIVO (de a 1
// pregunta, multiple-choice + custom). Se usa para tareas y para proyectos (con
// más advertencia). El motivo queda registrado en el change history.

import { useState } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody, ChoiceBody } from './guardian-form';

export function EliminarModal({ que, advertencia, opciones, confirmLabel, onConfirm, onClose }: {
  que: string;                 // "la tarea «X»" / "el proyecto «Y» y sus N tareas"
  advertencia?: string;        // línea roja extra (proyectos)
  opciones: string[];
  confirmLabel: string;
  onConfirm: (motivo: string) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [motivo, setMotivo] = useState('');
  const confirmar = () => { onConfirm(motivo.trim()); onClose(); };
  return (
    <WizardShell
      titulo="Eliminar"
      total={2} idx={idx}
      pregunta={idx === 0 ? 'Frená un segundo' : '¿Por qué la querés borrar?'}
      sub={idx === 0 ? undefined : 'Elegí un motivo o escribí el tuyo. Queda en el historial.'}
      puedeAvanzar={idx === 0 ? true : motivo.trim() !== ''}
      enUltimo={idx === 1} confirmLabel={confirmLabel}
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(0))}
      onSiguiente={() => setIdx(1)}
      onConfirmar={confirmar}
    >
      {idx === 0
        ? <><IntroBody que={`borrar ${que}`} mi="cuidar que no tires a la basura algo que después vas a necesitar" />{advertencia && <div style={{ marginTop: 14, fontSize: 13, color: 'var(--bad)', fontWeight: 600, background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '10px 13px' }}>{advertencia}</div>}</>
        : <ChoiceBody opciones={opciones} value={motivo} onChange={setMotivo} customPlaceholder="Otro motivo…" />}
    </WizardShell>
  );
}
