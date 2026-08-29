'use client';

// =============================================================================
// FechaDebateModal — discutirle la FECHA al Perro, igual que la prioridad
// =============================================================================
// El pedido: «que el Perro decida también los deadline, y que se pueda modificar
// como normalmente lo hacemos al cambiar de prioridad, que es debatiendo con él».
//
// Misma forma que el debate de prioridad y por la misma razón: si la fecha se moviera
// sola cada vez que alguien la pide, dejaría de ser un compromiso y sería un deseo con
// calendario. Acá el dueño dice QUÉ quiere y POR QUÉ, y el Perro contesta — puede
// aceptar, ajustar o rechazar.
//
// Las opciones son cerradas a propósito (la regla del producto: la IA facilita, no
// interroga). El campo abierto es uno solo y es opcional.

import { useState } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { GuardianIcon } from './GuardianIcon';
import { textareaStyle } from './guardian-form';
import type { BoardTask } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type OtraConFecha = { titulo: string; deadline: string; score: number };

/** Lo que se le puede pedir. Cerradas: el "por qué" es el único texto libre. */
const QUE: Array<{ k: string; label: string; sub: string }> = [
  { k: 'adelantar', label: 'Adelantarla', sub: 'la necesito antes de lo que dice' },
  { k: 'correr', label: 'Correrla', sub: 'no llego, o depende de otra cosa' },
  { k: 'poner', label: 'Ponerle fecha', sub: 'hoy no tiene y debería' },
  { k: 'sacar', label: 'Sacarle la fecha', sub: 'no hay ninguna razón para apurarla' },
];

/** Por qué. Son los argumentos que el Perro considera válidos (más "otro"). */
const PORQUE: Array<{ k: string; label: string }> = [
  { k: 'compromiso', label: 'Se lo prometí a alguien (cliente, socio, equipo)' },
  { k: 'evento', label: 'Hay un evento o vencimiento con fecha propia' },
  { k: 'depende', label: 'Depende de otra cosa que todavía no está' },
  { k: 'tamano', label: 'Resultó más grande / más chica de lo que parecía' },
  { k: 'ganas', label: 'La verdad, es que la quiero tener ya' },
];

const fmt = (iso: string): string => {
  if (!iso) return 'sin fecha';
  try { return new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
};

export function FechaDebateModal({ task, otras, onApply, onUsage, onClose }: {
  task: BoardTask;
  otras: OtraConFecha[];
  onApply: (deadline: string, razon: string) => void;
  onUsage?: (u: unknown) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [que, setQue] = useState('');
  const [cuando, setCuando] = useState('');
  const [porque, setPorque] = useState('');
  const [detalle, setDetalle] = useState('');
  const [fase, setFase] = useState<'form' | 'pensando' | 'veredicto'>('form');
  const [ver, setVer] = useState<{ veredicto: string; deadline: string; razon: string; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  const pideFecha = que === 'adelantar' || que === 'correr' || que === 'poner';
  const pasos = pideFecha ? 3 : 2;

  const mandar = async () => {
    setFase('pensando'); setErr('');
    const pedido = [
      QUE.find((q) => q.k === que)?.label ?? '',
      pideFecha && cuando ? `Fecha que pide: ${cuando}.` : que === 'sacar' ? 'Quiere dejarla SIN fecha.' : '',
      PORQUE.find((p) => p.k === porque)?.label ?? '',
      detalle.trim(),
    ].filter(Boolean).join(' · ');
    // Las otras con fecha van ordenadas: es como el Perro ve si esa semana ya está llena.
    const plan = otras.slice().sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 60)
      .map((o) => `${o.deadline} · [${o.score}] ${o.titulo}`).join('\n');
    try {
      const j = await fetch('/api/mako-guardian', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'debatir-fecha', tarea: `${task.title}${task.detalle ? `\n\n${task.detalle}` : ''}`, fechaActual: task.deadline, scoreActual: task.score, argumento: pedido, plan, uso: 'Debate de fecha' }),
      }).then((r) => r.json());
      if (j.usage) onUsage?.(j.usage);
      if (!j.ok) throw new Error(j.error || 'no pude');
      setVer({ veredicto: String(j.veredicto ?? ''), deadline: String(j.deadline ?? ''), razon: String(j.razon ?? ''), respuesta: String(j.respuesta ?? '') });
      setFase('veredicto');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setFase('form'); }
  };

  if (fase === 'pensando' || fase === 'veredicto') {
    const cambia = !!ver && ver.deadline !== task.deadline;
    const tono = !ver ? 'var(--dim)' : ver.veredicto === 'acepta' ? 'var(--good)' : ver.veredicto === 'ajusta' ? 'var(--warn)' : 'var(--bad)';
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '26px 24px', boxShadow: '0 30px 70px rgba(18,21,27,.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <GuardianIcon size={34} />
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO · LA FECHA</div>
          </div>
          {fase === 'pensando' ? (
            <div style={{ padding: '26px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>Está mirando el resto de las fechas…</div>
          ) : ver && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 15, color: 'var(--faint)', textDecoration: cambia ? 'line-through' : 'none' }}>{fmt(task.deadline)}</span>
                {cambia && <><span style={{ color: 'var(--faint)' }}>→</span><span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700, color: tono }}>{fmt(ver.deadline)}</span></>}
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: tono }}>{ver.veredicto}</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', margin: '0 0 10px' }}>{ver.respuesta}</p>
              {ver.razon && <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--faint)', fontStyle: 'italic', margin: '0 0 18px' }}>“{ver.razon}”</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, cursor: 'pointer', fontFamily: SANS }}>Cerrar</button>
                {cambia && (
                  <button type="button" onClick={() => { onApply(ver.deadline, ver.razon); onClose(); }}
                    style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>
                    Aplicar la fecha
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const preguntas = ['¿Qué quieres hacer con la fecha?', pideFecha ? '¿Para cuándo?' : '¿Por qué?', '¿Por qué?'];
  const subs = [
    `Hoy vence ${fmt(task.deadline)} · prioridad ${task.score}/100. La decide el Perro: tú dices qué quieres y por qué.`,
    pideFecha ? 'Elige el día. Después te va a pedir el motivo.' : 'El motivo es lo único que puede mover una fecha.',
    'Con esto decide. Un "la quiero ya" lo va a rechazar, y está bien que lo haga.',
  ];
  const puedeAvanzar = idx === 0 ? !!que : idx === 1 ? (pideFecha ? !!cuando : !!porque) : !!porque;
  const enUltimo = idx === pasos - 1;
  const opcionesPaso = idx === 0 ? QUE : (pideFecha ? [] : PORQUE);

  return (
    <WizardShell
      titulo={`#${task.num} · ${task.title.slice(0, 40)}`}
      total={pasos} idx={idx}
      pregunta={preguntas[pideFecha ? idx : idx === 1 ? 2 : idx]}
      sub={subs[pideFecha ? idx : idx === 1 ? 2 : idx]}
      error={err || null}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enUltimo} confirmLabel="Que decida →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={() => void mandar()}
      onClose={onClose}
    >
      {opcionesPaso.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {opcionesPaso.map((o) => {
            const sel = idx === 0 ? que === o.k : porque === o.k;
            const sub = 'sub' in o ? (o as { sub: string }).sub : '';
            return (
              <button key={o.k} type="button" onClick={() => { if (idx === 0) setQue(o.k); else setPorque(o.k); }}
                style={{ width: '100%', padding: '12px 15px', borderRadius: 12, textAlign: 'left', fontFamily: SANS, cursor: 'pointer', border: `1px solid ${sel ? 'var(--primary)' : 'var(--border-strong)'}`, background: sel ? 'var(--primary-bg)' : 'var(--surface-2)', color: sel ? 'var(--primary)' : 'var(--ink)' }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: sel ? 700 : 600 }}>{o.label}</span>
                {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{sub}</span>}
              </button>
            );
          })}
        </div>
      )}
      {idx === 1 && pideFecha && (
        <input type="date" value={cuando} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setCuando(e.target.value)} autoFocus
          style={{ width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', textAlign: 'center' }} />
      )}
      {enUltimo && (
        <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={3}
          placeholder="Opcional: el dato concreto (con quién te comprometiste, qué falta, qué día es el evento)…"
          style={{ ...textareaStyle, marginTop: opcionesPaso.length ? 12 : 0 }} />
      )}
    </WizardShell>
  );
}
