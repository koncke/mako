'use client';

// =============================================================================
// Las preguntas de un chat, ARRIBA de su caja y de a una: como el formulario de preguntas de Claude (22/10/2026)
// =============================================================================
// Martín, con captura del chat «Cerebro»: «Las decisiones deben salir como en Claude, un bloque arriba del chat con las
// opciones, y tipo form de 1 pregunta, respondo 1 y va a la siguiente...». Hasta ese día cada pregunta de un chat (la de
// `cartero preguntar` y la de botones del cierre con wrap_up) era una tarjeta DENTRO del hilo (PreguntaChat.tsx), y la que
// el chat dejaba atrás quedaba ahí con «Ya no espera tu respuesta».
//   · un bloque fijo arriba de la caja (no en el hilo) mientras el chat espera respuestas: la pregunta, sus opciones
//     numeradas (la recomendada primera y marcada) y el renglón libre «Escribe otra cosa»;
//   · con varias, una por vez: «2 de 3», «Atrás» para volver, y al final el repaso con todo lo elegido y «Enviar»;
//     con una sola, tocar una opción la manda (como Claude);
//   · al mandar, cada respuesta sale FIRMADA por el camino de siempre (useCentro.ts → contestarPregunta, una por pregunta, en
//     orden) y en el hilo queda como un mensaje de Martín: «Decisión: …» con la pregunta citada (Hilo.tsx).
// En la computadora y en el teléfono (Conversacion.tsx y ChatsMovil.tsx lo montan igual); en el teléfono los renglones tienen
// el alto de un dedo (centro.css, `pointer: coarse`).
//
// ⚠️ LA PREGUNTA SE SIGUE POR SU ID: el refresco puede sacar una (contestada en otro lado) o sumar otra mientras se responde.
// ⚠️ ESTO NO ESCRIBE EN LA BASE: dice qué se eligió; firmar y marcar es del motor (useCentro.ts).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { conFormato } from '@/app/_components/Markdown';
import { eleccionValida, opcionesEnOrden, resumenDeRespuesta, type PreguntaChat } from '@/lib/centro-preguntas-chat';
import type { Responder } from './PreguntaChat';
import { AvisoClave } from '@/app/_chat/AvisoClave';
import { AVISO_CLAVE_EN_EL_CENTRO, hayClave } from '@/lib/claves-en-el-chat';

type Elegido = { elegidas: number[]; otra: string };

export function PreguntasDelChat({ preguntas, onResponder }: {
  /** Las que este chat espera (abiertas y sin una respuesta en camino), la más vieja primero: `preguntasParaElBloque`. */
  preguntas: readonly PreguntaChat[];
  onResponder: Responder;
}) {
  const [idActual, setIdActual] = useState<string | null>(null);
  const [repaso, setRepaso] = useState(false);
  const [elegidos, setElegidos] = useState<Record<string, Elegido>>({});
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [otra, setOtra] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const pos = Math.max(0, preguntas.findIndex((p) => p.id === idActual));
  const p = preguntas[pos] ?? null;
  const varias = preguntas.length > 1;
  const ops = useMemo(() => (p ? opcionesEnOrden(p) : []), [p]);

  // Al llegar a una pregunta, lo que ya se había elegido en ella (al volver con «Atrás») o nada.
  useEffect(() => {
    if (!p) return;
    const ya = elegidos[p.id];
    setMarcadas(ya?.elegidas ?? []);
    setOtra(ya?.otra ?? '');
    setError(null);
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;

  const ir = (i: number) => { setRepaso(false); setIdActual(preguntas[Math.min(preguntas.length - 1, Math.max(0, i))]?.id ?? null); };

  async function enviar(todo: Record<string, Elegido>) {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    // En orden y de a una: cada una sale firmada por su lado. Si una falla, las que salieron ya están y el resto queda acá.
    for (const q of preguntas) {
      const e = todo[q.id];
      if (!e) continue;
      const mal = await onResponder(q, e.elegidas, e.otra);
      if (mal) { setError(`«${q.pregunta.slice(0, 60)}»: ${mal}`); setEnviando(false); return; }
    }
    setEnviando(false);
    setElegidos({});
    setRepaso(false);
    setIdActual(null);
  }

  /** Lo elegido en ESTA pregunta: con una sola pregunta sale ya; con varias, pasa a la siguiente o al repaso. */
  function guardar(elegidas: number[], texto: string) {
    if (!p) return;
    const v = eleccionValida(p, elegidas, texto);
    if (!v.ok) { setError(v.error); return; }
    // Una clave en «Otra» no sale (22/10/2026, la de Apify): se pega en /integraciones.
    if (v.otra && hayClave(v.otra)) { setError(AVISO_CLAVE_EN_EL_CENTRO); return; }
    const todo = { ...elegidos, [p.id]: { elegidas: v.elegidas, otra: v.otra ?? '' } };
    setElegidos(todo);
    if (!varias) { void enviar(todo); return; }
    if (pos + 1 < preguntas.length) ir(pos + 1); else setRepaso(true);
  }
  const tocar = (i: number) => {
    if (enviando) return;
    if (!p.varias) { guardar([i], ''); return; }
    setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));
    setError(null);
  };
  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    if (repaso || enviando || e.target === campo.current) return;
    if (/^[1-9]$/.test(e.key)) {
      const o = ops[Number(e.key) - 1];
      if (o) { e.preventDefault(); tocar(o.i); } else if (Number(e.key) === ops.length + 1) { e.preventDefault(); campo.current?.focus(); }
    }
  }

  // ── El repaso: todo lo elegido, para cambiar algo o mandarlo ──
  if (repaso) {
    return (
      <div className="co-preg co-preg--arriba" role="group" aria-label="Tus respuestas">
        <div className="co-preg__cab">
          <span className="co-preg__texto">Tus respuestas</span>
          <span className="co-preg__paso">{`${preguntas.length} de ${preguntas.length}`}</span>
        </div>
        <ol className="co-preg__ops">
          {preguntas.map((q, i) => {
            const e = elegidos[q.id];
            return (
              <li key={q.id}>
                <button type="button" className="co-preg__op" disabled={enviando} onClick={() => ir(i)} aria-label={`Cambiar: ${q.pregunta}`}>
                  <span className="co-preg__num" aria-hidden>{i + 1}</span>
                  <span className="co-preg__op-txt">
                    <span className="co-preg__detalle">{q.pregunta}</span>
                    <span className="co-preg__titulo">{e ? resumenDeRespuesta(q, { elegidas: e.elegidas, otra: e.otra || null }) : 'Sin responder'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="co-preg__pie co-preg__pie--chat">
          {error ? <span className="co-preg__error" role="alert">{error}</span> : <span className="co-preg__ayuda">Toca una para cambiarla</span>}
          <span className="co-preg__acciones">
            <button type="button" className="co-chip" disabled={enviando} onClick={() => ir(preguntas.length - 1)}>Atrás</button>
            <button type="button" className="co-chip co-chip--primario" disabled={enviando || preguntas.some((q) => !elegidos[q.id])}
              onClick={() => void enviar(elegidos)}>
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </span>
        </div>
      </div>
    );
  }

  // ── Una pregunta ──
  const elegida = (i: number) => marcadas.includes(i);
  return (
    <div className="co-preg co-preg--arriba" role="group" aria-label={`Pregunta: ${p.pregunta}`} onKeyDown={tecla}>
      {varias && (
        <div className="co-preg__cab">
          {pos > 0 && <button type="button" className="co-chip" disabled={enviando} onClick={() => ir(pos - 1)}>Atrás</button>}
          <span className="co-preg__paso">{`${pos + 1} de ${preguntas.length}`}</span>
        </div>
      )}
      <p className="co-preg__texto">{conFormato(p.pregunta, 'pq')}</p>
      {p.contexto && <p className="co-preg__contexto">{conFormato(p.contexto, 'pc')}</p>}
      <ol className="co-preg__ops">
        {ops.map((o, n) => (
          <li key={o.i}>
            <button type="button" className="co-preg__op" disabled={enviando} data-elegida={elegida(o.i) ? 'true' : undefined}
              aria-pressed={p.varias ? elegida(o.i) : undefined} onClick={() => tocar(o.i)}>
              <span className={`co-preg__num${p.varias ? ' co-preg__num--caja' : ''}`} aria-hidden>{n + 1}</span>
              <span className="co-preg__op-txt">
                <span className="co-preg__titulo">{o.titulo}{o.recomendada && <span className="co-preg__rec"> (Recomendada)</span>}</span>
                {o.detalle && <span className="co-preg__detalle">{conFormato(o.detalle, `pd${n}`)}</span>}
              </span>
            </button>
          </li>
        ))}
        <li>
          <label className="co-preg__op co-preg__op--otra">
            <span className="co-preg__num" aria-hidden>{ops.length + 1}</span>
            <input ref={campo} className="co-preg__campo" value={otra} maxLength={1000} disabled={enviando}
              onChange={(e) => { setOtra(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && otra.trim()) { e.preventDefault(); guardar(p.varias ? marcadas : [], otra); } }}
              placeholder="Escribe otra cosa" aria-label="Escribe otra respuesta" />
          </label>
          {hayClave(otra) && <AvisoClave />}
        </li>
      </ol>
      <div className="co-preg__pie co-preg__pie--chat">
        {error ? <span className="co-preg__error" role="alert">{error}</span>
          : <span className="co-preg__ayuda">{p.varias ? 'Elige una o varias' : `Elige con 1 a ${ops.length + 1}`}</span>}
        {(p.varias || otra.trim()) && (
          <button type="button" className="co-chip co-chip--primario" disabled={enviando || (!marcadas.length && !otra.trim())}
            onClick={() => guardar(p.varias ? marcadas : [], otra)}>
            {enviando ? 'Enviando…' : varias ? (pos + 1 < preguntas.length ? 'Siguiente' : 'Repasar') : 'Responder'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Las que el chat le hizo a Martín con AskUserQuestion en la app de Claude (cartero 1.18.0, origen `ask`): se VEN acá, en el
 * mismo bloque y de a una, pero se contestan en la app. Medido el 22/10: mientras esperan, al chat no le entra ningún mensaje,
 * así que una respuesta firmada desde acá no lo destraba (lib/centro-preguntas-chat.ts → seContestaEnLaApp). La regla para los
 * chats es preguntar con `cartero preguntar` (AGENTS.md).
 */
export function PreguntasDeLaApp({ preguntas }: { preguntas: readonly PreguntaChat[] }) {
  const [pos, setPos] = useState(0);
  const p = preguntas[Math.min(pos, preguntas.length - 1)] ?? null;
  if (!p) return null;
  const i = preguntas.indexOf(p);
  return (
    <div className="co-preg co-preg--arriba co-preg--app" role="group" aria-label={`Pregunta en la app de Claude: ${p.pregunta}`}>
      {preguntas.length > 1 && (
        <div className="co-preg__cab">
          {i > 0 && <button type="button" className="co-chip" onClick={() => setPos(i - 1)}>Atrás</button>}
          <span className="co-preg__paso">{`${i + 1} de ${preguntas.length}`}</span>
          {i + 1 < preguntas.length && <button type="button" className="co-chip" onClick={() => setPos(i + 1)}>Siguiente</button>}
        </div>
      )}
      <p className="co-preg__texto">{conFormato(p.pregunta, 'pq')}</p>
      {p.contexto && <p className="co-preg__contexto">{conFormato(p.contexto, 'pc')}</p>}
      <ol className="co-preg__ops">
        {opcionesEnOrden(p).map((o, n) => (
          <li key={o.i}>
            <p className="co-preg__op co-preg__op--leer">
              <span className={`co-preg__num${p.varias ? ' co-preg__num--caja' : ''}`} aria-hidden>{n + 1}</span>
              <span className="co-preg__op-txt">
                <span className="co-preg__titulo">{o.titulo}{o.recomendada && <span className="co-preg__rec"> (Recomendada)</span>}</span>
                {o.detalle && <span className="co-preg__detalle">{conFormato(o.detalle, `pd${n}`)}</span>}
              </span>
            </p>
          </li>
        ))}
      </ol>
      <p className="co-preg__pie">Te la hizo en la app de Claude: contéstala ahí. Mientras, el chat espera.</p>
    </div>
  );
}
