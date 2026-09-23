'use client';

// =============================================================================
// CrearTareaModal — UNA pantalla, y se puede dictar
// =============================================================================
// Era un wizard de SEIS pasos con el Perro preguntando de a uno (intro → título →
// proyecto → prioridad → por qué importa → contame más). El reporte, textual (22/09/2026):
// «solamente para crear una tarea tengo ya un coso de Perro Guardián… tiene que poder
// escribirse directo o mandar un audio desde MaKo, elegir proyecto, nombre y deadline, y
// listo. Y si el usuario ya puso la prioridad, el Perro no la pisa».
//
// Así quedó, y cada decisión es de ese párrafo:
//  · TODO en una pantalla. Lo único obligatorio es el título.
//  · Se puede DICTAR el título y el detalle (/api/plan-dictado, cascada gratis).
//  · La FECHA es un campo, no una pregunta: es el único dato que el Perro no puede deducir.
//  · La PRIORIDAD es opcional y, si la pones, MANDA: se fija a mano (`score_manual`) y la
//    corrida del Perro no la toca. Si no la pones, la decide él como siempre.
// =============================================================================

import { useEffect, useState, type CSSProperties } from 'react';
import { useVoiceRecorder } from '@/app/whatsapp/_shared/VoiceRecorder';
import { EmojiPickerMini } from './EmojiPicker';
import { ScoreIcon } from './guardian-form';
import { GuardianIcon } from './GuardianIcon';
import { type Prio, type Label, PLABEL, PCOLOR, prioFromScore, scoreFromPrio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const DRAFT_KEY = 'mako_draft_tarea';
const NUEVO = '__nuevo__';

export type CrearResult = { id: string; score: number; prio: Prio; razon: string; respuesta: string } | null;
export type CrearData = {
  title: string; detalle: string; labelIds: string[]; userScore: number;
  motivoNinguno: string; nuevoProyecto: string; nuevoProyEmoji: string; argumento: string;
  /** cuándo vence (ISO). Vacío = que la ponga el Perro. */
  deadline: string;
  /** la prioridad la puso la PERSONA: se fija a mano y el Perro no la pisa */
  fijarPrioridad: boolean;
};

export function CrearTareaModal({ labels, proyectoInicial, prioInicial, puedeFijarPrioridad = false, onCrear, onDone, onClose }: {
  labels: Label[]; proyectoInicial: string | null; prioInicial: Prio | null;
  /** ¿este tablero puede FIJAR el número a mano? Sólo el del dueño (ver Repo.prioridadManual).
   *  Si no puede, la casilla no se dibuja: ofrecer algo que se va a ignorar es un control muerto. */
  puedeFijarPrioridad?: boolean;
  /** las tareas del plan con su score, para comparar al elegir el número (no se usa hoy) */
  ejemplos?: Array<{ title: string; score: number }>;
  onCrear: (data: CrearData) => Promise<CrearResult>; onDone: (id: string) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [detalle, setDetalle] = useState('');
  const [proy, setProy] = useState<string>(proyectoInicial ?? '');
  const [nuevoProy, setNuevoProy] = useState('');
  const [nuevoEmoji, setNuevoEmoji] = useState('🏷');
  const [deadline, setDeadline] = useState('');
  const [ponerPrio, setPonerPrio] = useState(puedeFijarPrioridad && prioInicial != null);
  const [userScore, setUserScore] = useState<number>(prioInicial ? scoreFromPrio[prioInicial] : 50);
  const [creando, setCreando] = useState(false);
  const [err, setErr] = useState('');
  const [restored, setRestored] = useState(false);

  // BORRADOR: lo que escribiste sobrevive a cerrar el modal sin querer.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (typeof d.title === 'string') setTitle(d.title);
        if (typeof d.detalle === 'string') setDetalle(d.detalle);
        if (typeof d.nuevoProy === 'string') setNuevoProy(d.nuevoProy);
        if (typeof d.nuevoEmoji === 'string') setNuevoEmoji(d.nuevoEmoji);
        if (typeof d.deadline === 'string') setDeadline(d.deadline);
      }
    } catch { /* storage bloqueado */ }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, detalle, nuevoProy, nuevoEmoji, deadline })); } catch { /* idem */ }
  }, [restored, title, detalle, nuevoProy, nuevoEmoji, deadline]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const banda = prioFromScore(userScore);
  const puedeCrear = title.trim().length > 0 && (proy !== NUEVO || nuevoProy.trim() !== '');

  const crear = async () => {
    if (!puedeCrear || creando) return;
    setCreando(true);
    setErr('');
    const r = await onCrear({
      title: title.trim(), detalle: detalle.trim(),
      labelIds: proy && proy !== NUEVO ? [proy] : [],
      userScore, motivoNinguno: '',
      nuevoProyecto: proy === NUEVO ? nuevoProy.trim() : '', nuevoProyEmoji: nuevoEmoji,
      argumento: '', deadline, fijarPrioridad: ponerPrio,
    }).catch((e) => { setErr(e instanceof Error ? e.message : String(e)); return null; });
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* no-op */ }
    if (!r) { setCreando(false); return; }
    onDone(r.id);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 20px 20px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: '1px solid var(--border)' }}>
          <GuardianIcon size={22} />
          <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>Nueva tarea</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 21, lineHeight: 1, cursor: 'pointer', padding: '2px 4px' }}>×</button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* TÍTULO — lo único obligatorio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && puedeCrear) void crear(); }}
              placeholder="¿Qué hay que hacer?"
              style={{ flex: 1, padding: '12px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 15.5, outline: 'none', fontFamily: SANS }} />
            <BotonDictar titulo="Dictar el título" onTexto={(t) => setTitle((v) => (v ? `${v} ${t}` : t))} onError={setErr} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 220px', minWidth: 0 }}>
              <span style={rotulo}>Proyecto</span>
              <select value={proy} onChange={(e) => setProy(e.target.value)} style={campo}>
                <option value="">Sin proyecto</option>
                {labels.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
                <option value={NUEVO}>＋ Proyecto nuevo…</option>
              </select>
            </label>
            <label style={{ flex: '0 1 190px' }}>
              <span style={rotulo}>Para cuándo</span>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={campo} />
            </label>
          </div>

          {proy === NUEVO && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <EmojiPickerMini value={nuevoEmoji} onPick={setNuevoEmoji} />
              <input value={nuevoProy} onChange={(e) => setNuevoProy(e.target.value)} autoFocus placeholder="¿Cómo se llama el proyecto nuevo?"
                style={{ ...campo, border: '1px solid var(--primary)' }} />
            </div>
          )}

          <div>
            <span style={rotulo}>Detalle <span style={{ textTransform: 'none', letterSpacing: 0, fontFamily: SANS }}>(opcional)</span></span>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={3} placeholder="Contexto, alcance, criterio de listo…"
                style={{ ...campo, resize: 'vertical', lineHeight: 1.5 }} />
              <BotonDictar titulo="Dictar el detalle" onTexto={(t) => setDetalle((v) => (v ? `${v}\n${t}` : t))} onError={setErr} />
            </div>
          </div>

          {/* PRIORIDAD — opcional, y si la pones GANA */}
          {puedeFijarPrioridad && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13.5, color: 'var(--ink)' }}>
              <input type="checkbox" checked={ponerPrio} onChange={(e) => setPonerPrio(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
              Ponerle yo la prioridad
              <span style={{ fontSize: 12, color: 'var(--faint)' }}>{ponerPrio ? '· MaKo no la va a cambiar' : '· la decide MaKo'}</span>
            </label>
            {ponerPrio && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <input type="range" min={1} max={100} value={userScore} onChange={(e) => setUserScore(Number(e.target.value))} style={{ flex: 1, accentColor: PCOLOR[banda], cursor: 'pointer' }} aria-label="Prioridad, del 1 al 100" />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 15, fontWeight: 800, color: PCOLOR[banda] }}><ScoreIcon size={14} color={PCOLOR[banda]} />{userScore}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: PCOLOR[banda], textTransform: 'uppercase', letterSpacing: '.05em' }}>{PLABEL[banda]}</span>
              </div>
            )}
          </div>
          )}

          {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.4 }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '13px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>{ponerPrio ? 'MaKo le va a escribir el detalle igual.' : 'MaKo le pone la prioridad y la fecha si no se las pones.'}</span>
          <div style={{ display: 'flex', gap: 9 }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Cancelar</button>
            <button type="button" onClick={() => void crear()} disabled={!puedeCrear || creando} style={{ ...primaryBtn, opacity: !puedeCrear || creando ? 0.55 : 1, cursor: !puedeCrear || creando ? 'default' : 'pointer' }}>
              {creando ? 'Creando…' : 'Crear tarea'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * El botón de dictar. Graba, manda el audio a `/api/plan-dictado` y pega el texto.
 *
 * ⚠️ El texto se PEGA en el campo, no se usa para crear nada: lo que transcribe un modelo
 * se lee antes de que valga. Es la misma regla de «un canal propone, una persona confirma»,
 * en su versión más barata — acá la persona ya está mirando la pantalla.
 */
function BotonDictar({ titulo, onTexto, onError }: { titulo: string; onTexto: (t: string) => void; onError: (m: string) => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const rec = useVoiceRecorder(async (blob) => {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'nota.webm');
      const j = await fetch('/api/plan-dictado', { method: 'POST', body: fd }).then((r) => r.json());
      if (!j?.ok) { onError(String(j?.error || 'No pude transcribir el audio.')); return; }
      if (j.texto) onTexto(String(j.texto));
    } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
    finally { setSubiendo(false); }
  }, onError);

  const grabando = rec.recording;
  return (
    <button type="button"
      onClick={() => (grabando ? rec.stop(false) : void rec.start())}
      disabled={subiendo}
      title={subiendo ? 'Transcribiendo…' : grabando ? `Listo (${rec.secs}s) — soltar y transcribir` : titulo}
      aria-label={titulo}
      style={{
        flex: 'none', width: 42, height: 42, borderRadius: 11, cursor: subiendo ? 'wait' : 'pointer',
        border: `1px solid ${grabando ? 'var(--bad)' : 'var(--border-strong)'}`,
        background: grabando ? 'var(--bad)' : 'var(--surface)',
        color: grabando ? '#fff' : 'var(--dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {subiendo
        ? <span style={{ fontSize: 11, fontFamily: MONO }}>…</span>
        : grabando
          ? <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700 }}>{rec.secs}s</span>
          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>}
    </button>
  );
}

const rotulo: CSSProperties = { display: 'block', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 };
const campo: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, outline: 'none', fontFamily: SANS };
const primaryBtn: CSSProperties = { padding: '10px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
