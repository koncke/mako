'use client';

// CrearTareaModal — crear una tarea con el Perro Guardián, de a 1 pregunta:
// intro → título → PROYECTO(s) (o ninguno; si no existe, se crea inline) → PRIORIDAD
// (unificada: puntaje 1-100 + bandas + comparación, como "Cambiar prioridad") → ¿por
// qué importa? → "Contame un poco más" (al final, opcional). El perro SIEMPRE la puntúa.
// Al crear, se abre el detalle y se sugiere optimizarla con "MaKo te ayuda".

import { useEffect, useState, type CSSProperties } from 'react';
import { WizardShell, wizardInput } from '@/app/_components/WizardShell';
import { IntroBody, ChoiceBody, textareaStyle, ScoreIcon } from './guardian-form';
import { GuardianIcon } from './GuardianIcon';
import { EmojiPickerMini } from './EmojiPicker';
import { type Prio, type Label, PLABEL, PCOLOR, prioFromScore, scoreFromPrio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const DRAFT_KEY = 'mako_draft_tarea';

export type CrearResult = { id: string; score: number; prio: Prio; razon: string; respuesta: string } | null;
export type CrearData = { title: string; detalle: string; labelIds: string[]; userScore: number; motivoNinguno: string; nuevoProyecto: string; nuevoProyEmoji: string; argumento: string };

const OPCIONES = ['Es urgente / bloquea algo', 'Impacta directo en los ingresos', 'Mejora la conversión o el funnel', 'Es un quick win (poco esfuerzo, buen retorno)', 'Es a futuro / nice to have'];
const NINGUNO = ['Ese proyecto todavía no existe', 'Es una tarea suelta'];
const BANDAS: Prio[] = ['alta', 'media', 'baja', 'futuro'];

export function CrearTareaModal({ labels, proyectoInicial, prioInicial, ejemplos, onCrear, onDone, onClose }: {
  labels: Label[]; proyectoInicial: string | null; prioInicial: Prio | null; ejemplos: Array<{ title: string; score: number }>;
  onCrear: (data: CrearData) => Promise<CrearResult>; onDone: (id: string) => void; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [detalle, setDetalle] = useState('');
  const [sel, setSel] = useState<string[]>(proyectoInicial ? [proyectoInicial] : []);
  const [motivoNinguno, setMotivoNinguno] = useState('');
  const [nuevoProy, setNuevoProy] = useState('');
  const [nuevoEmoji, setNuevoEmoji] = useState('🏷');
  const [userScore, setUserScore] = useState<number>(prioInicial ? scoreFromPrio[prioInicial] : 50);
  const [arg, setArg] = useState('');
  const [fase, setFase] = useState<'form' | 'puntuando' | 'veredicto'>('form');
  const [res, setRes] = useState<CrearResult>(null);
  const [restored, setRestored] = useState(false);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // BORRADOR
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) { const d = JSON.parse(raw); setTitle(d.title || ''); setDetalle(d.detalle || ''); setMotivoNinguno(d.motivoNinguno || ''); setNuevoProy(d.nuevoProy || ''); setNuevoEmoji(d.nuevoEmoji || '🏷'); if (typeof d.userScore === 'number') setUserScore(d.userScore); setArg(d.arg || ''); } } catch { /* no-op */ }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, detalle, motivoNinguno, nuevoProy, nuevoEmoji, userScore, arg })); } catch { /* no-op */ }
  }, [restored, title, detalle, motivoNinguno, nuevoProy, nuevoEmoji, userScore, arg]);

  const crear = async () => {
    setFase('puntuando');
    const r = await onCrear({ title: title.trim(), detalle: detalle.trim(), labelIds: sel, userScore, motivoNinguno: motivoNinguno.trim(), nuevoProyecto: motivoNinguno === 'Ese proyecto todavía no existe' ? nuevoProy.trim() : '', nuevoProyEmoji: nuevoEmoji, argumento: arg.trim() });
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
                {/* Se centra con FLEX, no con el `textAlign: 'center'` del padre: el preflight
                    de Tailwind pone `svg { display: block }` y a un bloque el text-align no lo
                    mueve — el icono quedaba pegado a la izquierda. */}
                <div style={{ display: 'flex', justifyContent: 'center' }}><GuardianIcon size={52} /></div>
                <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', margin: '12px 0 10px' }}>{title}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontWeight: 700, fontSize: 16, color: PCOLOR[res.prio], marginBottom: 12 }}><ScoreIcon size={15} color={PCOLOR[res.prio]} />{res.score} · {PLABEL[res.prio]}</div>
                <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, textAlign: 'left', background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)', borderRadius: 12, padding: '13px 15px' }}>{res.respuesta}</div>
              </>}
        </div>
        {fase === 'veredicto' && (
          <div style={{ display: 'flex', justifyContent: res?.id ? 'space-between' : 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Listo</button>
            {res?.id && <button type="button" onClick={() => onDone(res.id)} style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}><MakoStarInline /> Optimizala con MaKo →</button>}
          </div>
        )}
      </Shell>
    );
  }

  const banda = prioFromScore(userScore);
  const cercanos = ejemplos.slice().sort((a, b) => Math.abs(a.score - userScore) - Math.abs(b.score - userScore)).slice(0, 3);
  const preguntas = ['Hola, soy el Perro Guardián MaKo', '¿Qué hay que hacer?', '¿En qué proyecto(s) va?', '¿Qué prioridad le pondrías?', '¿Por qué importa?', 'Cuéntame un poco más (opcional)'];
  const subs: (string | undefined)[] = [undefined, undefined, 'Puedes elegir más de uno, o ninguno.', 'Pon tu puntaje; yo lo reviso y decido el final. Mira cómo puntúan otras.', 'Con esto ajusto la prioridad. Elige o escribe.', 'Detalle, contexto, criterio de "listo". Puedes saltarlo.'];
  const nuevoOk = motivoNinguno === 'Ese proyecto todavía no existe' ? nuevoProy.trim() !== '' : true;
  const puedeAvanzar = idx === 1 ? title.trim() !== ''
    : idx === 2 ? ((sel.length > 0 || motivoNinguno !== '') && nuevoOk)
      : idx === 4 ? arg.trim() !== '' : true;

  return (
    <WizardShell
      titulo="Nueva tarea"
      total={6} idx={idx}
      pregunta={preguntas[idx]} sub={subs[idx]}
      puedeAvanzar={puedeAvanzar}
      enUltimo={idx === 5} confirmLabel="Crear · que la priorice →"
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onClose={onClose}
      onAtras={() => (idx === 0 ? onClose() : setIdx(idx - 1))}
      onSiguiente={() => setIdx(idx + 1)}
      onConfirmar={crear}
    >
      {idx === 0 && <IntroBody que="crear una tarea nueva" />}
      {idx === 1 && <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) setIdx(2); }} autoFocus placeholder="Escribe la tarea…" style={{ ...wizardInput }} />}
      {idx === 2 && (
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
      {idx === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 34, fontWeight: 800, color: PCOLOR[banda] }}><ScoreIcon size={30} color={PCOLOR[banda]} />{userScore}</span>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: PCOLOR[banda], textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>{PLABEL[banda]}</div>
          </div>
          <input type="range" min={1} max={100} step={1} value={userScore} onChange={(e) => setUserScore(Number(e.target.value))} style={{ width: '100%', accentColor: PCOLOR[banda] }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {BANDAS.map((p) => (
              <button key={p} type="button" onClick={() => setUserScore(scoreFromPrio[p])} style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: `1px solid ${banda === p ? PCOLOR[p] : 'var(--border-strong)'}`, background: banda === p ? PCOLOR[p] + '14' : 'var(--surface)', color: banda === p ? PCOLOR[p] : 'var(--dim)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: SANS }}>{PLABEL[p]}</button>
            ))}
          </div>
          {cercanos.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, textAlign: 'left' }}>
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
      {idx === 4 && <ChoiceBody opciones={OPCIONES} value={arg} onChange={setArg} customPlaceholder="Otra… (por qué te parece importante)" />}
      {idx === 5 && <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} autoFocus placeholder="Contexto, alcance, criterio de listo…" style={{ ...textareaStyle }} />}
    </WizardShell>
  );
}

function MakoStarInline() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M12 2l2.2 6.6L21 9l-5.4 4 2 6.8L12 16l-5.6 3.8 2-6.8L3 9l6.8-.4z" /></svg>; }

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

const primaryBtn: CSSProperties = { padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '11px 18px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
