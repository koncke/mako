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
//
// ⚠️ Y EL 23/09/2026, MIRANDO LA PANTALLA: «la opción de nueva tarea debe estar con un form
// modular, como antes… solo que no tenga tanta fricción. Es mejor que MaKo - Perro guardián
// le asigne la prioridad y el proyecto correspondiente y le escriba la descripción, si eso
// ya se hace hoy en día: reutilizar la lógica».
//
// Así que lo que se ve al abrir es UNA pregunta —¿qué hay que hacer?— y nada más. Proyecto,
// fecha y detalle viven detrás de «Agregar detalles», plegado: son la excepción, no el
// formulario. Y LA CASILLA DE PRIORIDAD SE FUE: era un slider en un alta, o sea pedirle a
// alguien que puntúe del 1 al 100 algo que todavía no escribió. La pone el Perro en la
// misma corrida en la que escribe el detalle y elige el proyecto; si se equivoca, se cambia
// con el lápiz del panel, que es un click.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useVoiceRecorder } from '@/app/whatsapp/_shared/VoiceRecorder';
import { useDictadoVivo, unirDictado } from './dictado-vivo';
import { GuardianIcon } from './GuardianIcon';
import { type Prio, scoreFromPrio } from './types';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";
const DRAFT_KEY = 'mako_draft_tarea';

export type CrearResult = { id: string; score: number; prio: Prio; razon: string; respuesta: string } | null;
export type CrearData = {
  title: string; detalle: string; labelIds: string[]; userScore: number;
  motivoNinguno: string; nuevoProyecto: string; nuevoProyEmoji: string; argumento: string;
  /** cuándo vence (ISO). Vacío = que la ponga el Perro. */
  deadline: string;
  /** la prioridad la puso la PERSONA: se fija a mano y el Perro no la pisa */
  fijarPrioridad: boolean;
};

export function CrearTareaModal({ proyectoInicial, prioInicial, onCrear, onDone, onClose }: {
  proyectoInicial: string | null; prioInicial: Prio | null;
  /** las tareas del plan con su score, para comparar al elegir el número (no se usa hoy) */
  ejemplos?: Array<{ title: string; score: number }>;
  onCrear: (data: CrearData) => Promise<CrearResult>; onDone: (id: string) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  // Lo que el alta ya no pregunta. Viaja vacío y lo resuelve el Perro; `proyectoInicial`
  // sigue llegando (se abre desde la cabecera de una columna o desde un proyecto) y por eso
  // se respeta cuando está: es un dato, no una pregunta.
  const detalle = '';
  const proy = proyectoInicial ?? '';
  const deadline = '';
  // Abrir el alta desde la cabecera de una columna sigue SUGIRIENDO esa banda —es una pista
  // de dónde la vio quien la está cargando—, pero ya no la fija nadie a mano: viaja como
  // sugerencia declarada al Perro, que la puntúa contra el resto del plan y puede ignorarla.
  const sugerido = prioInicial ? scoreFromPrio[prioInicial] : 0;
  const [creando, setCreando] = useState(false);
  const [err, setErr] = useState('');
  const [restored, setRestored] = useState(false);

  // BORRADOR: lo que escribiste sobrevive a cerrar el modal sin querer. Ahora es UN campo,
  // así que el borrador es una línea — pero sigue existiendo: cerrar sin querer un modal
  // donde acabás de dictar treinta segundos de audio es la peor forma de perderlo.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (typeof d.title === 'string') setTitle(d.title);
      }
    } catch { /* storage bloqueado */ }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title })); } catch { /* idem */ }
  }, [restored, title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const puedeCrear = title.trim().length > 0;

  const crear = async () => {
    if (!puedeCrear || creando) return;
    setCreando(true);
    setErr('');
    const r = await onCrear({
      title: title.trim(), detalle: detalle.trim(),
      labelIds: proy ? [proy] : [],
      userScore: sugerido, motivoNinguno: '',
      // Un proyecto NUEVO ya no se abre desde acá: tiene su propia alta, que es una
      // decisión y no un campo de un formulario de tareas.
      nuevoProyecto: '', nuevoProyEmoji: '🏷',
      argumento: '', deadline, fijarPrioridad: false,
    }).catch((e) => { setErr(e instanceof Error ? e.message : String(e)); return null; });
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* no-op */ }
    if (!r) { setCreando(false); return; }
    onDone(r.id);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 20px 20px', fontFamily: SANS }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px 0' }}>
          <GuardianIcon size={20} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Nueva tarea</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '2px 4px' }}>×</button>
        </div>

        {/* UNA PREGUNTA. Y NADA MÁS. «No quiero la opción de agregar detalles, ni en
            proyecto ni en tareas» (23/09/2026). Lo que había detrás de ese plegable
            —proyecto, fecha y descripción— lo escribe el Perro en la misma corrida: el
            proyecto lo rutea contra el catálogo cerrado, el detalle lo arma con el contrato
            de cuatro partes y la fecha la propone. Y si se equivoca, la tarjeta se abre sola
            acá al lado para corregirlo, que es un click contra los cuatro campos de antes. */}
        <div style={{ padding: '14px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && puedeCrear) void crear(); }}
              placeholder="¿Qué hay que hacer?"
              style={{ flex: 1, minWidth: 0, padding: '13px 0', border: 'none', borderBottom: '2px solid var(--border)', background: 'transparent', color: 'var(--ink)', fontSize: 19, outline: 'none', fontFamily: SANS }}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--primary)'; }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)'; }} />
            <BotonDictar titulo="Dictar la tarea" valor={title} onValor={setTitle} onError={setErr} />
          </div>
          {err && <div style={{ fontSize: 12.5, color: 'var(--bad)', lineHeight: 1.4, marginTop: 10 }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '0 20px 18px' }}>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>MaKo le pone el proyecto, la prioridad y el detalle.</span>
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
 * El botón de dictar. En vivo si el navegador puede; si no, graba y transcribe.
 *
 * ⚠️ DOS CAMINOS, Y EL RÁPIDO ES EL DEL NAVEGADOR. «Se tarda mucho en procesar la
 * transcripción de lo que digo, cuando en otras apps es casi que inmediato» (23/09/2026):
 * grabar → parar → subir → esperar a un modelo son varios segundos DESPUÉS de terminar de
 * hablar, y hasta ahí no aparece una sola letra. El reconocimiento del navegador corre
 * local, escribe mientras hablás y no cuesta nada (`dictado-vivo.ts`).
 *
 * El camino viejo queda como respaldo y no es decorativo: Firefox no trae la API, y si el
 * micrófono está bloqueado el dictado en vivo ni siquiera arranca.
 *
 * ⚠️ El texto se PEGA en el campo, no se usa para crear nada: lo que transcribe un modelo
 * —o un reconocedor— se lee antes de que valga. Es «un canal propone, una persona confirma»
 * en su versión más barata: acá la persona ya está mirando la pantalla.
 */
export function BotonDictar({ titulo, valor, onValor, onError }: {
  titulo: string;
  /** lo que hay escrito AHORA: lo dictado se pega atrás, no lo reemplaza */
  valor: string;
  onValor: (v: string) => void;
  onError: (m: string) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  // El texto que había ANTES de arrancar a dictar. Cada parcial reescribe el campo entero
  // con `base + loDictado`, porque el reconocedor corrige lo que ya dijo: acumular los
  // parciales duplicaría media frase cada vez que cambia de opinión.
  const base = useRef('');
  const vivo = useDictadoVivo(
    (texto) => onValor(unirDictado(base.current, texto)),
    onError,
  );

  const rec = useVoiceRecorder(async (blob) => {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'nota.webm');
      // ⚠️ CON SEÑAL DE CORTE (AGENTS.md): un `fetch` sin `signal` con la conexión caída no
      // resuelve NUNCA, y acá eso dejaba el botón deshabilitado para siempre — el `finally`
      // no llega a correr.
      const j = await fetch('/api/plan-dictado', { method: 'POST', body: fd, signal: AbortSignal.timeout(90_000) }).then((r) => r.json());
      if (!j?.ok) { onError(String(j?.error || 'No pude transcribir el audio.')); return; }
      if (j.texto) onValor(unirDictado(valor, String(j.texto)));
    } catch (e) {
      onError(e instanceof Error && e.name === 'TimeoutError'
        ? 'La transcripción tardó demasiado. Escríbelo a mano o prueba de nuevo.'
        : e instanceof Error ? e.message : String(e));
    }
    finally { setSubiendo(false); }
  }, onError);

  const escuchando = vivo.soportado ? vivo.escuchando : rec.recording;
  const alternar = () => {
    if (vivo.soportado) {
      if (vivo.escuchando) vivo.parar();
      else { base.current = valor; vivo.arrancar(); }
      return;
    }
    if (rec.recording) rec.stop(false); else void rec.start();
  };

  return (
    <button type="button"
      onClick={alternar}
      disabled={subiendo}
      title={subiendo ? 'Transcribiendo…' : escuchando ? (vivo.soportado ? 'Te escucho — toca para terminar' : `Listo (${rec.secs}s) — soltar y transcribir`) : titulo}
      aria-label={titulo}
      style={{
        flex: 'none', width: 42, height: 42, borderRadius: 11, cursor: subiendo ? 'wait' : 'pointer',
        border: `1px solid ${escuchando ? 'var(--bad)' : 'var(--border-strong)'}`,
        background: escuchando ? 'var(--bad)' : 'var(--surface)',
        color: escuchando ? '#fff' : 'var(--dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Late mientras escucha: es la única señal de que el micrófono está abierto.
        animation: escuchando ? 'mkEscucha 1.2s ease-in-out infinite' : 'none',
      }}>
      <style>{'@keyframes mkEscucha{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--bad) 45%, transparent)}70%{box-shadow:0 0 0 7px transparent}}'}</style>
      {subiendo
        ? <span style={{ fontSize: 11, fontFamily: MONO }}>…</span>
        : escuchando && !vivo.soportado
          ? <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700 }}>{rec.secs}s</span>
          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>}
    </button>
  );
}

const primaryBtn: CSSProperties = { padding: '10px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
const ghostBtn: CSSProperties = { padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: SANS };
