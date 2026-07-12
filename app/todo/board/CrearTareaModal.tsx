'use client';

// CrearTareaModal — crear una tarea con el Perro Guardián, de a 1 pregunta
// (WizardShell): intro → título → detalle → ¿por qué importa? (multiple-choice) →
// MaKo la puntúa y decide su columna. El usuario no elige la prioridad.

import { useState, type CSSProperties } from 'react';
import { WizardShell, wizardInput } from '../../leads/WizardShell';
import { IntroBody, ChoiceBody, textareaStyle } from './guardian-form';
import { GuardianIcon } from './GuardianIcon';
import { type Prio, PLABEL, PCOLOR } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type CrearResult = { score: number; prio: Prio; razon: string; respuesta: string } | null;

const OPCIONES = [
  'Es urgente / bloquea algo',
  'Impacta directo en los ingresos',
  'Mejora la conversión o el funnel',
  'Es un quick win (poco esfuerzo, buen retorno)',
  'Es a futuro / nice to have',
];

export function CrearTareaModal({ onCrear, onClose }: {
  onCrear: (title: string, detalle: string, argumento: string) => Promise<CrearResult>;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [detalle, setDetalle] = useState('');
  const [arg, setArg] = useState('');
  const [fase, setFase] = useState<'form' | 'puntuando' | 'veredicto'>('form');
  const [res, setRes] = useState<CrearResult>(null);

  const crear = async () => {
    setFase('puntuando');
    const r = await onCrear(title.trim(), detalle.trim(), arg.trim());
    setRes(r); setFase('veredicto');
  };

  if (fase !== 'form') {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '26px 26px 8px', textAlign: 'center' }}>
          {fase === 'puntuando'
            ? <div style={{ padding: '30px 0', color: 'var(--dim)', fontSize: 14 }}>El Perro Guardián está priorizando la tarea…</div>
            : res && <>
                <GuardianIcon size={52} />
                <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', margin: '12px 0 10px' }}>{title}</div>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, color: PCOLOR[res.prio], marginBottom: 12 }}>⚡{res.score} · {PLABEL[res.prio]}</div>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, textAlign: 'left', background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)', borderRadius: 12, padding: '13px 15px' }}>{res.respuesta}</div>
              </>}
        </div>
        {fase === 'veredicto' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={onClose} style={primaryBtn}>Listo</button>
          </div>
        )}
      </Shell>
    );
  }

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿Qué hay que hacer?', 'Contame un poco más (opcional)', '¿Por qué importa?'];
  const subs = [undefined, undefined, 'Detalle, contexto, criterio de "listo". Podés saltearlo.', 'Con esto decido a qué columna va. Elegí o escribí.'];
  const puedeAvanzar = idx === 1 ? title.trim() !== '' : idx === 3 ? arg.trim() !== '' : true;
  return (
    <WizardShell
      titulo="Nueva tarea"
      total={4} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 3} confirmLabel="Crear · que la priorice →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={crear}
    >
      {idx === 0 && <IntroBody que="crear una tarea nueva" />}
      {idx === 1 && <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) setIdx(2); }} autoFocus placeholder="Escribí la tarea…" style={{ ...wizardInput }} />}
      {idx === 2 && <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} autoFocus placeholder="Contexto, alcance…" style={{ ...textareaStyle }} />}
      {idx === 3 && <ChoiceBody opciones={OPCIONES} value={arg} onChange={setArg} customPlaceholder="Otra… (por qué te parece importante)" />}
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
