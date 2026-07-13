'use client';

// DebateModal — cambiar la prioridad de una tarea con el Perro Guardián.
// Flujo (feedback): intro → ¿a cuánto la llevás? (target score) → ¿por qué? (razones
// según la DIRECCIÓN sube/baja) → confirmación SÍ/NO contra tareas CERCANAS al nuevo
// score (o, si "desbloquea", elegir cuál desbloquea) → ¿por qué? → el perro decide.
// Si el usuario dice "No", NO se manda a MaKo: sale un mensaje de CONSOLACIÓN
// personalizado que lo alienta a terminar sus prioridades. El perro NO es complaciente.

import { useState, useMemo, type CSSProperties } from 'react';
import { WizardShell } from '../../leads/WizardShell';
import { GuardianIcon } from './GuardianIcon';
import { ScoreIcon, textareaStyle } from './guardian-form';
import { type BoardTask, prioFromScore, PLABEL, PCOLOR, scoreFromPrio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type OtraTarea = { id: string; title: string; score: number; projName?: string; projColor?: string; projEmoji?: string; projId?: string };
type RazonKey = 'urgente' | 'desbloquea' | 'ingresos' | 'ya_no_urge' | 'no_depende' | 'superada' | 'error';

const RAZONES_SUBE: Array<{ key: RazonKey; label: string }> = [
  { key: 'urgente', label: 'Es más urgente de lo que parece' },
  { key: 'desbloquea', label: 'Desbloquea (o frena) otras cosas' },
  { key: 'ingresos', label: 'Impacta más en ingresos de lo que se ve' },
];
const RAZONES_BAJA: Array<{ key: RazonKey; label: string }> = [
  { key: 'ya_no_urge', label: 'Ya no es tan urgente' },
  { key: 'no_depende', label: 'Ya no depende nada de esto' },
  { key: 'superada', label: 'Otra tarea la superó en impacto' },
  { key: 'error', label: 'Me equivoqué al priorizarla' },
];
// Mensaje de consolación (empático, sin gastar tokens) cuando el usuario se echa atrás.
const CONSUELO: Record<RazonKey, string> = {
  urgente: 'Te entiendo — con la cabeza llena, todo se siente urgente. Pero urgente no es lo mismo que importante. La dejo donde está: cerrar tu top de hoy mueve más la aguja que sumar una tarea más. Si de verdad prende fuego, va a volver a aparecer sola.',
  ingresos: 'Es sano reconocer que no mueve tanto los ingresos como parecía. La dejo donde está. Poné la energía en las que sí facturan — cerrar esas es lo que te cambia el mes.',
  desbloquea: 'La dejo donde está. Enfocate en terminar lo que ya tenés arriba.',
  ya_no_urge: 'Si dudaste en bajarla, es porque todavía te importa. La dejo donde está — mejor mantener el foco que dispersarlo reordenando el plan.',
  no_depende: 'Bien pensado. Si algo todavía puede depender de esto, no conviene enterrarla. Queda donde está; vos seguí con tu top.',
  superada: 'Perfecto. No hace falta bajarla a mano: si otra la supera de verdad, yo la reacomodo solo. Vos ejecutá.',
  error: 'Tranqui, no hay error que arreglar a mano ahora. La dejo como está y reacomodo el plan solo cuando corresponda. Cerrar tareas pesa más que reordenarlas.',
};

async function debate(body: Record<string, unknown>): Promise<{ ok: boolean; veredicto?: string; score?: number; razon?: string; respuesta?: string; usage?: unknown; error?: string }> {
  return fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir', ...body }) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

export function DebateModal({ task, planResumen, otras, onApply, onUsage, onClose }: {
  task: BoardTask; planResumen: string; otras: OtraTarea[];
  onApply: (score: number, razon: string) => void; onUsage?: (u: unknown) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [newScore, setNewScore] = useState(task.score);
  const [razon, setRazon] = useState<RazonKey | ''>('');
  const [siNo, setSiNo] = useState<boolean | null>(null);
  const [desbloquea, setDesbloquea] = useState('');
  const [porque, setPorque] = useState('');
  const [fase, setFase] = useState<'form' | 'consolacion' | 'puntuando' | 'veredicto'>('form');
  const [ver, setVer] = useState<{ veredicto: string; score: number; razon: string; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  const sube = newScore > task.score;
  const razones = sube ? RAZONES_SUBE : RAZONES_BAJA;
  const newPrio = prioFromScore(newScore);
  // #2: comparar contra las tareas MÁS CERCANAS al nuevo score (no siempre las más altas).
  const comparacion = useMemo(() => otras.slice().sort((a, b) => Math.abs(a.score - newScore) - Math.abs(b.score - newScore)).slice(0, 3), [otras, newScore]);

  const buildArgumento = (): string => {
    const meta = razones.find((r) => r.key === razon);
    const dir = sube ? 'SUBIRLA' : 'BAJARLA';
    let ctx = '';
    if (razon === 'desbloquea') ctx = `Dice que desbloquea o frena: "${desbloquea.trim()}".`;
    else {
      const lista = comparacion.map((t) => `"${t.title}" (score ${t.score})`).join('; ') || '(no hay otras cerca)';
      ctx = sube ? `Confirma que le gana a las tareas cercanas: ${lista}.` : `Confirma que estas deberían quedar por encima: ${lista}.`;
    }
    return `El usuario quiere ${dir} de ${task.score} a ${newScore} (${PLABEL[newPrio]}). Razón: ${meta?.label ?? ''}. ${ctx} Motivo: ${porque.trim()}`;
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
  const decirNo = () => { setSiNo(false); setFase('consolacion'); };

  // ── consolación (el usuario se echó atrás) — sin IA, sin tokens ──
  if (fase === 'consolacion') {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '30px 26px 10px', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto', borderRadius: '50%', background: 'linear-gradient(135deg, var(--good) , var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(30,158,87,.28)' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.2 4.2L19 6.5" /></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em', margin: '16px 0 6px' }}>¡Ese es el foco! 💪</div>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', marginBottom: 14 }}>Decidís con cabeza, no con ansiedad. Así se gana.</div>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, textAlign: 'left', background: 'var(--good-bg, var(--surface-2))', border: '1px solid var(--good)55', borderRadius: 12, padding: '14px 16px' }}>{razon ? CONSUELO[razon] : 'La dejo donde está. Seguí con tus prioridades.'}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button type="button" onClick={() => { setSiNo(null); setFase('form'); setIdx(3); }} style={ghostBtn}>← Volver</button>
          <button type="button" onClick={onClose} style={primaryBtn}>Seguir con mis prioridades →</button>
        </div>
      </Shell>
    );
  }

  // ── veredicto / puntuando ──
  if (fase === 'puntuando' || fase === 'veredicto') {
    const prioNueva = ver ? prioFromScore(ver.score) : newPrio;
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={() => { setVer(null); setFase('form'); setIdx(1); }} style={ghostBtn}>← Volver a intentar</button>
            <button type="button" onClick={aceptar} style={primaryBtn}>Aceptar veredicto →</button>
          </div>
        )}
      </Shell>
    );
  }

  // ── formulario ──
  const prioAct = prioFromScore(task.score);
  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿A cuánto la llevarías?', sube ? '¿Por qué la subís?' : newScore < task.score ? '¿Por qué la bajás?' : 'Movela primero', razon === 'desbloquea' ? '¿Qué tarea desbloquea o frena?' : sube ? '¿En serio le gana a estas?' : '¿En serio estas deberían quedar por encima?', '¿Por qué? Contame tu razón'];
  const subs: (string | undefined)[] = [
    undefined,
    `Hoy la puse en ${task.score} (${PLABEL[prioAct]}). Movés el número y yo lo evalúo.`,
    'Elegí una razón. Sin excusas: con criterio.',
    razon === 'desbloquea' ? 'Buscá o filtrá por proyecto. También podés escribir una a mano.' : 'Son las tareas más cercanas a ese puntaje.',
    'Con datos, no "me parece". Yo decido.',
  ];
  const puedeAvanzar = idx === 0 ? true
    : idx === 1 ? newScore !== task.score
      : idx === 2 ? razon !== ''
        : idx === 3 ? (razon === 'desbloquea' ? desbloquea.trim() !== '' : siNo === true)
          : porque.trim() !== '';

  return (
    <WizardShell
      titulo={`Cambiar prioridad · ${task.title.slice(0, 34)}`}
      total={5} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 4} confirmLabel="Que el Guardián decida →"
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
      {idx === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 34, fontWeight: 800, color: PCOLOR[newPrio] }}><ScoreIcon size={30} color={PCOLOR[newPrio]} />{newScore}</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: PCOLOR[newPrio], textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{PLABEL[newPrio]}{newScore === task.score ? ' · sin cambios' : sube ? ' · más arriba' : ' · más abajo'}</div>
          </div>
          <input type="range" min={1} max={100} step={1} value={newScore} onChange={(e) => setNewScore(Number(e.target.value))} style={{ width: '100%', accentColor: PCOLOR[newPrio] }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {(['alta', 'media', 'baja', 'futuro'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setNewScore(scoreFromPrio[p])} style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: `1px solid ${newPrio === p ? PCOLOR[p] : 'var(--border-strong)'}`, background: newPrio === p ? PCOLOR[p] + '14' : 'var(--surface)', color: newPrio === p ? PCOLOR[p] : 'var(--dim)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{PLABEL[p]}</button>
            ))}
          </div>
        </div>
      )}
      {idx === 2 && <RadioList opciones={razones} value={razon} onChange={(k) => { setRazon(k as RazonKey); setSiNo(null); }} />}
      {idx === 3 && (razon === 'desbloquea'
        ? <DesbloqueaBody otras={otras} value={desbloquea} onChange={setDesbloquea} />
        : <SiNoBody comparacion={comparacion} value={siNo} sube={sube} onSi={() => setSiNo(true)} onNo={decirNo} />)}
      {idx === 4 && <textarea value={porque} onChange={(e) => setPorque(e.target.value)} autoFocus placeholder="Ej: la campaña arranca el lunes y sin esto no factura…" style={{ ...textareaStyle }} />}
    </WizardShell>
  );
}

// Lista single-select SIN caja libre.
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

// SÍ / NO contra las tareas cercanas. "No" dispara la consolación (no manda a MaKo).
function SiNoBody({ comparacion, value, sube, onSi, onNo }: { comparacion: OtraTarea[]; value: boolean | null; sube: boolean; onSi: () => void; onNo: () => void }) {
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {comparacion.length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic' }}>No hay otras tareas para comparar.</div>}
        {comparacion.map((t) => {
          const c = PCOLOR[prioFromScore(t.score)];
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 11px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: c }}><ScoreIcon size={11} color={c} />{t.score}</span>
              {t.projName && <span style={{ fontSize: 10.5, fontWeight: 700, color: t.projColor, background: (t.projColor || '#999') + '1f', border: `1px solid ${(t.projColor || '#999')}44`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{t.projEmoji} {t.projName}</span>}
              <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onSi} style={{ flex: 1, padding: '12px 10px', borderRadius: 11, border: `1.5px solid ${value === true ? 'var(--primary)' : 'var(--border-strong)'}`, background: value === true ? 'var(--primary-bg)' : 'var(--surface)', color: value === true ? 'var(--primary)' : 'var(--ink)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{sube ? 'Sí, le gana a todas' : 'Sí, está bien'}</button>
        <button type="button" onClick={onNo} style={{ flex: 1, padding: '12px 10px', borderRadius: 11, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>No, ahora que lo veo…</button>
      </div>
    </div>
  );
}

// ¿Qué tarea desbloquea? — search + filtro por proyecto (DESPLEGABLE a la derecha del
// search); lista scrolleable; "Otra (a mano)" FIJA abajo del todo, fuera del scroll (#18).
function DesbloqueaBody({ otras, value, onChange }: { otras: OtraTarea[]; value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState('');
  const [proj, setProj] = useState<string>('');
  const [openF, setOpenF] = useState(false);
  const proyectos = useMemo(() => {
    const m = new Map<string, { name: string; color: string; emoji: string }>();
    otras.forEach((t) => { if (t.projId && !m.has(t.projId)) m.set(t.projId, { name: t.projName || '', color: t.projColor || '#999', emoji: t.projEmoji || '' }); });
    return [...m.entries()];
  }, [otras]);
  const filtradas = otras.filter((t) => (!proj || t.projId === proj) && (!q || t.title.toLowerCase().includes(q.toLowerCase())));
  const enLista = otras.some((t) => t.title === value);
  const projSel = proyectos.find(([id]) => id === proj)?.[1];
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* search + filtro desplegable a la derecha */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarea…" style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS }} />
        {proyectos.length > 1 && (
          <div style={{ position: 'relative', flex: 'none' }}>
            <button type="button" onClick={() => setOpenF((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%', padding: '0 12px', borderRadius: 10, border: `1px solid ${proj ? 'var(--primary)' : 'var(--border-strong)'}`, background: proj ? 'var(--primary-bg)' : 'var(--surface)', color: proj ? 'var(--primary)' : 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: SANS, whiteSpace: 'nowrap' }}>
              {projSel ? `${projSel.emoji} ${projSel.name}` : 'Proyecto'} ▾
            </button>
            {openF && <>
              <span onClick={() => setOpenF(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
              <div style={{ position: 'absolute', top: '105%', right: 0, zIndex: 151, minWidth: 180, maxHeight: 220, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, boxShadow: '0 16px 40px rgba(18,21,27,.2)', padding: 6 }}>
                <button type="button" onClick={() => { setProj(''); setOpenF(false); }} style={ddItem(proj === '')}>Todos los proyectos</button>
                {proyectos.map(([id, p]) => <button key={id} type="button" onClick={() => { setProj(id); setOpenF(false); }} style={ddItem(proj === id)}>{p.emoji} {p.name}</button>)}
              </div>
            </>}
          </div>
        )}
      </div>
      {/* lista scrolleable */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
        {filtradas.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)', fontStyle: 'italic', padding: '6px 2px' }}>Nada con ese filtro. Escribila a mano abajo.</div>}
        {filtradas.map((t) => {
          const on = value === t.title;
          const col = t.projColor || 'var(--border-strong)';
          return (
            <button key={t.id} type="button" onClick={() => onChange(on ? '' : t.title)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 10, border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`, borderLeft: `3px solid ${col}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, cursor: 'pointer', fontFamily: SANS }}>
              {t.projEmoji && <span style={{ fontSize: 13 }}>{t.projEmoji}</span>}
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              {on && <span style={{ color: 'var(--primary)', fontWeight: 800 }}>✓</span>}
            </button>
          );
        })}
      </div>
      {/* "Otra (a mano)" FIJA abajo, fuera del scroll */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <input value={!enLista ? value : ''} onChange={(e) => onChange(e.target.value)} placeholder="✎ Otra (no está en la lista)…" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${!enLista && value ? 'var(--primary)' : 'var(--border-strong)'}`, background: !enLista && value ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS }} />
      </div>
    </div>
  );
}
const ddItem = (on: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: on ? 'var(--primary-bg)' : 'transparent', color: 'var(--ink)', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: SANS });

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
