'use client';

// EliminarModal — borrar con el Perro Guardián. Personalizado por tipo (tarea vs
// proyecto) y por motivo (feedback): "Ya se hizo"/"Cambió la prioridad" NO borran
// (guían al usuario); "Está duplicada" busca duplicados con IA; el resto pregunta el
// motivo. En todos los casos el PERRO decide si vale la pena borrar o conservar.

import { useState, type CSSProperties } from 'react';
import { GuardianIcon } from './GuardianIcon';
import { textareaStyle } from './guardian-form';

const SANS = "'Geist', sans-serif";

type Tipo = 'tarea' | 'proyecto';
type Fase = 'intro' | 'motivo' | 'dup' | 'porque' | 'bloqueo' | 'consultando' | 'veredicto';
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

export function EliminarModal({ tipo, nombre, nTareas = 0, task, otras = [], plan, onBorrar, onOpenTask, onUsage, onClose }: {
  tipo: Tipo; nombre: string; nTareas?: number;
  task?: { id: string; title: string; detalle: string };
  otras?: OtraTarea[]; plan: string;
  onBorrar: (motivo: string) => void; onOpenTask?: () => void; onUsage?: (u: unknown) => void; onClose: () => void;
}) {
  const [fase, setFase] = useState<Fase>('intro');
  const [motivo, setMotivo] = useState('');   // key de la razón
  const [porque, setPorque] = useState('');
  const [dups, setDups] = useState<Array<{ id: string; razon: string }>>([]);
  const [dupSel, setDupSel] = useState<string>('');
  const [ver, setVer] = useState<{ veredicto: 'borrar' | 'conservar'; respuesta: string } | null>(null);
  const [err, setErr] = useState('');

  const reasons = tipo === 'tarea' ? REASONS_TAREA : REASONS_PROY;
  const que = tipo === 'tarea' ? `la tarea «${nombre.slice(0, 44)}»` : `el proyecto «${nombre}»${nTareas ? ` y sus ${nTareas} tarea(s)` : ''}`;

  const elegirMotivo = async (key: string) => {
    setMotivo(key);
    if (tipo === 'tarea' && (key === 'ya_hecha' || key === 'cambio_prio')) { setFase('bloqueo'); return; }
    if (tipo === 'tarea' && key === 'duplicada') {
      setFase('dup'); setErr('');
      const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'duplicados', tarea: `${task?.title ?? nombre}${task?.detalle ? `\n\n${task.detalle}` : ''}`, otras: otras.map((o) => ({ id: o.id, titulo: o.titulo, detalle: o.detalle })) }) }).then((r) => r.json()).catch(() => ({ ok: false }));
      if (j.usage) onUsage?.(j.usage);
      setDups(Array.isArray(j.duplicados) ? j.duplicados : []);
      return;
    }
    setFase('porque');
  };

  const consultarPerro = async () => {
    setFase('consultando'); setErr('');
    const dupTxt = motivo === 'duplicada' && dupSel ? ` Duplicada con: "${otras.find((o) => o.id === dupSel)?.titulo ?? dupSel}".` : motivo === 'duplicada' ? ' Dice que está duplicada.' : '';
    const motivoTxt = `${LABEL[motivo] ?? motivo}.${dupTxt} ${porque.trim()}`.trim();
    const j = await fetch('/api/mako-guardian', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'eliminar', tipo, que: tipo === 'tarea' ? `${nombre}${task?.detalle ? `\n\n${task.detalle}` : ''}` : `${nombre}${nTareas ? ` (tiene ${nTareas} tareas)` : ''}`, motivo: motivoTxt, plan }) }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));
    if (j.usage) onUsage?.(j.usage);
    if (j.ok && (j.veredicto === 'borrar' || j.veredicto === 'conservar')) { setVer({ veredicto: j.veredicto, respuesta: j.respuesta ?? '' }); setFase('veredicto'); }
    else { setErr(j.error || 'MaKo no pudo responder ahora.'); setFase('porque'); }
  };

  const ejecutarBorrado = () => {
    const dupTxt = motivo === 'duplicada' && dupSel ? ` (dup de «${otras.find((o) => o.id === dupSel)?.titulo?.slice(0, 30) ?? ''}»)` : '';
    onBorrar(`${LABEL[motivo] ?? 'sin motivo'}${dupTxt}${porque.trim() ? ` — ${porque.trim().slice(0, 60)}` : ''}`);
    onClose();
  };

  return (
    <Shell onClose={onClose}>
      <div style={{ padding: '26px 26px 6px' }}>
        {fase === 'intro' && (
          <div style={{ textAlign: 'center' }}>
            <GuardianIcon size={58} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '14px 0 8px' }}>Frená un segundo</div>
            <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.6, margin: '0 auto', maxWidth: 400 }}>Mi trabajo es <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>cuidar que no tires a la basura algo que después vas a necesitar</strong>. Vas a borrar {que}. Contame por qué y yo decido.</p>
            {tipo === 'proyecto' && nTareas > 0 && <div style={{ marginTop: 14, fontSize: 13, color: 'var(--bad)', fontWeight: 600, background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 10, padding: '10px 13px' }}>Ojo: se borran también sus {nTareas} tarea(s). No se puede deshacer.</div>}
          </div>
        )}

        {fase === 'motivo' && (
          <>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>¿Por qué la querés borrar?</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14 }}>Elegí un motivo. Según cuál sea, te ayudo distinto.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reasons.map((r) => (
                <button key={r.key} type="button" onClick={() => void elegirMotivo(r.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')} onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}>{r.label}</button>
              ))}
            </div>
          </>
        )}

        {fase === 'bloqueo' && (
          <div style={{ textAlign: 'center' }}>
            <GuardianIcon size={54} />
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', margin: '14px 0 10px' }}>Entonces no la borres.</div>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              {motivo === 'ya_hecha'
                ? <>Si ya se hizo, <strong>marcala como completada</strong>, no la borres — así queda en tu historial como un logro. Abrí la tarea y completá su checklist, o tocá <strong>“Completada”</strong> si no tiene.</>
                : <>Si cambió la prioridad, <strong>cambiá su prioridad</strong>, no la borres. Abrí la tarea y tocá <strong>“Cambiar prioridad”</strong> para debatirla con el perro. Bajarla es mejor que perderla.</>}
            </div>
          </div>
        )}

        {fase === 'dup' && (
          <>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Busqué posibles duplicadas</div>
            {dups.length === 0
              ? <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '13px 15px' }}>No encontré ninguna tarea que sea el mismo trabajo. Si igual creés que está duplicada, seguí y contame cuál en el próximo paso.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                </div>}
          </>
        )}

        {fase === 'porque' && (
          <>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{motivo === 'duplicada' ? 'Contame un poco más' : '¿Por qué?'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 12 }}>Con esto el perro decide si vale la pena borrarla.</div>
            <textarea value={porque} onChange={(e) => setPorque(e.target.value)} autoFocus placeholder={motivo === 'no_aplica' ? 'Ej: el cliente canceló ese servicio…' : 'Contame tu razón…'} style={{ ...textareaStyle }} />
            {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', marginTop: 8 }}>{err}</div>}
          </>
        )}

        {fase === 'consultando' && <div style={{ padding: '34px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 14 }}>El Perro Guardián está decidiendo…</div>}

        {fase === 'veredicto' && ver && (
          <div style={{ textAlign: 'center' }}>
            <GuardianIcon size={54} />
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', margin: '12px 0 10px', color: ver.veredicto === 'borrar' ? 'var(--bad)' : 'var(--good)' }}>{ver.veredicto === 'borrar' ? 'Ok, se puede borrar' : 'Mejor conservala'}</div>
            <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, textAlign: 'left', background: ver.veredicto === 'borrar' ? 'var(--bad-bg)' : 'var(--good-bg, var(--surface-2))', border: `1px solid ${ver.veredicto === 'borrar' ? 'var(--bad)' : 'var(--good)'}55`, borderRadius: 12, padding: '14px 16px' }}>{ver.respuesta}</div>
          </div>
        )}
      </div>

      {/* barra de acciones según la fase */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        {fase === 'intro' && <><button onClick={onClose} style={ghostBtn}>Cancelar</button><button onClick={() => setFase('motivo')} style={primaryBtn}>Seguir</button></>}
        {fase === 'motivo' && <button onClick={() => setFase('intro')} style={ghostBtn}>Atrás</button>}
        {fase === 'bloqueo' && <><button onClick={onClose} style={ghostBtn}>Entendido</button>{tipo === 'tarea' && onOpenTask && <button onClick={() => { onClose(); onOpenTask(); }} style={primaryBtn}>Abrir la tarea</button>}</>}
        {fase === 'dup' && <><button onClick={() => setFase('motivo')} style={ghostBtn}>Atrás</button><button onClick={() => setFase('porque')} style={primaryBtn}>Seguir</button></>}
        {fase === 'porque' && <><button onClick={() => setFase(tipo === 'tarea' && motivo === 'duplicada' ? 'dup' : 'motivo')} style={ghostBtn}>Atrás</button><button onClick={consultarPerro} disabled={porque.trim() === ''} style={{ ...primaryBtn, opacity: porque.trim() === '' ? 0.5 : 1 }}>Que el perro decida →</button></>}
        {fase === 'veredicto' && ver && (ver.veredicto === 'borrar'
          ? <><button onClick={onClose} style={ghostBtn}>Mejor no</button><button onClick={ejecutarBorrado} style={{ ...primaryBtn, background: 'var(--bad)' }}>Borrar de todos modos</button></>
          : <button onClick={onClose} style={primaryBtn}>Ok, la dejo</button>)}
      </div>
    </Shell>
  );
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
