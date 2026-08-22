'use client';

// ProyectoDebateModal — cambiar la prioridad (1-10) de un PROYECTO pasa por el Perro
// Guardián, con la MISMA lógica que el debate de tareas: intro → ¿a cuánto? → ¿por
// qué la subís/bajás? → paso 4 que DEPENDE de la razón (si "habilita/desbloquea" o
// "lo cubre otro" → elegís CUÁLES proyectos; si no → SÍ/NO contra los cercanos) →
// ¿por qué? → el perro decide. Si dice "No", sale una consolación (0 tokens).

import { useMemo, useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { GuardianIcon } from './GuardianIcon';
import { ScoreIcon, textareaStyle } from './guardian-form';
import { type Label } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

type OtroProy = { id: string; name: string; emoji: string; color: string; score: number };
type RazonKey = 'mas_norte' | 'desbloquea' | 'ingresos' | 'ya_no_norte' | 'lo_cubre' | 'puede_esperar';
const RAZONES_SUBE: Array<{ key: RazonKey; label: string }> = [
  { key: 'mas_norte', label: 'Es más el norte del negocio de lo que parece' },
  { key: 'desbloquea', label: 'Habilita / desbloquea a otros proyectos' },
  { key: 'ingresos', label: 'Mueve más los ingresos de lo que se ve' },
];
const RAZONES_BAJA: Array<{ key: RazonKey; label: string }> = [
  { key: 'ya_no_norte', label: 'Ya no es el norte de ahora' },
  { key: 'lo_cubre', label: 'Lo cubre / lo absorbe otro proyecto' },
  { key: 'puede_esperar', label: 'Puede esperar' },
];
// Los que necesitan que elijas CUÁLES proyectos (no un SÍ/NO).
const PICK: Record<string, boolean> = { desbloquea: true, lo_cubre: true };
const CONSUELO: Record<RazonKey, string> = {
  mas_norte: 'Buen freno. Cambiar el norte cada dos por tres dispersa a todo el equipo. Lo dejo donde está y seguimos ejecutando el que ya es prioridad.',
  desbloquea: 'Si dudás en subirlo, quizá no desbloquea tanto todavía. Lo dejo donde está: mejor terminar de habilitar lo que ya está arriba.',
  ingresos: 'Sano reconocer que no mueve tanto los ingresos como parecía. Queda donde está; enfocá la energía en el que sí factura.',
  ya_no_norte: 'Si dudás en bajarlo, es porque todavía importa. Lo dejo donde está — mejor mantener el foco que reordenar el plan.',
  lo_cubre: 'Bien pensado. Si otro lo absorbe de verdad, fusionalos en vez de bajarlo; por ahora queda donde está.',
  puede_esperar: 'Perfecto, sin apuro. Lo dejo donde está y el perro lo reacomoda solo cuando corresponda.',
};

async function debate(body: Record<string, unknown>): Promise<{ ok: boolean; veredicto?: string; score?: number; razon?: string; respuesta?: string; usage?: unknown; error?: string }> {
  return fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'debatir-proyecto', ...body }) })
    .then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
}

export function ProyectoDebateModal({ proj, otros, onApply, onUsage, onClose }: {
  proj: Label; otros: OtroProy[];
  onApply: (score: number, razon: string) => void; onUsage?: (u: unknown) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [newScore, setNewScore] = useState(proj.score);
  const [razon, setRazon] = useState<RazonKey | ''>('');
  const [siNo, setSiNo] = useState<boolean | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]); // ids de proyectos (habilita / lo cubre)
  const [porque, setPorque] = useState('');
  const [fase, setFase] = useState<'form' | 'consolacion' | 'puntuando' | 'veredicto'>('form');
  const [ver, setVer] = useState<{ veredicto: string; score: number; razon: string; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  const sube = newScore > proj.score;
  const razones = sube ? RAZONES_SUBE : RAZONES_BAJA;
  const esPick = razon !== '' && !!PICK[razon];
  const comparacion = useMemo(() => otros.slice().sort((a, b) => Math.abs(a.score - newScore) - Math.abs(b.score - newScore)).slice(0, 3), [otros, newScore]);

  const buildArgumento = (): string => {
    const meta = razones.find((r) => r.key === razon);
    let ctx = '';
    if (esPick) {
      const names = elegidos.map((id) => otros.find((o) => o.id === id)).filter(Boolean).map((o) => `"${o!.name}"`).join(', ') || '(no eligió)';
      ctx = razon === 'desbloquea' ? `Dice que este proyecto habilita/desbloquea a: ${names}.` : `Dice que estos proyectos lo cubren o lo absorben: ${names}.`;
    } else {
      const lista = comparacion.map((p) => `"${p.name}" (prioridad ${p.score})`).join('; ') || '(no hay otros)';
      ctx = sube ? `Confirma que pesa más que: ${lista}.` : `Confirma que estos deberían quedar por encima: ${lista}.`;
    }
    return `El usuario quiere ${sube ? 'SUBIR' : 'BAJAR'} el proyecto de ${proj.score} a ${newScore} (de 10). Razón: ${meta?.label ?? ''}. ${ctx} Motivo: ${porque.trim()}`;
  };

  const enviar = async () => {
    setFase('puntuando'); setErr('');
    const proyecto = `${proj.emoji} ${proj.name}${proj.detalle ? `\n\n${proj.detalle}` : ''}`;
    const j = await debate({ proyecto, scoreActual: proj.score, argumento: buildArgumento(), plan: otros.map((p) => `- ${p.emoji} ${p.name} (prioridad ${p.score}/100)`).join('\n') || '(no hay otros)' });
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && typeof j.score === 'number') { setVer({ veredicto: String(j.veredicto ?? 'ajusta'), score: j.score, razon: j.razon ?? '', respuesta: j.respuesta ?? '' }); setFase('veredicto'); }
    else { setErr(j.error || 'MaKo no pudo responder ahora.'); setFase('form'); }
  };
  const aceptar = () => { if (ver) onApply(ver.score, ver.razon); onClose(); };
  const decirNo = () => { setSiNo(false); setFase('consolacion'); };
  const toggleElegido = (id: string) => setElegidos((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // ── consolación ──
  if (fase === 'consolacion') {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '30px 26px 10px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto', borderRadius: '50%', background: 'linear-gradient(135deg, var(--good) , var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(30,158,87,.28)' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.2 4.2L19 6.5" /></svg>
          </div>
          <div style={{ fontSize: 17.5, fontWeight: 800, color: 'var(--ink)', margin: '16px 0 6px' }}>¡Ese es el foco! 💪</div>
          <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, textAlign: 'left', background: 'var(--good-bg, var(--surface-2))', border: '1px solid var(--good)55', borderRadius: 12, padding: '14px 16px' }}>{razon ? CONSUELO[razon] : 'Lo dejo donde está. Seguí con tu norte.'}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button type="button" onClick={() => { setSiNo(null); setFase('form'); setIdx(3); }} style={ghostBtn}>← Volver</button>
          <button type="button" onClick={onClose} style={primaryBtn}>Seguir con mi plan →</button>
        </div>
      </Shell>
    );
  }

  // ── veredicto / puntuando ──
  if (fase === 'puntuando' || fase === 'veredicto') {
    const vk = ver?.veredicto ?? '';
    const vMeta = vk === 'acepta' ? { txt: 'El Perro Guardián te dio la razón', c: 'var(--good)', bg: 'var(--good-bg)' }
      : vk === 'rechaza' ? { txt: 'El Perro Guardián RECHAZÓ tu pedido', c: 'var(--bad)', bg: 'var(--bad-bg)' }
        : { txt: 'El Perro Guardián lo ajustó', c: 'var(--warn)', bg: 'var(--surface-2)' };
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '26px 26px 8px', textAlign: 'center' }}>
          {fase === 'puntuando'
            ? <div style={{ padding: '30px 0', color: 'var(--dim)', fontSize: 14 }}>El Perro Guardián está evaluando el proyecto…</div>
            : ver && <>
                <GuardianIcon size={56} />
                <div style={{ fontSize: 13, fontWeight: 800, color: vMeta.c, textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 10px' }}>{vMeta.txt}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontWeight: 700, fontSize: 13, color: proj.color }}><ScoreIcon size={13} color={proj.color} />{proj.score}</span>
                  <span style={{ color: 'var(--faint)' }}>→</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontWeight: 700, fontSize: 17, color: proj.color }}><ScoreIcon size={16} color={proj.color} />{ver.score}/100</span>
                  {ver.score === proj.score && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>(sin cambios)</span>}
                </div>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, textAlign: 'left', background: vMeta.bg, border: `1px solid ${vMeta.c}55`, borderRadius: 12, padding: '13px 15px' }}>{ver.respuesta}</div>
              </>}
        </div>
        {fase === 'veredicto' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={() => { setVer(null); setFase('form'); setIdx(1); }} style={ghostBtn}>← Volver a intentar</button>
            {/* Mismo criterio que en el debate de una tarea: el botón nombra lo que hace.
                «Aceptar veredicto» decía lo mismo cuando ganabas y cuando perdías. */}
            <button type="button" onClick={aceptar} style={primaryBtn}>
              {vk === 'rechaza' || ver?.score === proj.score
                ? `Dejarlo en ${proj.score} →`
                : `Aplicar ${proj.score} → ${ver?.score} →`}
            </button>
          </div>
        )}
      </Shell>
    );
  }

  // ── formulario ──
  const pregunta3 = razon === 'desbloquea' ? '¿A qué proyectos habilita?'
    : razon === 'lo_cubre' ? '¿Qué proyecto lo cubre?'
      : sube ? (razon === 'ingresos' ? '¿En serio mueve más los ingresos que estos?' : '¿En serio es más el norte que estos?')
        : '¿En serio estos deberían pesar más?';
  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿A cuánto la llevarías?', sube ? '¿Por qué la subís?' : newScore < proj.score ? '¿Por qué la bajás?' : 'Movela primero', pregunta3, '¿Por qué? Contame tu razón'];
  const subs: (string | undefined)[] = [undefined, `Hoy está en ${proj.score}/100. El más alto es el Objetivo Principal.`, 'Elegí una razón, con criterio.', esPick ? 'Elegí uno o más. Yo lo cruzo con el resto.' : 'Son los proyectos con prioridad más cercana.', 'Con datos, no "me gusta". Yo comparo y decido.'];
  const puedeAvanzar = idx === 0 ? true : idx === 1 ? newScore !== proj.score : idx === 2 ? razon !== '' : idx === 3 ? (esPick ? elegidos.length > 0 : siNo === true) : porque.trim() !== '';
  const siLabel = sube ? (razon === 'ingresos' ? 'Sí, mueve más' : 'Sí, es más el norte') : 'Sí, está bien';

  return (
    <WizardShell
      titulo={`Prioridad · ${proj.name.slice(0, 32)}`}
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
            Mi trabajo es <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>cuidar cuál es el norte del negocio</strong>. Subir un proyecto significa que otro deja de serlo. Si tu argumento no se sostiene, te lo voy a decir.
          </p>
          {proj.scoreRazon && <div style={{ width: '100%', maxWidth: 430, fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, fontStyle: 'italic', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px' }}>“{proj.scoreRazon}”</div>}
        </div>
      )}
      {idx === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 34, fontWeight: 800, color: proj.color }}><ScoreIcon size={30} color={proj.color} />{newScore}<span style={{ fontSize: 20, color: 'var(--faint)' }}>/100</span></span>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 2 }}>{newScore === proj.score ? 'sin cambios' : newScore > proj.score ? 'más arriba' : 'más abajo'}{newScore >= 96 ? ' · sería el Objetivo Principal' : ''}</div>
          </div>
          <input type="range" min={1} max={100} step={1} value={newScore} onChange={(e) => setNewScore(Number(e.target.value))} style={{ width: '100%', accentColor: proj.color }} />
        </div>
      )}
      {idx === 2 && <RadioList opciones={razones} value={razon} onChange={(k) => { setRazon(k as RazonKey); setSiNo(null); setElegidos([]); }} />}
      {idx === 3 && (esPick
        ? <ProyectosPick otros={otros} value={elegidos} onToggle={toggleElegido} />
        : <SiNoBody comparacion={comparacion} value={siNo} siLabel={siLabel} onSi={() => setSiNo(true)} onNo={decirNo} />)}
      {idx === 4 && <textarea value={porque} onChange={(e) => setPorque(e.target.value)} autoFocus placeholder="Ej: sin este proyecto no factura nada del resto…" style={{ ...textareaStyle }} />}
    </WizardShell>
  );
}

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

// Multi-select de proyectos (para "habilita/desbloquea" o "lo cubre otro").
function ProyectosPick({ otros, value, onToggle }: { otros: OtroProy[]; value: string[]; onToggle: (id: string) => void }) {
  if (otros.length === 0) return <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>No hay otros proyectos para elegir.</div>;
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
      {otros.map((p) => {
        const on = value.includes(p.id);
        return (
          <button key={p.id} type="button" onClick={() => onToggle(p.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 13px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`, borderLeft: `3px solid ${p.color}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
            <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
            <span style={{ flex: 1 }}>{p.emoji} {p.name}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: p.color }}><ScoreIcon size={11} color={p.color} />{p.score}</span>
          </button>
        );
      })}
    </div>
  );
}

function SiNoBody({ comparacion, value, siLabel, onSi, onNo }: { comparacion: OtroProy[]; value: boolean | null; siLabel: string; onSi: () => void; onNo: () => void }) {
  return (
    <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {comparacion.length === 0 && <div style={{ fontSize: 13, color: 'var(--faint)', fontStyle: 'italic' }}>No hay otros proyectos para comparar.</div>}
        {comparacion.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 11px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: p.color }}><ScoreIcon size={11} color={p.color} />{p.score}</span>
            <span style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)' }}>{p.emoji} {p.name}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onSi} style={{ flex: 1, padding: '12px 10px', borderRadius: 11, border: `1.5px solid ${value === true ? 'var(--primary)' : 'var(--border-strong)'}`, background: value === true ? 'var(--primary-bg)' : 'var(--surface)', color: value === true ? 'var(--primary)' : 'var(--ink)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{siLabel}</button>
        <button type="button" onClick={onNo} style={{ flex: 1, padding: '12px 10px', borderRadius: 11, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>No, ahora que lo veo…</button>
      </div>
    </div>
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
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
