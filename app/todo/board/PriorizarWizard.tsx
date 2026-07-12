'use client';

// PriorizarWizard — form BLOQUEANTE cuando una tarea es Alta y le falta deadline
// y/o checklist. No se cierra hasta completar lo que falta… o bajar la prioridad.
// De a una pregunta (WizardShell), con ayuda opcional de MaKo para la checklist.

import { useState } from 'react';
import { WizardShell, wizardInput } from '../../leads/WizardShell';
import { MakoChecklistModal } from './MakoChecklist';
import { type BoardTask, type Check, type Prio, uid, PLABEL } from './types';

export function PriorizarWizard({ task, onSetDeadline, onSetChecklist, onDowngrade, onDone, dismissable = false, onDismiss }: {
  task: BoardTask;
  onSetDeadline: (d: string) => void;
  onSetChecklist: (c: Check[]) => void;
  onDowngrade: (p: Prio) => void;
  onDone: () => void;
  dismissable?: boolean;      // TEMPORAL super-admin: permite cerrar sin completar
  onDismiss?: () => void;
}) {
  const needDeadline = !task.deadline;
  const needChecklist = task.checklist.length === 0;
  const steps = [...(needDeadline ? ['deadline'] : []), ...(needChecklist ? ['checklist'] : [])] as const;

  const [idx, setIdx] = useState(0);
  const [deadline, setDeadline] = useState(task.deadline);
  const [items, setItems] = useState<Check[]>(task.checklist);
  const [nuevo, setNuevo] = useState('');
  const [mako, setMako] = useState(false);
  const [pending, setPending] = useState(false);

  const paso = steps[idx] ?? 'checklist';
  const enUltimo = idx >= steps.length - 1;
  const puedeAvanzar = paso === 'deadline' ? !!deadline : items.length > 0;

  const preguntas: Record<string, string> = { deadline: '¿Para cuándo tiene que estar?', checklist: '¿Qué pasos hay que dar para cerrarla?' };
  const subs: Record<string, string> = { deadline: 'Una tarea en Alta necesita fecha límite.', checklist: 'Al menos un paso. Si querés, MaKo te ayuda a armarla.' };

  const guardar = () => {
    setPending(true);
    if (needDeadline && deadline) onSetDeadline(deadline);
    if (needChecklist) onSetChecklist(items);
    onDone();
  };
  const addItem = (text: string) => { const v = text.trim(); if (v) setItems((c) => [...c, { id: uid(), text: v, done: false }]); };

  return (
    <>
      <WizardShell
        titulo="Priorizar tarea"
        total={steps.length} idx={idx}
        pregunta={preguntas[paso]} sub={subs[paso]}
        puedeAvanzar={puedeAvanzar} enUltimo={enUltimo} confirmLabel="Guardar y priorizar"
        pending={pending} atrasLabel="Atrás"
        bloqueante={!dismissable} hideAtras={idx === 0}
        onClose={() => onDismiss?.()}
        onAtras={() => setIdx((i) => Math.max(0, i - 1))}
        onSiguiente={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
        onConfirmar={guardar}
      >
        {/* la tarea a la vista, para saber a qué se refiere */}
        <div style={{ textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', marginBottom: 16 }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 }}>La tarea</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{task.title || 'Sin título'}</div>
          {task.detalle && <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.detalle}</div>}
        </div>
        {paso === 'deadline' && (
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} autoFocus
            style={{ ...wizardInput, maxWidth: 260, margin: '0 auto', display: 'block' }} />
        )}
        {paso === 'checklist' && (
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { addItem(nuevo); setNuevo(''); } }} placeholder="+ paso (Enter)"
                style={{ ...wizardInput, textAlign: 'left', flex: 1 }} />
              <button type="button" onClick={() => setMako(true)} style={{ padding: '0 14px', borderRadius: 11, border: '1px solid var(--primary-weak)', background: 'var(--primary-bg)', color: 'var(--primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>✦ MaKo</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
              {items.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic' }}>Agregá al menos un paso, o pedile a MaKo que la arme.</div>}
              {items.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{c.text}</span>
                  <button type="button" onClick={() => setItems((cs) => cs.filter((x) => x.id !== c.id))} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* escape: bajar la prioridad en vez de detallarla */}
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>¿No es tan urgente? Bajala a</span>
          {(['media', 'baja', 'futuro'] as Prio[]).map((p) => (
            <button key={p} type="button" onClick={() => { onDowngrade(p); onDone(); }} style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{PLABEL[p]}</button>
          ))}
        </div>
      </WizardShell>

      {mako && <MakoChecklistModal title={task.title} detalle={task.detalle} onApply={(r) => setItems((c) => [...c, ...r.items.map((t) => ({ id: uid(), text: t, done: false }))])} onClose={() => setMako(false)} />}
    </>
  );
}
