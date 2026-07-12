'use client';

// DebateModal — debatir la prioridad de una tarea con el Perro Guardián, en un
// form de a 1 pregunta (WizardShell): intro → tu argumento (multiple-choice +
// custom) → veredicto. MaKo decide el score (tiene la última palabra).

import { useState, type CSSProperties } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { IntroBody, ChoiceBody } from './guardian-form';
import { GuardianIcon } from './GuardianIcon';
import { type BoardTask, prioFromScore, PLABEL, PCOLOR } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const OPCIONES = [
  'Es más urgente de lo que parece',
  'Desbloquea (o frena) otras cosas',
  'Tiene más impacto en ingresos de lo que se ve',
  'En realidad es MENOS prioritaria',
];

async function debate(body: Record<string, unknown>): Promise<{ ok: boolean; score?: number; razon?: string; respuesta?: string; error?: string }> {
  return fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', ...body }) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

export function DebateModal({ task, planResumen, onApply, onClose }: {
  task: BoardTask; planResumen: string;
  onApply: (score: number, razon: string) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [arg, setArg] = useState('');
  const [fase, setFase] = useState<'form' | 'puntuando' | 'veredicto'>('form');
  const [ver, setVer] = useState<{ score: number; razon: string; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  const enviar = async () => {
    setFase('puntuando'); setErr('');
    const tarea = `${task.title}${task.detalle ? `\n\n${task.detalle}` : ''}`;
    const j = await debate({ tarea, scoreActual: task.score, argumento: arg.trim(), plan: planResumen });
    if (j.ok && typeof j.score === 'number') { setVer({ score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '' }); setFase('veredicto'); }
    else { setErr(j.error || 'MaKo no pudo responder ahora.'); setFase('form'); }
  };
  const aceptar = () => { if (ver) onApply(ver.score, ver.razon); onClose(); };

  // ── veredicto (o puntuando) — pantalla propia, fuera del WizardShell ──
  if (fase !== 'form') {
    const prioNueva = ver ? prioFromScore(ver.score) : prioFromScore(task.score);
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '26px 26px 8px', textAlign: 'center' }}>
          {fase === 'puntuando'
            ? <div style={{ padding: '30px 0', color: 'var(--dim)', fontSize: 14 }}>El Perro Guardián está evaluando tu argumento…</div>
            : ver && <>
                <GuardianIcon size={52} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '14px 0 12px' }}>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: PCOLOR[prioFromScore(task.score)] }}>⚡{task.score}</span>
                  <span style={{ color: 'var(--faint)' }}>→</span>
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, color: PCOLOR[prioNueva] }}>⚡{ver.score} · {PLABEL[prioNueva]}</span>
                  {ver.score === task.score && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>(sin cambios)</span>}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, textAlign: 'left', background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)', borderRadius: 12, padding: '13px 15px' }}>{ver.respuesta}</div>
              </>}
        </div>
        {fase === 'veredicto' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={() => { setVer(null); setArg(''); setIdx(1); setFase('form'); }} style={ghostBtn}>Insistir</button>
            <button type="button" onClick={aceptar} style={primaryBtn}>Aceptar veredicto</button>
          </div>
        )}
      </Shell>
    );
  }

  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿Por qué debería cambiar de prioridad?'];
  const subs = [undefined, `Hoy está en ${PLABEL[prioFromScore(task.score)]} (score ${task.score}). Elegí o escribí tu argumento.`];
  return (
    <WizardShell
      titulo={`Debatir · ${task.title.slice(0, 40)}`}
      total={2} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={idx === 0 ? true : arg.trim() !== ''}
      enUltimo={idx === 1} confirmLabel="Que el Guardián decida →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'} error={err}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(0))}
      onSiguiente={() => setIdx(1)}
      onConfirmar={enviar}
    >
      {idx === 0
        ? <IntroBody que={`cambiar la prioridad de "${task.title.slice(0, 50)}"`} mi="proteger tu foco: decidir qué de verdad mueve la aguja" />
        : <ChoiceBody opciones={OPCIONES} value={arg} onChange={setArg} customPlaceholder="Otra… contame tu argumento con datos" />}
    </WizardShell>
  );
}

// Contenedor simple (mismo look que WizardShell) para la pantalla de veredicto.
function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
