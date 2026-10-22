'use client';

// =============================================================================
// Las preguntas de un chat, ARRIBA de su caja y de a una: como el formulario de preguntas de Claude (22/10/2026)
// =============================================================================
// Martín, con captura del chat «Cerebro»: «Las decisiones deben salir como en Claude, un bloque arriba del chat con las
// opciones, y tipo form de 1 pregunta, respondo 1 y va a la siguiente...». Hasta ese día cada pregunta de un chat (la de
// `cartero preguntar` y la de botones del cierre con wrap_up) era una tarjeta DENTRO del hilo (PreguntaChat.tsx), y la que
// el chat dejaba atrás quedaba ahí con «Ya no espera tu respuesta».
//   · una tarjeta FLOTANTE arriba de la caja (no en el hilo) mientras el chat espera respuestas: la pregunta, sus opciones
//     numeradas (la recomendada primera y marcada) y el renglón libre «Escribe otra cosa»;
//   · con varias, una por vez: «2 de 3», «‹ Anterior», «Siguiente ›» y los puntos para ir a cualquiera; se mandan TODAS al
//     contestar la última (sin pantalla de resumen); con una sola, tocar una opción la manda (como Claude);
//   · al mandar, cada respuesta sale FIRMADA por el camino de siempre (useCentro.ts → contestarPregunta, una por pregunta, en
//     orden) y en el hilo queda como un mensaje de Martín: «Decisión: …» con la pregunta citada (Hilo.tsx).
// AJUSTES DE MARTÍN (22/10/2026, ya usándolo, con captura): «Que no se ponga con el fondo blanco, que sea un bloque flotante»
// (centro.css: el pie de la caja tiene el fondo del chat), «Falta un desplegable, una flecha o algo para ocultarlo» (la flecha
// lo pliega a una tira; se recuerda por chat y por las preguntas que espera: una pregunta nueva lo abre), «Tienes que ser capaz
// de poner links» (también sin https: lib/links-texto.ts → conDominiosComoLinks) y «al final salió como un resumen de todo.
// No debería, pero sí debería poder ver unos botones o algo para volver a la pregunta anterior».
// En la computadora y en el teléfono (Conversacion.tsx y ChatsMovil.tsx lo montan igual); en el teléfono los renglones tienen
// el alto de un dedo (centro.css, `pointer: coarse`).
//
// ⚠️ LA PREGUNTA SE SIGUE POR SU ID: el refresco puede sacar una (contestada en otro lado) o sumar otra mientras se responde.
// ⚠️ ESTO NO ESCRIBE EN LA BASE: dice qué se eligió; firmar y marcar es del motor (useCentro.ts).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { conFormato } from '@/app/_components/Markdown';
import { eleccionValida, opcionesEnOrden, type PreguntaChat } from '@/lib/centro-preguntas-chat';
import { conDominiosComoLinks } from '@/lib/links-texto';
import type { Responder } from './PreguntaChat';
import { AvisoClave } from '@/app/_chat/AvisoClave';
import { AVISO_CLAVE_EN_EL_CENTRO, hayClave } from '@/lib/claves-en-el-chat';

type Elegido = { elegidas: number[]; otra: string };

// ⚠️ LAS DOS TARJETAS SON LA MISMA PIEZA EN LO QUE SE VE (22/10/2026): las decisiones de la Ticketera (Pregunta.tsx) usan
// `conLinks`, `usePlegado`, `Plegada` y `Plegar` de acá. Hasta ese día los ajustes de Martín estaban sólo en ésta, y la de
// «Cuesta dinero» del chat Infra seguía sin flotar, sin flecha y con links que no se tocaban.

/** Un texto del bloque con su formato y sus links clickeables, también los que vienen sin https («aistudio.google.com/apikey»). */
export const conLinks = (texto: string, k: string): ReactNode => conFormato(conDominiosComoLinks(texto), k);

/** Plegado, por chat y por las preguntas que espera: si llega una nueva, se abre solo. En el navegador: si no hay, abierto. */
const CLAVE_PLEGADO = 'ops.preguntas.plegado.';
const firmaDe = (preguntas: ReadonlyArray<{ id: string | number }>) => preguntas.map((p) => p.id).join(',');
export function usePlegado(chat: string, preguntas: ReadonlyArray<{ id: string | number }>): [boolean, (v: boolean) => void] {
  const firma = firmaDe(preguntas);
  const [plegado, setPlegado] = useState(false);
  useEffect(() => {
    try { setPlegado(window.localStorage.getItem(CLAVE_PLEGADO + chat) === firma); } catch { setPlegado(false); }
  }, [chat, firma]);
  const poner = (v: boolean) => {
    setPlegado(v);
    try { if (v) window.localStorage.setItem(CLAVE_PLEGADO + chat, firma); else window.localStorage.removeItem(CLAVE_PLEGADO + chat); } catch { /* sin almacenamiento, sólo en esta pestaña */ }
  };
  return [plegado, poner];
}
const esperando = (n: number) => (n === 1 ? '1 pregunta esperando' : `${n} preguntas esperando`);

/** La tira plegada: cuántas esperan, y la flecha para abrir. */
export function Plegada({ n, onAbrir, app = false }: { n: number; onAbrir: () => void; app?: boolean }) {
  return (
    <button type="button" className={`co-preg co-preg--arriba co-preg--plegada${app ? ' co-preg--app' : ''}`} onClick={onAbrir} aria-expanded={false}>
      <span>{esperando(n)}</span><span className="co-preg__flecha" aria-hidden>▴</span>
    </button>
  );
}

/** La flecha para plegar, arriba a la derecha de la tarjeta. */
export const Plegar = ({ onPlegar }: { onPlegar: () => void }) => (
  <button type="button" className="co-preg__plegar" onClick={onPlegar} aria-expanded aria-label="Ocultar las preguntas" title="Ocultar">
    <span aria-hidden>▾</span>
  </button>
);

/** «‹ Anterior», los puntos (uno por pregunta: se toca para ir) y «Siguiente ›». */
function Pasos({ preguntas, pos, ir, contestada, enviando }: {
  preguntas: readonly PreguntaChat[]; pos: number; ir: (i: number) => void; contestada: (id: string) => boolean; enviando?: boolean;
}) {
  return (
    <div className="co-preg__pasos">
      <button type="button" className="co-chip" disabled={enviando || pos === 0} onClick={() => ir(pos - 1)}>‹ Anterior</button>
      <span className="co-preg__puntos" role="group" aria-label={`${pos + 1} de ${preguntas.length}`}>
        {preguntas.map((q, i) => (
          <button key={q.id} type="button" className="co-preg__punto" disabled={enviando} onClick={() => ir(i)}
            aria-label={`Pregunta ${i + 1}${contestada(q.id) ? ' (contestada)' : ''}`} aria-current={i === pos ? 'step' : undefined}
            data-contestada={contestada(q.id) ? 'true' : undefined} />
        ))}
      </span>
      <span className="co-preg__paso">{`${pos + 1} de ${preguntas.length}`}</span>
      <button type="button" className="co-chip" disabled={enviando || pos + 1 >= preguntas.length} onClick={() => ir(pos + 1)}>Siguiente ›</button>
    </div>
  );
}

export function PreguntasDelChat({ chat, preguntas, onResponder }: {
  /** El chat (su clave en el Ops Center): para recordar si el bloque está plegado. */
  chat: string;
  /** Las que este chat espera (abiertas y sin una respuesta en camino), la más vieja primero: `preguntasParaElBloque`. */
  preguntas: readonly PreguntaChat[];
  onResponder: Responder;
}) {
  const [idActual, setIdActual] = useState<string | null>(null);
  const [elegidos, setElegidos] = useState<Record<string, Elegido>>({});
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [otra, setOtra] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plegado, setPlegado] = usePlegado(chat, preguntas);
  const campo = useRef<HTMLInputElement>(null);

  const pos = Math.max(0, preguntas.findIndex((p) => p.id === idActual));
  const p = preguntas[pos] ?? null;
  const varias = preguntas.length > 1;
  const ops = useMemo(() => (p ? opcionesEnOrden(p) : []), [p]);

  // Al llegar a una pregunta, lo que ya se había elegido en ella (al volver con «‹ Anterior» o un punto) o nada.
  useEffect(() => {
    if (!p) return;
    const ya = elegidos[p.id];
    setMarcadas(ya?.elegidas ?? []);
    setOtra(ya?.otra ?? '');
    setError(null);
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;
  if (plegado) return <Plegada n={preguntas.length} onAbrir={() => setPlegado(false)} />;

  const ir = (i: number) => setIdActual(preguntas[Math.min(preguntas.length - 1, Math.max(0, i))]?.id ?? null);
  const contestada = (id: string) => !!elegidos[id];

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
    setIdActual(null);
  }

  /** Lo elegido en ESTA pregunta: con una sola sale ya; con varias, pasa a la siguiente y, en la última, salen TODAS (si falta
   *  alguna de antes, va a ésa). Nunca hay una pantalla de resumen. */
  function guardar(elegidas: number[], texto: string) {
    if (!p) return;
    const v = eleccionValida(p, elegidas, texto);
    if (!v.ok) { setError(v.error); return; }
    // Una clave en «Otra» no sale (22/10/2026, la de Apify): se pega en /integraciones.
    if (v.otra && hayClave(v.otra)) { setError(AVISO_CLAVE_EN_EL_CENTRO); return; }
    const todo = { ...elegidos, [p.id]: { elegidas: v.elegidas, otra: v.otra ?? '' } };
    setElegidos(todo);
    if (!varias) { void enviar(todo); return; }
    if (pos + 1 < preguntas.length) { ir(pos + 1); return; }
    const falta = preguntas.findIndex((q) => !todo[q.id]);
    if (falta >= 0) ir(falta); else void enviar(todo);
  }
  const tocar = (i: number) => {
    if (enviando) return;
    if (!p.varias) { guardar([i], ''); return; }
    setMarcadas((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));
    setError(null);
  };
  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    if (enviando || e.target === campo.current) return;
    if (/^[1-9]$/.test(e.key)) {
      const o = ops[Number(e.key) - 1];
      if (o) { e.preventDefault(); tocar(o.i); } else if (Number(e.key) === ops.length + 1) { e.preventDefault(); campo.current?.focus(); }
    }
  }

  const elegida = (i: number) => marcadas.includes(i);
  const ultima = pos + 1 >= preguntas.length;
  return (
    <div className="co-preg co-preg--arriba" role="group" aria-label={`Pregunta: ${p.pregunta}`} onKeyDown={tecla}>
      <div className="co-preg__cab">
        {varias ? <Pasos preguntas={preguntas} pos={pos} ir={ir} contestada={contestada} enviando={enviando} />
          : <span className="co-preg__paso">{esperando(1)}</span>}
        <Plegar onPlegar={() => setPlegado(true)} />
      </div>
      <p className="co-preg__texto">{conLinks(p.pregunta, 'pq')}</p>
      {p.contexto && <p className="co-preg__contexto">{conLinks(p.contexto, 'pc')}</p>}
      <ol className="co-preg__ops">
        {ops.map((o, n) => (
          <li key={o.i}>
            {/* Un `div` con rol de botón y no un <button>: el detalle puede traer un link, y un link adentro de un botón no se
                abre (HTML no lo deja). Tocar el link lo abre SIN elegir la opción; Enter o espacio la eligen. */}
            <div role="button" tabIndex={enviando ? -1 : 0} aria-disabled={enviando || undefined} className="co-preg__op"
              data-elegida={elegida(o.i) ? 'true' : undefined} aria-pressed={p.varias ? elegida(o.i) : undefined}
              onClick={(e) => { if (!enviando && !(e.target as HTMLElement).closest('a')) tocar(o.i); }}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !enviando) { e.preventDefault(); tocar(o.i); } }}>
              <span className={`co-preg__num${p.varias ? ' co-preg__num--caja' : ''}`} aria-hidden>{n + 1}</span>
              <span className="co-preg__op-txt">
                <span className="co-preg__titulo">{o.titulo}{o.recomendada && <span className="co-preg__rec"> (Recomendada)</span>}</span>
                {o.detalle && <span className="co-preg__detalle">{conLinks(o.detalle, `pd${n}`)}</span>}
              </span>
            </div>
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
          : <span className="co-preg__ayuda">{p.varias ? 'Elige una o varias' : `Elige con 1 a ${ops.length + 1}`}{varias && ultima ? ' · con ésta salen todas' : ''}</span>}
        {(p.varias || otra.trim()) && (
          <button type="button" className="co-chip co-chip--primario" disabled={enviando || (!marcadas.length && !otra.trim())}
            onClick={() => guardar(p.varias ? marcadas : [], otra)}>
            {enviando ? 'Enviando…' : varias && !ultima ? 'Siguiente' : varias ? 'Enviar' : 'Responder'}
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
export function PreguntasDeLaApp({ chat, preguntas }: { chat: string; preguntas: readonly PreguntaChat[] }) {
  const [pos, setPos] = useState(0);
  const [plegado, setPlegado] = usePlegado(`app.${chat}`, preguntas);
  const p = preguntas[Math.min(pos, preguntas.length - 1)] ?? null;
  if (!p) return null;
  if (plegado) return <Plegada n={preguntas.length} onAbrir={() => setPlegado(false)} app />;
  const i = preguntas.indexOf(p);
  return (
    <div className="co-preg co-preg--arriba co-preg--app" role="group" aria-label={`Pregunta en la app de Claude: ${p.pregunta}`}>
      <div className="co-preg__cab">
        {preguntas.length > 1 ? <Pasos preguntas={preguntas} pos={i} ir={(n) => setPos(Math.min(preguntas.length - 1, Math.max(0, n)))} contestada={() => false} />
          : <span className="co-preg__paso">{esperando(1)}</span>}
        <Plegar onPlegar={() => setPlegado(true)} />
      </div>
      <p className="co-preg__texto">{conLinks(p.pregunta, 'pq')}</p>
      {p.contexto && <p className="co-preg__contexto">{conLinks(p.contexto, 'pc')}</p>}
      <ol className="co-preg__ops">
        {opcionesEnOrden(p).map((o, n) => (
          <li key={o.i}>
            <p className="co-preg__op co-preg__op--leer">
              <span className={`co-preg__num${p.varias ? ' co-preg__num--caja' : ''}`} aria-hidden>{n + 1}</span>
              <span className="co-preg__op-txt">
                <span className="co-preg__titulo">{o.titulo}{o.recomendada && <span className="co-preg__rec"> (Recomendada)</span>}</span>
                {o.detalle && <span className="co-preg__detalle">{conLinks(o.detalle, `pd${n}`)}</span>}
              </span>
            </p>
          </li>
        ))}
      </ol>
      <p className="co-preg__pie">Te la hizo en la app de Claude: contéstala ahí. Mientras, el chat espera.</p>
    </div>
  );
}
