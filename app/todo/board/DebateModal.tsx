'use client';

// DebateModal — debatir la prioridad de una tarea con el Perro Guardián.
// Formulario ENCADENADO (feedback #8): intro (con el razonamiento actual del perro)
// → Q1 ¿por qué cambiar? (multiple-choice, SIN opción abierta) → Q2 que DEPENDE de Q1
// (SÍ/NO contra el top de tareas que quedarían debajo, o ¿qué desbloquea?) → Q3 ¿por
// qué? El perro NO es complaciente: puede ACEPTAR, AJUSTAR o RECHAZAR (feedback #9).

import { useState, type CSSProperties } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { GuardianIcon } from './GuardianIcon';
import { ScoreIcon, textareaStyle } from './guardian-form';
import { type BoardTask, prioFromScore, PLABEL, PCOLOR } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type OtraTarea = { id: string; title: string; score: number };
type RazonKey = 'urgente' | 'desbloquea' | 'ingresos' | 'menos';
const RAZONES: Array<{ key: RazonKey; label: string; dir: 'sube' | 'baja' }> = [
  { key: 'urgente', label: 'Es más urgente de lo que parece', dir: 'sube' },
  { key: 'desbloquea', label: 'Desbloquea (o frena) otras cosas', dir: 'sube' },
  { key: 'ingresos', label: 'Tiene más impacto en ingresos de lo que se ve', dir: 'sube' },
  { key: 'menos', label: 'En realidad es MENOS prioritaria', dir: 'baja' },
];

async function debate(body: Record<string, unknown>): Promise<{ ok: boolean; veredicto?: string; score?: number; razon?: string; respuesta?: string; usage?: unknown; error?: string }> {
  return fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', ...body }) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

export function DebateModal({ task, planResumen, otras, onApply, onUsage, onClose }: {
  task: BoardTask; planResumen: string; otras: OtraTarea[];
  onApply: (score: number, razon: string) => void; onUsage?: (u: unknown) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [razon, setRazon] = useState<RazonKey | ''>('');
  const [siNo, setSiNo] = useState<boolean | null>(null);   // Q2 para urgente/ingresos/menos
  const [desbloquea, setDesbloquea] = useState('');          // Q2 para "desbloquea"
  const [porque, setPorque] = useState('');                  // Q3
  const [fase, setFase] = useState<'form' | 'puntuando' | 'veredicto'>('form');
  const [ver, setVer] = useState<{ veredicto: string; score: number; razon: string; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  const razonMeta = RAZONES.find((r) => r.key === razon) ?? null;
  // Las tareas que quedarían por debajo (sube) o por encima (baja) de esta.
  const ordenadas = otras.slice().sort((a, b) => b.score - a.score);
  const comparacion = razonMeta?.dir === 'baja'
    ? (ordenadas.filter((t) => t.score <= task.score).slice(0, 3).length ? ordenadas.filter((t) => t.score <= task.score).slice(0, 3) : ordenadas.slice(-3))
    : (ordenadas.filter((t) => t.score >= task.score).slice(0, 3).length ? ordenadas.filter((t) => t.score >= task.score).slice(0, 3) : ordenadas.slice(0, 3));

  const buildArgumento = (): string => {
    if (!razonMeta) return porque.trim();
    let ctx = '';
    if (razon === 'desbloquea') {
      ctx = `Según el usuario, esta tarea desbloquea o frena: "${desbloquea.trim()}".`;
    } else {
      const lista = comparacion.map((t) => `"${t.title}" (score ${t.score})`).join('; ') || '(no hay otras tareas)';
      const verbo = razon === 'ingresos' ? 'impacta más en ingresos' : razon === 'menos' ? 'es MENOS prioritaria' : 'es más urgente';
      ctx = siNo
        ? `El usuario AFIRMA que ${verbo} que: ${lista}.`
        : `El usuario ADMITE que NO está seguro de que ${verbo} que: ${lista} (respondió que NO al compararla).`;
    }
    return `${razonMeta.label}. ${ctx} Motivo del usuario: ${porque.trim()}`;
  };

  const enviar = async () => {
    setFase('puntuando'); setErr('');
    const tarea = `${task.title}${task.detalle ? `\n\n${task.detalle}` : ''}`;
    const j = await debate({ tarea, scoreActual: task.score, argumento: buildArgumento(), plan: planResumen });
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && typeof j.score === 'number') { setVer({ veredicto: String(j.veredicto ?? 'ajusta'), score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '' }); setFase('veredicto'); }
    else { setErr(j.error || 'MaKo no pudo responder ahora.'); setFase('form'); }
  };
  const aceptar = () => { if (ver) onApply(ver.score, ver.razon); onClose(); };

  // ── veredicto (o puntuando) — pantalla propia ──
  if (fase !== 'form') {
    const prioNueva = ver ? prioFromScore(ver.score) : prioFromScore(task.score);
    const vk = ver?.veredicto ?? '';
    const vMeta = vk === 'acepta' ? { txt: 'El Perro Guardián te dio la razón', c: 'var(--good)', bg: 'var(--good-bg)' }
      : vk === 'rechaza' ? { txt: 'El Perro Guardián RECHAZÓ tu pedido', c: 'var(--bad)', bg: 'var(--bad-bg)' }
        : { txt: 'El Perro Guardián lo ajustó', c: 'var(--warn)', bg: 'var(--surface-2)' };
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '26px 26px 8px', textAlign: 'center' }}>
          {fase === 'puntuando'
            ? <div style={{ padding: '30px 0', color: 'var(--dim)', fontSize: 14 }}>El Perro Guardián está evaluando tu argumento…</div>
            : ver && <>
                <GuardianIcon size={56} />
                <div style={{ fontSize: 13, fontWeight: 800, color: vMeta.c, textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 10px' }}>{vMeta.txt}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontWeight: 700, fontSize: 13, color: PCOLOR[prioFromScore(task.score)] }}><ScoreIcon size={13} color={PCOLOR[prioFromScore(task.score)]} />{task.score}</span>
                  <span style={{ color: 'var(--faint)' }}>→</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontWeight: 700, fontSize: 17, color: PCOLOR[prioNueva] }}><ScoreIcon size={16} color={PCOLOR[prioNueva]} />{ver.score} · {PLABEL[prioNueva]}</span>
                  {ver.score === task.score && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>(sin cambios)</span>}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, textAlign: 'left', background: vMeta.bg, border: `1px solid ${vMeta.c}55`, borderRadius: 12, padding: '13px 15px' }}>{ver.respuesta}</div>
              </>}
        </div>
        {fase === 'veredicto' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={() => { setVer(null); setSiNo(null); setDesbloquea(''); setPorque(''); setRazon(''); setIdx(1); setFase('form'); }} style={ghostBtn}>Volver a intentar</button>
            <button type="button" onClick={aceptar} style={primaryBtn}>Aceptar veredicto</button>
          </div>
        )}
      </Shell>
    );
  }

  // ── formulario encadenado (4 pasos) ──
  const prioAct = prioFromScore(task.score);
  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿Por qué debería cambiar de prioridad?', segundaPregunta(razon), '¿Por qué? Contame tu razón'];
  const subs: (string | undefined)[] = [
    undefined,
    `Hoy está en ${PLABEL[prioAct]} (score ${task.score}). Elegí una razón.`,
    razon === 'desbloquea' ? 'Elegí la tarea que desbloquea, o escribí cuál.' : 'Subir esta tarea significa bajar otra. Sé honesto.',
    'Con datos, no “me parece”. El perro decide.',
  ];
  const puedeAvanzar = idx === 0 ? true
    : idx === 1 ? razon !== ''
      : idx === 2 ? (razon === 'desbloquea' ? desbloquea.trim() !== '' : siNo !== null)
        : porque.trim() !== '';

  return (
    <WizardShell
      titulo={`Debatir · ${task.title.slice(0, 40)}`}
      total={4} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 3} confirmLabel="Que el Guardián decida →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'} error={err}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={enviar}
    >
      {idx === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <GuardianIcon size={64} />
          <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.6, margin: 0, maxWidth: 430 }}>
            Mi trabajo es <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>proteger tu foco: decidir qué de verdad mueve la aguja</strong>. No soy complaciente: si tu argumento no se sostiene, te lo voy a decir.
          </p>
          <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 16px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: task.scoreRazon ? 7 : 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Hoy la puse en</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: PCOLOR[prioAct] }}>{PLABEL[prioAct].toUpperCase()}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: PCOLOR[prioAct] }}><ScoreIcon size={13} color={PCOLOR[prioAct]} />{task.score}</span>
            </div>
            {task.scoreRazon && <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, fontStyle: 'italic' }}>“{task.scoreRazon}”</div>}
          </div>
        </div>
      )}
      {idx === 1 && <RadioList opciones={RAZONES.map((r) => ({ key: r.key, label: r.label }))} value={razon} onChange={(k) => { setRazon(k as RazonKey); setSiNo(null); }} />}
      {idx === 2 && (razon === 'desbloquea'
        ? <DesbloqueaBody otras={ordenadas} value={desbloquea} onChange={setDesbloquea} />
        : <SiNoBody comparacion={comparacion} value={siNo} onChange={setSiNo} baja={razonMeta?.dir === 'baja'} />)}
      {idx === 3 && <textarea value={porque} onChange={(e) => setPorque(e.target.value)} autoFocus placeholder="Ej: la campaña arranca el lunes y sin esto no factura…" style={{ ...textareaStyle }} />}
    </WizardShell>
  );
}

function segundaPregunta(razon: RazonKey | ''): string {
  switch (razon) {
    case 'urgente': return '¿En serio es más urgente que estas?';
    case 'ingresos': return '¿En serio va a mover más ingresos que estas?';
    case 'menos': return '¿En serio es MENOS prioritaria que estas?';
    case 'desbloquea': return '¿Qué tarea desbloquea o frena?';
    default: return '';
  }
}

// Lista de opciones single-select SIN caja de texto libre (feedback #8: sacar la abierta en la 1ª).
function RadioList({ opciones, value, onChange }: { opciones: Array<{ key: string; label: string }>; value: string; onChange: (k: string) => void }) {
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {opciones.map((o) => {
        const on = value === o.key;
        return (
          <button key={o.key} type="button" onClick={() => onChange(on ? '' : o.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2.5px var(--surface)' : 'none' }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// SÍ / NO contra el top de tareas que quedarían debajo (o encima si baja).
function SiNoBody({ comparacion, value, onChange, baja }: { comparacion: OtraTarea[]; value: boolean | null; onChange: (v: boolean) => void; baja?: boolean }) {
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {comparacion.length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic' }}>No hay otras tareas activas para comparar.</div>}
        {comparacion.map((t) => {
          const c = PCOLOR[prioFromScore(t.score)];
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 11px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: c }}><ScoreIcon size={11} color={c} />{t.score}</span>
              <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)' }}>{t.title}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[{ v: true, l: baja ? 'Sí, son más importantes' : 'Sí, le gana a todas' }, { v: false, l: 'No, ahora que lo veo…' }].map((b) => {
          const on = value === b.v;
          return (
            <button key={String(b.v)} type="button" onClick={() => onChange(b.v)}
              style={{ flex: 1, padding: '12px 10px', borderRadius: 11, border: `1.5px solid ${on ? (b.v ? 'var(--primary)' : 'var(--warn)') : 'var(--border-strong)'}`, background: on ? (b.v ? 'var(--primary-bg)' : 'var(--surface-2)') : 'var(--surface)', color: on ? (b.v ? 'var(--primary)' : 'var(--warn)') : 'var(--ink)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{b.l}</button>
          );
        })}
      </div>
    </div>
  );
}

// ¿Qué tarea desbloquea? — elegir de la lista o escribir a mano.
function DesbloqueaBody({ otras, value, onChange }: { otras: OtraTarea[]; value: string; onChange: (v: string) => void }) {
  const enLista = otras.some((t) => t.title === value);
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
      {otras.map((t) => {
        const on = value === t.title;
        return (
          <button key={t.id} type="button" onClick={() => onChange(on ? '' : t.title)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '10px 13px', borderRadius: 10, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, cursor: 'pointer', fontFamily: SANS }}>
            <span style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2.5px var(--surface)' : 'none' }} />
            {t.title}
          </button>
        );
      })}
      <input value={!enLista ? value : ''} onChange={(e) => onChange(e.target.value)} placeholder="Otra (no está en la lista)…"
        style={{ width: '100%', padding: '11px 14px', borderRadius: 11, border: `1px solid ${!enLista && value ? 'var(--primary)' : 'var(--border-strong)'}`, background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, outline: 'none', fontFamily: SANS, marginTop: 2 }} />
    </div>
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
