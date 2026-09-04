'use client';

// EliminarModal — borrar con el Perro Guardián, con el MISMO chrome que los demás
// forms (WizardShell): intro → motivo → [según motivo]. "Ya se hizo" / "Cambió la
// prioridad" NO borran: guían con una acción real (Marcar como completada / Cambiar
// prioridad). "Está duplicada" busca duplicados con IA. En el resto, el PERRO decide
// si vale la pena borrar o conservar. Flechas atrás/adelante en todos los pasos.

import { useMemo, useState, type CSSProperties } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { GuardianIcon } from './GuardianIcon';
import { IntroBody, textareaStyle } from './guardian-form';

const SANS = "'Geist', sans-serif";

type Tipo = 'tarea' | 'proyecto';
type OtraTarea = { id: string; titulo: string; detalle?: string; projColor?: string; projEmoji?: string };

const REASONS_TAREA = [
  { key: 'no_aplica', label: 'Ya no aplica' },
  { key: 'duplicada', label: 'Está duplicada' },
  { key: 'ya_hecha', label: 'Ya se hizo' },
  { key: 'cambio_prio', label: 'Cambió la prioridad' },
];
const REASONS_PROY = [
  { key: 'no_relevante', label: 'Ya no es relevante' },
  { key: 'fusiona', label: 'Se fusiona con otro' },
  { key: 'error', label: 'Fue un error' },
  { key: 'termino', label: 'Terminó' },
];
const LABEL: Record<string, string> = Object.fromEntries([...REASONS_TAREA, ...REASONS_PROY].map((r) => [r.key, r.label]));

export function EliminarModal({ tipo, nombre, nTareas = 0, task, otras = [], plan, onBorrar, onCompletar, onDebate, onUsage, onClose }: {
  tipo: Tipo; nombre: string; nTareas?: number;
  task?: { id: string; title: string; detalle: string };
  otras?: OtraTarea[]; plan: string;
  onBorrar: (motivo: string) => void; onCompletar?: () => void; onDebate?: () => void; onUsage?: (u: unknown) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [porque, setPorque] = useState('');
  const [dups, setDups] = useState<Array<{ id: string; razon: string }>>([]);
  const [dupSel, setDupSel] = useState('');
  const [dupLoading, setDupLoading] = useState(false);
  const [fase, setFase] = useState<'form' | 'consultando' | 'veredicto'>('form');
  const [ver, setVer] = useState<{ veredicto: 'borrar' | 'conservar'; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  const reasons = tipo === 'tarea' ? REASONS_TAREA : REASONS_PROY;
  const que = tipo === 'tarea' ? `la tarea «${nombre.slice(0, 44)}»` : `el proyecto «${nombre}»${nTareas ? ` y sus ${nTareas} tarea(s)` : ''}`;
  const bloqueo = tipo === 'tarea' && (motivo === 'ya_hecha' || motivo === 'cambio_prio');

  // secuencia de pasos según el motivo (para los dots del wizard)
  const steps = useMemo(() => {
    if (!motivo) return ['intro', 'motivo'];
    if (bloqueo) return ['intro', 'motivo', 'bloqueo'];
    if (tipo === 'tarea' && motivo === 'duplicada') return ['intro', 'motivo', 'dup', 'porque'];
    return ['intro', 'motivo', 'porque'];
  }, [motivo, bloqueo, tipo]);
  const step = steps[idx] ?? 'motivo';

  const buscarDups = async () => {
    setDupLoading(true);
    const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'duplicados', tarea: `${task?.title ?? nombre}${task?.detalle ? `\n\n${task.detalle}` : ''}`, otras: otras.map((o) => ({ id: o.id, titulo: o.titulo, detalle: o.detalle })) }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    if (j.usage) onUsage?.(j.usage);
    setDups(Array.isArray(j.duplicados) ? j.duplicados : []);
    setDupLoading(false);
  };

  const consultarPerro = async () => {
    setFase('consultando'); setErr('');
    const dupTxt = motivo === 'duplicada' && dupSel ? ` Duplicada con: "${otras.find((o) => o.id === dupSel)?.titulo ?? dupSel}".` : motivo === 'duplicada' ? ' Dice que está duplicada.' : '';
    const motivoTxt = `${LABEL[motivo] ?? motivo}.${dupTxt} ${porque.trim()}`.trim();
    const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'eliminar', tipo, que: tipo === 'tarea' ? `${nombre}${task?.detalle ? `\n\n${task.detalle}` : ''}` : `${nombre}${nTareas ? ` (tiene ${nTareas} tareas)` : ''}`, motivo: motivoTxt, plan }) }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && (j.veredicto === 'borrar' || j.veredicto === 'conservar')) { setVer({ veredicto: j.veredicto, respuesta: j.respuesta ?? '' }); setFase('veredicto'); }
    else { setErr(j.error || 'MaKo no pudo responder ahora.'); setFase('form'); }
  };

  const ejecutarBorrado = () => {
    const dupTxt = motivo === 'duplicada' && dupSel ? ` (dup de «${otras.find((o) => o.id === dupSel)?.titulo?.slice(0, 30) ?? ''}»)` : '';
    onBorrar(`${LABEL[motivo] ?? 'sin motivo'}${dupTxt}${porque.trim() ? ` — ${porque.trim().slice(0, 60)}` : ''}`);
    onClose();
  };

  // ── consultando / veredicto (pantalla propia, igual que los demás forms) ──
  if (fase !== 'form') {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: '30px 26px 8px', textAlign: 'center' }}>
          {fase === 'consultando'
            ? <div style={{ padding: '30px 0', color: 'var(--dim)', fontSize: 14 }}>El Perro Guardián está decidiendo…</div>
            : ver && <>
                {/* Se centra con FLEX, no con el `textAlign: 'center'` del padre: el preflight
                    de Tailwind pone `svg { display: block }` y a un bloque el text-align no lo
                    mueve — el icono quedaba pegado a la izquierda. */}
                <div style={{ display: 'flex', justifyContent: 'center' }}><GuardianIcon size={54} /></div>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 10px', color: ver.veredicto === 'borrar' ? 'var(--bad)' : 'var(--good)' }}>{ver.veredicto === 'borrar' ? 'Ok, se puede borrar' : 'Mejor consérvala'}</div>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, textAlign: 'left', background: ver.veredicto === 'borrar' ? 'var(--bad-bg)' : 'var(--good-bg, var(--surface-2))', border: `1px solid ${ver.veredicto === 'borrar' ? 'var(--bad)' : 'var(--good)'}55`, borderRadius: 12, padding: '14px 16px' }}>{ver.respuesta}</div>
              </>}
        </div>
        {fase === 'veredicto' && ver && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            {ver.veredicto === 'borrar'
              ? <><button onClick={() => setFase('form')} style={ghostBtn}>← Volver</button><button onClick={ejecutarBorrado} style={{ ...primaryBtn, background: 'var(--bad)' }}>Borrar igual →</button></>
              : <><span /><button onClick={onClose} style={primaryBtn}>Ok, la dejo →</button></>}
          </div>
        )}
      </Shell>
    );
  }

  // ── formulario (WizardShell, mismo chrome que los demás) ──
  const preguntas: Record<string, string> = {
    intro: 'Frena un segundo', motivo: '¿Por qué la quieres borrar?',
    bloqueo: motivo === 'ya_hecha' ? 'Entonces no la borres — márcala como hecha' : 'Entonces no la borres — cambia su prioridad',
    dup: 'Busqué posibles duplicadas', porque: motivo === 'duplicada' ? 'Cuéntame un poco más' : '¿Por qué?',
  };
  const subs: Record<string, string | undefined> = {
    intro: undefined, motivo: 'Según cuál sea, te ayudo distinto.',
    bloqueo: undefined, dup: 'Elige la que es el mismo trabajo, o sigue si ninguna aplica.', porque: 'Con esto el perro decide si vale la pena borrarla.',
  };
  const enUltimo = step === 'bloqueo' || step === 'porque';
  const confirmLabel = step === 'bloqueo'
    ? (motivo === 'ya_hecha' ? 'Marcar como completada →' : 'Cambiar prioridad →')
    : 'Que el perro decida →';
  const puedeAvanzar = step === 'motivo' ? motivo !== '' : step === 'porque' ? porque.trim() !== '' : step === 'dup' ? !dupLoading : true;

  const avanzar = () => {
    // al pasar de "motivo" a la rama de duplicados, dispara la búsqueda
    const next = steps[idx + 1];
    if (next === 'dup') void buscarDups();
    setIdx(idx + 1);
  };
  const confirmar = () => {
    if (step === 'bloqueo') { onClose(); if (motivo === 'ya_hecha') onCompletar?.(); else onDebate?.(); return; }
    void consultarPerro();
  };

  return (
    <WizardShell
      titulo="Eliminar"
      total={steps.length} idx={idx}
      pregunta={preguntas[step]} sub={subs[step]}
      puedeAvanzar={puedeAvanzar} pending={dupLoading}
      enUltimo={enUltimo} confirmLabel={confirmLabel}
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'} error={err}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={avanzar}
      onConfirmar={confirmar}
    >
      {step === 'intro' && (
        <>
          <IntroBody que={`borrar ${que}`} mi="que no tires a la basura algo que después vas a necesitar" />
          {tipo === 'proyecto' && nTareas > 0 && <div style={{ marginTop: 14, fontSize: 13, color: 'var(--bad)', fontWeight: 600, background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '10px 13px' }}>Ojo: se borran también sus {nTareas} tarea(s). No se puede deshacer.</div>}
        </>
      )}
      {step === 'motivo' && (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reasons.map((r) => {
            const on = motivo === r.key;
            return (
              <button key={r.key} type="button" onClick={() => setMotivo(on ? '' : r.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2.5px var(--surface)' : 'none' }} />
                {r.label}
              </button>
            );
          })}
        </div>
      )}
      {step === 'bloqueo' && (
        <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          {motivo === 'ya_hecha'
            ? <>Si ya se hizo, <strong>márcala como completada</strong> — así queda en tu historial como un logro, no desaparece. Presiona el botón de abajo.</>
            : <>Si cambió la prioridad, <strong>debátela con el perro</strong> en vez de borrarla. Bajarla es mejor que perderla. Presiona el botón de abajo.</>}
        </div>
      )}
      {step === 'dup' && (
        dupLoading
          ? <div style={{ padding: '26px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}><div style={{ display: 'flex', justifyContent: 'center' }}><GuardianIcon size={40} /></div><div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Spinner /> Buscando tareas duplicadas…</div></div>
          : dups.length === 0
            ? <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55, textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '13px 15px' }}>No encontré ninguna tarea que sea el mismo trabajo. Si igual crees que está duplicada, sigue y cuéntame cuál.</div>
            : <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dups.map((d) => {
                  const t = otras.find((o) => o.id === d.id);
                  const on = dupSel === d.id;
                  return (
                    <button key={d.id} type="button" onClick={() => setDupSel(on ? '' : d.id)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, borderLeft: `3px solid ${t?.projColor || 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, cursor: 'pointer', fontFamily: SANS }}>
                      <span style={{ fontWeight: 600 }}>{t?.projEmoji} {t?.titulo ?? d.id}</span>
                      {d.razon && <span style={{ fontSize: 12, color: 'var(--faint)' }}>{d.razon}</span>}
                    </button>
                  );
                })}
              </div>
      )}
      {step === 'porque' && <textarea value={porque} onChange={(e) => setPorque(e.target.value)} autoFocus placeholder={motivo === 'no_aplica' ? 'Ej: el cliente canceló ese servicio…' : 'Cuéntame tu razón…'} style={{ ...textareaStyle }} />}
    </WizardShell>
  );
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 15, height: 15, border: '2px solid var(--border-strong)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'makoSpin .7s linear infinite' }}><style>{'@keyframes makoSpin{to{transform:rotate(360deg)}}'}</style></span>;
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
