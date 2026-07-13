'use client';

// CrearTareaModal — crear una tarea con el Perro Guardián, de a 1 pregunta:
// intro → título → detalle → PROYECTO(s) (o ninguno + por qué; si el proyecto no
// existe, se crea inline) → PRIORIDAD propuesta → PUNTUACIÓN propuesta (con ejemplos)
// → ¿por qué importa? → MaKo la puntúa arrancando de la sugerencia y decide su columna.
// Guarda BORRADOR por si se sale.

import { useEffect, useState, type CSSProperties } from 'react';
import { WizardShell, wizardInput } from '../../leads/WizardShell';
import { IntroBody, ChoiceBody, textareaStyle, ScoreIcon } from './guardian-form';
import { GuardianIcon } from './GuardianIcon';
import { EmojiPickerMini } from './EmojiPicker';
import { type Prio, type Label, PRIOS, PLABEL, PCOLOR, prioFromScore, scoreFromPrio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const DRAFT_KEY = 'mako_draft_tarea';

export type CrearResult = { score: number; prio: Prio; razon: string; respuesta: string } | null;
export type CrearData = { title: string; detalle: string; labelIds: string[]; userPrio: Prio | ''; userScore: number; motivoNinguno: string; nuevoProyecto: string; nuevoProyEmoji: string; argumento: string; puntuar: boolean };

const OPCIONES = ['Es urgente / bloquea algo', 'Impacta directo en los ingresos', 'Mejora la conversión o el funnel', 'Es un quick win (poco esfuerzo, buen retorno)', 'Es a futuro / nice to have'];
const NINGUNO = ['Ese proyecto todavía no existe', 'Es una tarea suelta'];

export function CrearTareaModal({ labels, proyectoInicial, prioInicial, ejemplos, onCrear, onClose }: {
  labels: Label[]; proyectoInicial: string | null; prioInicial: Prio | null; ejemplos: Array<{ title: string; score: number }>;
  onCrear: (data: CrearData) => Promise<CrearResult>; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [detalle, setDetalle] = useState('');
  const [sel, setSel] = useState<string[]>(proyectoInicial ? [proyectoInicial] : []);
  const [motivoNinguno, setMotivoNinguno] = useState('');
  const [nuevoProy, setNuevoProy] = useState('');
  const [nuevoEmoji, setNuevoEmoji] = useState('🏷');
  const [userPrio, setUserPrio] = useState<Prio | ''>(prioInicial ?? '');
  const [userScore, setUserScore] = useState<number>(prioInicial ? scoreFromPrio[prioInicial] : 50);
  const [arg, setArg] = useState('');
  const [puntuar, setPuntuar] = useState(true);
  const [fase, setFase] = useState<'form' | 'puntuando' | 'veredicto'>('form');
  const [res, setRes] = useState<CrearResult>(null);
  const [restored, setRestored] = useState(false);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // BORRADOR
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) { const d = JSON.parse(raw); setTitle(d.title || ''); setDetalle(d.detalle || ''); setMotivoNinguno(d.motivoNinguno || ''); setNuevoProy(d.nuevoProy || ''); setNuevoEmoji(d.nuevoEmoji || '🏷'); if (typeof d.userScore === 'number') setUserScore(d.userScore); if (d.userPrio) setUserPrio(d.userPrio); setArg(d.arg || ''); } } catch { /* no-op */ }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, detalle, motivoNinguno, nuevoProy, nuevoEmoji, userPrio, userScore, arg })); } catch { /* no-op */ }
  }, [restored, title, detalle, motivoNinguno, nuevoProy, nuevoEmoji, userPrio, userScore, arg]);

  // al mover la prioridad, arrastro el score al centro de la banda (si no lo tocó a mano)
  const setPrio = (p: Prio) => { setUserPrio(p); setUserScore(scoreFromPrio[p]); };

  const crear = async () => {
    setFase('puntuando');
    const r = await onCrear({ title: title.trim(), detalle: detalle.trim(), labelIds: sel, userPrio, userScore, motivoNinguno: motivoNinguno.trim(), nuevoProyecto: motivoNinguno === 'Ese proyecto todavía no existe' ? nuevoProy.trim() : '', nuevoProyEmoji: nuevoEmoji, argumento: arg.trim(), puntuar });
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* no-op */ }
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
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontWeight: 700, fontSize: 16, color: PCOLOR[res.prio], marginBottom: 12 }}><ScoreIcon size={15} color={PCOLOR[res.prio]} />{res.score} · {PLABEL[res.prio]}</div>
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

  const banda = prioFromScore(userScore);
  const cercanos = ejemplos.slice().sort((a, b) => Math.abs(a.score - userScore) - Math.abs(b.score - userScore)).slice(0, 3);
  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿Qué hay que hacer?', 'Contame un poco más (opcional)', '¿En qué proyecto(s) va?', '¿Qué prioridad le pondrías vos?', '¿Y qué puntuación (1-100)?', '¿Por qué importa?'];
  const subs: (string | undefined)[] = [undefined, undefined, 'Detalle, contexto, criterio de "listo". Podés saltearlo.', 'Podés elegir más de uno, o ninguno.', 'Es tu propuesta: yo la reviso y decido la final.', 'Afiná el número. Mirá cómo puntúan otras parecidas.', 'Con esto ajusto la prioridad. Elegí o escribí.'];
  const nuevoOk = motivoNinguno === 'Ese proyecto todavía no existe' ? nuevoProy.trim() !== '' : true;
  const puedeAvanzar = idx === 1 ? title.trim() !== ''
    : idx === 3 ? ((sel.length > 0 || motivoNinguno !== '') && nuevoOk)
      : idx === 4 ? userPrio !== ''
        : idx === 6 ? (!puntuar || arg.trim() !== '') : true;

  return (
    <WizardShell
      titulo="Nueva tarea"
      total={7} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 6} confirmLabel={puntuar ? 'Crear · que la priorice →' : 'Crear sin puntuar · 0 tokens'}
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={crear}
    >
      {idx === 0 && <IntroBody que="crear una tarea nueva" />}
      {idx === 1 && <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) setIdx(2); }} autoFocus placeholder="Escribí la tarea…" style={{ ...wizardInput }} />}
      {idx === 2 && <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} autoFocus placeholder="Contexto, alcance…" style={{ ...textareaStyle }} />}
      {idx === 3 && (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {labels.map((l) => {
            const on = sel.includes(l.id);
            return (
              <button key={l.id} type="button" onClick={() => { toggle(l.id); setMotivoNinguno(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, cursor: 'pointer', fontFamily: SANS }}>
                <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
                <span style={{ flex: 1 }}>{l.emoji} {l.name}</span>
              </button>
            );
          })}
          {sel.length === 0 && (
            <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 8 }}>Si no va a ningún proyecto, ¿por qué?</div>
              {NINGUNO.map((o) => {
                const on = motivoNinguno === o;
                return (
                  <button key={o} type="button" onClick={() => setMotivoNinguno(on ? '' : o)}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '10px 13px', marginBottom: 6, borderRadius: 10, border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, cursor: 'pointer', fontFamily: SANS }}>
                    <span style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', flex: 'none', boxShadow: on ? 'inset 0 0 0 2.5px var(--surface)' : 'none' }} />
                    {o}
                  </button>
                );
              })}
              {motivoNinguno === 'Ese proyecto todavía no existe' && (
                <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <EmojiPickerMini value={nuevoEmoji} onPick={setNuevoEmoji} />
                  <input value={nuevoProy} onChange={(e) => setNuevoProy(e.target.value)} autoFocus placeholder="¿Cómo se llamaría el proyecto?" style={{ flex: 1, padding: '10px 13px', borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13.5, outline: 'none', fontFamily: SANS }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {idx === 4 && (
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRIOS.map((p) => {
            const on = userPrio === p;
            return (
              <button key={p} type="button" onClick={() => setPrio(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 11, border: `1px solid ${on ? PCOLOR[p] : 'var(--border-strong)'}`, background: on ? PCOLOR[p] + '14' : 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: SANS }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: PCOLOR[p], flex: 'none' }} />
                <span style={{ flex: 1 }}>{PLABEL[p]}</span>
              </button>
            );
          })}
        </div>
      )}
      {idx === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 34, fontWeight: 800, color: PCOLOR[banda] }}><ScoreIcon size={30} color={PCOLOR[banda]} />{userScore}</span>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: PCOLOR[banda], textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{PLABEL[banda]}</div>
          </div>
          <input type="range" min={1} max={100} step={1} value={userScore} onChange={(e) => setUserScore(Number(e.target.value))} style={{ width: '100%', accentColor: PCOLOR[banda] }} />
          {cercanos.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>Parecidas a ese puntaje</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {cercanos.map((t, i) => {
                  const c = PCOLOR[prioFromScore(t.score)];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dim)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: c }}><ScoreIcon size={10} color={c} />{t.score}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {idx === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
          <button type="button" onClick={() => setPuntuar((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 13px', borderRadius: 11, border: `1px solid ${puntuar ? 'var(--primary)' : 'var(--border-strong)'}`, background: puntuar ? 'var(--primary-bg)' : 'var(--surface)', cursor: 'pointer', fontFamily: SANS }}>
            <span style={{ width: 34, height: 20, borderRadius: 999, background: puntuar ? 'var(--primary)' : 'var(--border-strong)', position: 'relative', flex: 'none', transition: 'background .12s' }}>
              <span style={{ position: 'absolute', top: 2, left: puntuar ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .12s' }} />
            </span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Que el Perro Guardián la puntúe</span>
            <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>{puntuar ? 'usa tokens' : '0 tokens'}</span>
          </button>
          {puntuar
            ? <ChoiceBody opciones={OPCIONES} value={arg} onChange={setArg} customPlaceholder="Otra… (por qué te parece importante)" />
            : <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 11, padding: '12px 14px' }}>Se crea con la puntuación que elegiste ({userScore} · {PLABEL[banda]}) sin llamar a la IA. Perfecto para cargar tareas en lote; después podés debatirla con el perro cuando quieras.</div>}
        </div>
      )}
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
