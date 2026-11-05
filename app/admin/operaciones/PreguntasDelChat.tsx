'use client';

// =============================================================================
// EL BLOQUE de lo que espera a Martín, ARRIBA de la caja y de a una: como el formulario de preguntas de Claude (22/10/2026)
// =============================================================================
// Martín, con captura del chat «Cerebro»: «Las decisiones deben salir como en Claude, un bloque arriba del chat con las
// opciones, y tipo form de 1 pregunta, respondo 1 y va a la siguiente...». Hasta ese día cada pregunta de un chat (la de
// `cartero preguntar` y la de botones del cierre con wrap_up) era una tarjeta DENTRO del hilo (PreguntaChat.tsx), y la que
// el chat dejaba atrás quedaba ahí con «Ya no espera tu respuesta».
//   · una tarjeta FLOTANTE arriba de la caja (no en el hilo) mientras algo espera a Martín: la pregunta, sus opciones
//     numeradas (la recomendada primera y marcada) y el renglón libre «Escribe otra cosa»;
//   · con varias, una por vez: «2 de 3», las flechas ‹ › y los puntos para ir a cualquiera; sin pantalla de resumen;
//   · al mandar, cada respuesta sale FIRMADA por el camino de siempre (useCentro.ts → contestarPregunta, una por pregunta, en
//     orden) y en el hilo queda como un mensaje de Martín: «Decisión: …» con la pregunta citada (Hilo.tsx).
// AJUSTES DE MARTÍN (22/10/2026, ya usándolo, con captura): «Que no se ponga con el fondo blanco, que sea un bloque flotante»
// (centro.css: el pie de la caja tiene el fondo del chat), «Falta un desplegable, una flecha o algo para ocultarlo» (la flecha
// lo pliega a una tira; se recuerda por chat y por lo que espera: algo nuevo lo abre), «Tienes que ser capaz de poner links»
// (también sin https: bloque-texto.tsx → conLinks) y «al final salió como un resumen de todo. No debería, pero sí debería poder
// ver unos botones o algo para volver a la pregunta anterior».
// UN SOLO BLOQUE PARA LAS TRES FUENTES (22/10/2026, el Cerebro midiéndolo en producción: «Martín pide unificar siempre»). Arriba
// de la caja había TRES tarjetas, y los ajustes estaban sólo en la del chat. Ahora `BloqueDePreguntas` las junta en UNA lista
// (`itemsDelBloque`), con una flecha, un plegado y una navegación para todas, y cada una se contesta como siempre:
//   · una decisión de la Ticketera se GUARDA al elegirla (admin_decisiones: Pregunta.tsx → CuerpoTicketera);
//   · lo que pregunta el chat (`cartero preguntar`) sale TODO junto cuando está todo contestado (con una sola, al elegirla);
//   · lo de AskUserQuestion se ve, y se contesta en la app de Claude;
//   · lo que una TAB le pregunta a la persona (las sugerencias del CRM: «Hacerlo» / «Ahora no») corre lo que la tab dice al
//     elegirlo. Antes era una lista suelta arriba del hilo, con su propio scroll, que se comía la mitad del panel (22/10/2026,
//     Martín con captura del /crm: «Mira lo mal que se ve esto»). Entra por la estrella de cada tab (MakoEnLaTab → `preguntas`).
// En la computadora y en el teléfono (Conversacion.tsx y ChatsMovil.tsx lo montan igual); en el teléfono los renglones tienen
// el alto de un dedo (centro.css, `pointer: coarse`).
//
// ⚠️ LO QUE ESTÁ ABIERTO SE SIGUE POR SU ID: el refresco puede sacar una (contestada en otro lado) o sumar otra mientras se
//    responde, y lo escrito para una que se fue no pasa en silencio a la siguiente.
// ⚠️ ESTO NO ESCRIBE EN LA BASE: dice qué se eligió; firmar y marcar es del motor (useCentro.ts), y guardar una decisión, de la
//    acción de la Ticketera que pasa la página.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { eleccionValida, opcionesEnOrden, type PreguntaChat } from '@/lib/centro-preguntas-chat';
import { preguntaAbierta } from '@/lib/centro-preguntas';
import type { AccionResponder, Decision } from '@/app/admin/runway/decisiones';
import type { Responder } from './PreguntaChat';
import { CuerpoTicketera } from './Pregunta';
import { conLinks } from './bloque-texto';
import { AvisoClave } from '@/app/_chat/AvisoClave';
import { Icon } from '@/app/_components/icons';
import { AVISO_CLAVE_EN_EL_CENTRO, hayClave } from '@/lib/claves-en-el-chat';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { edadDe, haceAR } from '@/lib/centro-fechas';

type Elegido = { elegidas: number[]; otra: string };

/**
 * Lo que una TAB le pregunta a la persona (las sugerencias del CRM), para el bloque. Cada opción corre lo de la tab (`onElegir`)
 * o lleva a una pantalla (`href`). `ocupada`: la opción que está corriendo (su «…»); `quieta`: otra pregunta de la tab está
 * corriendo; `hecha`: ya se hizo (lo que se dice y dónde verlo).
 */
export type PreguntaDeLaTab = {
  id: string;
  pregunta: string;
  contexto?: string | null;
  opciones: ReadonlyArray<{ titulo: string; recomendada?: boolean; href?: string; onElegir?: () => void }>;
  ocupada?: number | null;
  quieta?: boolean;
  error?: string | null;
  hecha?: { texto: string; href?: string; rotulo?: string } | null;
};

/** Lo que espera a Martín arriba de la caja, de cualquiera de las fuentes. El id lleva la fuente: dos no se pisan. */
export type ItemDelBloque =
  | { de: 'ticketera'; id: string; d: Decision }
  | { de: 'chat'; id: string; p: PreguntaChat }
  | { de: 'tab'; id: string; q: PreguntaDeLaTab }
  | { de: 'app'; id: string; p: PreguntaChat };

/** Cuándo se hizo lo que espera (la Ticketera: cuando se publicó; un chat o la app: cuando preguntó). null = lo de una tab, que
 *  no tiene fecha (se calcula al mirar). */
export const fechaDeItem = (x: ItemDelBloque): string | null => (x.de === 'ticketera' ? x.d.creadaAt : x.de === 'tab' ? null : x.p.at);
const instanteDe = (x: ItemDelBloque): number => { const t = Date.parse(fechaDeItem(x) ?? ''); return Number.isFinite(t) ? t : 0; };

/**
 * Las fuentes en UNA lista, LA MÁS NUEVA PRIMERO (5/11/2026, Martín: le llegó para contestar una pregunta del 30/10 que ya no
 * importaba; «Las más nuevas primero, y que lo viejo no tape a lo de hoy»): la Ticketera, lo que pregunta el chat y lo de la app, que
 * acá sólo se lee, por su fecha; a igual fecha, en ese orden. Lo que pregunta la tab va al final (se ve aparte, en su tira).
 * ⚠️ El ORDEN DE ENTREGA no es éste: las respuestas del chat salen de la más vieja a la más nueva (`enviar`).
 */
export function itemsDelBloque(ticketera: readonly Decision[], delChat: readonly PreguntaChat[], deLaApp: readonly PreguntaChat[],
  deLaTab: readonly PreguntaDeLaTab[] = []): ItemDelBloque[] {
  const esperan: ItemDelBloque[] = [
    ...ticketera.map((d) => ({ de: 'ticketera' as const, id: `t:${d.id}`, d })),
    ...delChat.map((p) => ({ de: 'chat' as const, id: `c:${p.id}`, p })),
    ...deLaApp.map((p) => ({ de: 'app' as const, id: `a:${p.id}`, p })),
  ];
  // `sort` es estable: a igual fecha queda el orden de arriba (la Ticketera ya viene con la que frena primero).
  esperan.sort((a, b) => instanteDe(b) - instanteDe(a));
  return [...esperan, ...deLaTab.map((q) => ({ de: 'tab' as const, id: `s:${q.id}`, q }))];
}

/**
 * Las preguntas del chat en el orden en que se HICIERON (la más vieja primero): es el orden en que sus respuestas salen firmadas y
 * le llegan al chat (5/11/2026: el bloque las muestra de la más nueva a la más vieja, y eso no cambia el orden de entrega).
 */
export const ordenDeEntrega = (items: readonly ItemDelBloque[]): ItemDelBloque[] =>
  items.filter((x) => x.de === 'chat').sort((a, b) => instanteDe(a) - instanteDe(b));

/** «Ignorar» (5/11/2026): lo que pasa la pantalla. `ignorar` y `volver` devuelven el error, o null; `ignoradas`, las de este chat
 *  (`itemsDelBloque` con las ignoradas, la última ignorada primero). Sin esto, el bloque no ofrece ignorar. */
export type IgnorarDelBloque = {
  ignorar: (it: ItemDelBloque) => Promise<string | null>;
  volver: (it: ItemDelBloque) => Promise<string | null>;
  ignoradas: readonly ItemDelBloque[];
};
/** Lo que cada pantalla le da al bloque para ignorar: las acciones de useCentro.ts y las decisiones de la Ticketera ignoradas de
 *  este chat (lib/centro-preguntas.ts → ignoradasDelChat). Las preguntas ignoradas salen de su conversación (`preguntasIgnoradas`). */
export type ParaIgnorar = {
  pregunta: (p: PreguntaChat, ignorar: boolean) => Promise<string | null>;
  decision: (d: Decision, ignorar: boolean) => Promise<string | null>;
  decisiones: readonly Decision[];
};
/** El «Ignorar» del bloque, armado igual en la computadora y en el teléfono. Las ignoradas, la última ignorada primero. */
export function armarIgnorar(base: ParaIgnorar | undefined, preguntas: readonly PreguntaChat[]): IgnorarDelBloque | undefined {
  if (!base) return undefined;
  const hacer = (x: ItemDelBloque, si: boolean) => (x.de === 'ticketera' ? base.decision(x.d, si) : x.de === 'tab' ? Promise.resolve(null) : base.pregunta(x.p, si));
  const ignoradas: ItemDelBloque[] = [
    ...base.decisiones.map((d) => ({ de: 'ticketera' as const, id: `t:${d.id}`, d })),
    ...preguntas.map((p) => (p.origen === 'ask' ? { de: 'app' as const, id: `a:${p.id}`, p } : { de: 'chat' as const, id: `c:${p.id}`, p })),
  ].sort((a, b) => (Date.parse(ignoradaEn(b) ?? '') || 0) - (Date.parse(ignoradaEn(a) ?? '') || 0));
  return { ignorar: (x) => hacer(x, true), volver: (x) => hacer(x, false), ignoradas };
}
/** Cuándo quedó ignorada una del bloque (para «Ignoradas»). */
const ignoradaEn = (x: ItemDelBloque): string | null => (x.de === 'ticketera' ? x.d.ignoradaAt ?? null : x.de === 'tab' ? null : x.p.ignorada ?? null);
const tituloDeItem = (x: ItemDelBloque): string => (x.de === 'ticketera' ? x.d.pregunta : x.de === 'tab' ? x.q.pregunta : x.p.pregunta);

/**
 * Cuándo se hizo, a la vista (5/11/2026): «hace 6 días · 30 oct, 10:52», y la fecha entera en el `title`. Con más de 48 horas lleva
 * «Vieja» y otro color: se distingue de lo de hoy sin leer el número.
 */
export function EdadDePregunta({ iso, ahora }: { iso: string | null; ahora: number }) {
  const e = edadDe(iso, ahora);
  if (!e) return null;
  return (
    <span className={`co-preg__edad${e.vieja ? ' co-preg__edad--vieja' : ''}`}>
      {e.vieja && <span className="co-preg__vieja">Vieja</span>}
      <time dateTime={e.iso} title={e.completa}>{e.hace}</time>
      <span className="co-preg__cuando" aria-hidden> · {e.cuando}</span>
    </span>
  );
}

/** «Ignoradas · N»: chica, aparte, y abierta muestra cada una con «Volver a mostrar». */
function Ignoradas({ lista, ahora, onVolver, onAbrir }: { lista: readonly ItemDelBloque[]; ahora: number; onVolver: (it: ItemDelBloque) => Promise<string | null>; onAbrir?: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [volviendo, setVolviendo] = useState<string | null>(null);
  if (!lista.length) return null;
  if (!abierta) {
    return (
      <div className="co-ignoradas">
        <button type="button" className="co-ignoradas__link" onClick={() => { setAbierta(true); onAbrir?.(); }} aria-expanded={false}>Ignoradas · {lista.length}</button>
      </div>
    );
  }
  return (
    <div className="co-preg co-preg--arriba co-preg--ignoradas" role="group" aria-label="Ignoradas">
      <div className="co-preg__cab">
        <span className="co-ignoradas__titulo">Ignoradas</span>
        <Plegar onPlegar={() => setAbierta(false)} que="las ignoradas" />
      </div>
      <ul className="co-ignoradas__lista">
        {lista.map((x) => {
          const cuando = ignoradaEn(x);
          return (
            <li key={x.id} className="co-ignoradas__fila">
              <p className="co-ignoradas__texto">{tituloDeItem(x)}</p>
              <p className="co-ignoradas__pie">
                <EdadDePregunta iso={fechaDeItem(x)} ahora={ahora} />
                {cuando && <span className="co-ignoradas__cuando">Ignorada {haceAR(Date.parse(cuando), ahora)}</span>}
                <button type="button" className="co-chip co-ignoradas__volver" disabled={volviendo != null}
                  onClick={async () => { setVolviendo(x.id); await onVolver(x); setVolviendo(null); }}>
                  {volviendo === x.id ? 'Volviendo…' : 'Volver a mostrar'}
                </button>
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Qué se ve del bloque (22/10/2026): las SUGERENCIAS de MaKo (lo que pregunta la tab) van aparte de las preguntas, plegadas en
 * su tira hasta que se la toca (`verSugerencias`); las preguntas se pliegan como siempre (`plegado`). `visibles` es lo que se
 * recorre de a una; las tiras, lo que queda plegado arriba.
 */
export function vistaDelBloque<T extends { de: ItemDelBloque['de'] }>(items: readonly T[], plegado: boolean, verSugerencias: boolean) {
  const preguntas = items.filter((x) => x.de !== 'tab');
  const sugerencias = items.filter((x) => x.de === 'tab');
  const enSugerencias = verSugerencias && sugerencias.length > 0;
  return {
    preguntas, sugerencias, enSugerencias,
    visibles: enSugerencias ? sugerencias : plegado ? [] : preguntas,
    tiraDePreguntas: preguntas.length > 0 && (plegado || enSugerencias),
    tiraDeSugerencias: sugerencias.length > 0 && !enSugerencias,
  };
}
/** ¿Llegó una pregunta que no estaba? Es lo único que cierra las sugerencias abiertas: una pregunta nueva abre el bloque. */
export const llegoUnaPregunta = (antes: ReadonlySet<string>, preguntas: ReadonlyArray<{ id: string }>): boolean =>
  preguntas.some((x) => !antes.has(x.id));

/** Plegado, por chat y por lo que espera: si llega algo nuevo, se abre solo. En el navegador: si no hay, abierto. */
const CLAVE_PLEGADO = 'ops.preguntas.plegado.';
const firmaDe = (items: ReadonlyArray<{ id: string | number }>) => items.map((p) => p.id).join(',');
export function usePlegado(chat: string, items: ReadonlyArray<{ id: string | number }>): [boolean, (v: boolean) => void] {
  const firma = firmaDe(items);
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
function Plegada({ n, onAbrir, app = false }: { n: number; onAbrir: () => void; app?: boolean }) {
  return (
    <button type="button" className={`co-preg co-preg--arriba co-preg--plegada${app ? ' co-preg--app' : ''}`} onClick={onAbrir} aria-expanded={false}>
      <span>{esperando(n)}</span><span className="co-preg__flecha" aria-hidden>▴</span>
    </button>
  );
}

/** Las sugerencias de MaKo, plegadas: la tira chica arriba de la caja, con su nombre y cuántas hay. Tocándola se abren. */
function TiraSugerencias({ n, onAbrir }: { n: number; onAbrir: () => void }) {
  return (
    <button type="button" className="co-preg co-preg--arriba co-preg--plegada co-preg--sugerencias" onClick={onAbrir} aria-expanded={false}>
      <span className="co-preg__sug"><Icon name="idea" size={15} />{n === 1 ? 'Sugerencia de MaKo' : 'Sugerencias de MaKo'} · {n}</span>
      <span className="co-preg__flecha" aria-hidden>▾</span>
    </button>
  );
}

/** La flecha para plegar, arriba a la derecha de la tarjeta. */
export const Plegar = ({ onPlegar, que = 'las preguntas' }: { onPlegar: () => void; que?: string }) => (
  <button type="button" className="co-preg__plegar" onClick={onPlegar} aria-expanded aria-label={`Ocultar ${que}`} title="Ocultar">
    <span aria-hidden>▾</span>
  </button>
);

/** ‹, los puntos (uno por pregunta: se toca para ir) y ›. Las flechas solas (Martín, 22/10/2026: «alcanza con las flechas»):
 *  sin una antes o después, la suya queda apagada, y el rótulo es para quien no ve. Sin «1 de 3» a la vista (Martín, 24/10/2026:
 *  «Si ya aparecen los puntitos en las preguntas, no hace falta "1 de 3"»): lo dice el `aria-label` de los puntos, para el lector. */
export function Pasos({ items, pos, ir, contestada, enviando, nombre = 'Pregunta' }: {
  items: ReadonlyArray<{ id: string }>; pos: number; ir: (i: number) => void; contestada: (id: string) => boolean; enviando?: boolean;
  /** Cómo se llama cada punto para quien no ve: «Pregunta 2», «Sugerencia 2», «Completado 2» (BloqueCompletado.tsx). */
  nombre?: string;
}) {
  return (
    <div className="co-preg__pasos">
      <button type="button" className="co-chip co-preg__flechita" disabled={enviando || pos === 0} onClick={() => ir(pos - 1)} aria-label="Anterior" title="Anterior">‹</button>
      <span className="co-preg__puntos" role="group" aria-label={`${pos + 1} de ${items.length}`}>
        {items.map((q, i) => (
          <button key={q.id} type="button" className="co-preg__punto" disabled={enviando} onClick={() => ir(i)}
            aria-label={`${nombre} ${i + 1}${contestada(q.id) ? ' (contestada)' : ''}`} aria-current={i === pos ? 'step' : undefined}
            data-contestada={contestada(q.id) ? 'true' : undefined} />
        ))}
      </span>
      <button type="button" className="co-chip co-preg__flechita" disabled={enviando || pos + 1 >= items.length} onClick={() => ir(pos + 1)} aria-label="Siguiente" title="Siguiente">›</button>
    </div>
  );
}

export function BloqueDePreguntas({ chat, ticketera = [], responderTicketera, delChat = [], onResponder, deLaApp = [], deLaTab = [], avisoCerrado, ignorar, ahora: ahoraDeFuera }: {
  /** El chat (su clave en el Ops Center): el plegado se recuerda por chat y por lo que espera. */
  chat: string;
  /** Las decisiones de la Ticketera que espera este chat (`preguntasDelChat`); sin `responderTicketera`, no se ofrecen. */
  ticketera?: readonly Decision[];
  responderTicketera?: AccionResponder;
  /** Lo que el chat pregunta (`preguntasParaElBloque`: abiertas y sin una respuesta en camino); sin `onResponder`, no se ofrece. */
  delChat?: readonly PreguntaChat[];
  onResponder?: Responder;
  /** Las de AskUserQuestion (`preguntasDeLaApp`): se ven, y se contestan en la app. */
  deLaApp?: readonly PreguntaChat[];
  /** Lo que le pregunta la tab donde está la estrella (MakoEnLaTab → `preguntas`): las sugerencias del CRM. */
  deLaTab?: readonly PreguntaDeLaTab[];
  /** Si el chat de esa pregunta está cerrado, la línea que lo dice ANTES de firmar (`preguntaDeChatCerrado`, 30/10/2026). */
  avisoCerrado?: (p: PreguntaChat) => string | null;
  /** «Ignorar» y «Ignoradas» (5/11/2026). Sin esto, no se ofrecen (las sugerencias de una tab no se ignoran: tienen «Ahora no»). */
  ignorar?: IgnorarDelBloque;
  /** El reloj de la pantalla (la fecha de cada pregunta). Sin esto, el de ahora. */
  ahora?: number;
}) {
  const ahora = ahoraDeFuera ?? Date.now();
  const items = useMemo(() => itemsDelBloque(responderTicketera ? ticketera : [], onResponder ? delChat : [], deLaApp, deLaTab),
    [ticketera, responderTicketera, delChat, onResponder, deLaApp, deLaTab]);
  const [idActual, setIdActual] = useState<string | null>(null);
  /** Lo elegido en cada pregunta del chat (salen todas juntas) y las decisiones ya guardadas (hasta que el refresco las saca). */
  const [elegidos, setElegidos] = useState<Record<string, Elegido>>({});
  const [guardadas, setGuardadas] = useState<readonly string[]>([]);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [otra, setOtra] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** La que se está ignorando (su botón dice «…»), y la que se acaba de ignorar: su «Deshacer» queda a mano un rato. */
  const [ignorando, setIgnorando] = useState<string | null>(null);
  const [recien, setRecien] = useState<ItemDelBloque | null>(null);
  useEffect(() => {
    if (!recien) return;
    const t = window.setTimeout(() => setRecien(null), 10_000);
    return () => window.clearTimeout(t);
  }, [recien]);
  // LAS SUGERENCIAS DE MAKO VAN PLEGADAS, APARTE DE LAS PREGUNTAS (22/10/2026). Martín, mirando producción: «no se entiende que
  // son sugerencias y luego que son muy invasivas, se debería poder ver en un desplegable». Su tira dice qué son y cuántas hay;
  // se abren SÓLO tocándola (una nueva suma al número y no abre nada), y abiertas dicen «Sugerencia de MaKo». Una pregunta nueva
  // de un chat sí abre el bloque, como siempre (`usePlegado`), y deja las sugerencias en su tira.
  const [verSugerencias, setVerSugerencias] = useState(false);
  // El plegado se recuerda por las PREGUNTAS: una sugerencia nueva no cambia la firma, así que no abre nada.
  const soloPreguntas = useMemo(() => items.filter((x) => x.de !== 'tab'), [items]);
  const [plegado, setPlegado] = usePlegado(chat, soloPreguntas);
  const { preguntas, sugerencias, enSugerencias, visibles, tiraDePreguntas, tiraDeSugerencias } =
    useMemo(() => vistaDelBloque(items, plegado, verSugerencias), [items, plegado, verSugerencias]);
  const yaVistas = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (llegoUnaPregunta(yaVistas.current, preguntas)) setVerSugerencias(false);
    yaVistas.current = new Set(preguntas.map((x) => x.id));
  }, [preguntas]);
  const campo = useRef<HTMLInputElement>(null);
  /** Dónde hay algo escrito sin mandar: si eso se contesta en otro lado (la Ticketera, el teléfono), se dice. */
  const escrito = useRef<string | null>(null);

  // La abierta se sigue por su id (la regla de siempre de la Ticketera: si se fue, la primera).
  const { d: abierta, pos } = preguntaAbierta(visibles, idActual);
  const it = abierta ?? null;
  const p = it && (it.de === 'chat' || it.de === 'app') ? it.p : null;
  const ops = useMemo(() => (p ? opcionesEnOrden(p) : []), [p]);

  // Al llegar a una pregunta del chat, lo que ya se había elegido en ella (al volver con ‹ o un punto) o nada.
  useEffect(() => {
    if (!it) return;
    const ya = elegidos[it.id];
    setMarcadas(ya?.elegidas ?? []);
    setOtra(ya?.otra ?? '');
    setError(null);
  }, [it?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Lo escrito para una que se contestó en otro lado no pasa en silencio a la siguiente.
  useEffect(() => {
    if (escrito.current && !items.some((x) => x.id === escrito.current)) { setAviso('Esa pregunta ya se contestó en otro lado'); escrito.current = null; }
  }, [items]);

  // Lo plegado, en sus tiras: las preguntas (plegadas, o tapadas por las sugerencias abiertas) y las sugerencias.
  const tiras = (<>
    {tiraDePreguntas && (
      <Plegada n={preguntas.length} onAbrir={() => { setVerSugerencias(false); setPlegado(false); }} app={preguntas.every((x) => x.de === 'app')} />
    )}
    {tiraDeSugerencias && <TiraSugerencias n={sugerencias.length} onAbrir={() => setVerSugerencias(true)} />}
  </>);
  // Lo de «Ignorar», arriba de todo: «Ignoradas · N» (chica) y el «Deshacer» de la que se acaba de ignorar.
  const deshacer = async (x: ItemDelBloque) => { setRecien(null); await ignorar?.volver(x); };
  const delIgnorar = ignorar && (<>
    {/* Con la lista abierta, el «Deshacer» sobra: ahí está «Volver a mostrar». */}
    <Ignoradas lista={ignorar.ignoradas} ahora={ahora} onAbrir={() => setRecien(null)} onVolver={async (x) => { if (recien?.id === x.id) setRecien(null); return ignorar.volver(x); }} />
    {recien && (
      <p className="co-preg co-preg--arriba co-preg--plegada co-preg--recien" role="status">
        <span>Ignorada: no se le avisa al chat</span>
        <button type="button" className="co-chip" onClick={() => void deshacer(recien)}>Deshacer</button>
      </p>
    )}
  </>);
  if (!it) return items.length || delIgnorar ? <>{delIgnorar}{tiras}</> : null;

  const ir = (i: number) => { setAviso(null); setIdActual(visibles[Math.min(visibles.length - 1, Math.max(0, i))]?.id ?? null); };
  const contestada = (id: string) => !!elegidos[id] || guardadas.includes(id) || items.some((x) => x.id === id && x.de === 'tab' && !!x.q.hecha);
  /** A la próxima que falta contestar ACÁ (las de la app se contestan en la app): primero las de después, después las de antes. */
  const aLaSiguiente = (hecho: ReadonlySet<string>) => {
    const falta = (x: ItemDelBloque) => x.de !== 'app' && !hecho.has(x.id);
    const i = visibles.findIndex((x, n) => n > pos && falta(x));
    const j = i >= 0 ? i : visibles.findIndex(falta);
    if (j >= 0) ir(j);
  };
  const hechos = (mas: string) => new Set([...Object.keys(elegidos), ...guardadas, mas]);
  // En el orden en que se HICIERON (`ordenDeEntrega`): el bloque las muestra de la más nueva a la más vieja.
  const delChatAbiertas = ordenDeEntrega(items);
  const varias = delChatAbiertas.length > 1;

  async function enviar(todo: Record<string, Elegido>) {
    if (enviando || !onResponder) return;
    setEnviando(true);
    setError(null);
    // En orden y de a una: cada una sale firmada por su lado. Si una falla, las que salieron ya están y el resto queda acá.
    for (const q of delChatAbiertas) {
      const e = todo[q.id];
      if (!e || q.de !== 'chat') continue;
      const mal = await onResponder(q.p, e.elegidas, e.otra);
      if (mal) { setError(`«${q.p.pregunta.slice(0, 60)}»: ${mal}`); setEnviando(false); return; }
    }
    setEnviando(false);
    setElegidos({});
    escrito.current = null;
  }

  /** Lo elegido en una pregunta del CHAT: si ya están todas las del chat, salen TODAS (con una sola, al elegirla); si no, a la
   *  siguiente que falta. Nunca hay una pantalla de resumen. */
  function guardar(elegidas: number[], texto: string) {
    if (!it || it.de !== 'chat') return;
    const v = eleccionValida(it.p, elegidas, texto);
    if (!v.ok) { setError(v.error); return; }
    // Una clave en «Otra» no sale (22/10/2026, la de Apify): se pega en /integraciones.
    if (v.otra && hayClave(v.otra)) { setError(AVISO_CLAVE_EN_EL_CENTRO); return; }
    const todo = { ...elegidos, [it.id]: { elegidas: v.elegidas, otra: v.otra ?? '' } };
    setElegidos(todo);
    if (escrito.current === it.id) escrito.current = null;
    if (delChatAbiertas.every((q) => todo[q.id])) { void enviar(todo); return; }
    aLaSiguiente(hechos(it.id));
  }
  /** Una decisión de la Ticketera ya quedó guardada: se marca y se pasa a la siguiente. */
  const guardada = (id: string) => {
    setGuardadas((g) => [...g, id]);
    if (escrito.current === id) escrito.current = null;
    aLaSiguiente(hechos(id));
  };
  /** «Ignorar» la que está abierta: sale del bloque sin contestarla (no se le firma nada al chat), y se pasa a la siguiente. */
  async function ignorarEsta() {
    if (!it || !ignorar || it.de === 'tab' || ignorando || enviando) return;
    const x = it;
    setIgnorando(x.id);
    setError(null);
    if (escrito.current === x.id) escrito.current = null;
    const mal = await ignorar.ignorar(x);
    setIgnorando(null);
    // El error a la vista de cualquier fuente (el del pie es sólo de las preguntas del chat).
    if (mal) { setAviso(mal); return; }
    setAviso(null);
    setElegidos((e) => { const { [x.id]: _q, ...resto } = e; return resto; });
    setRecien(x);
  }
  const tocar = (i: number) => {
    if (enviando || !p) return;
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
  const ultimaDelChat = it.de === 'chat' && delChatAbiertas.every((q) => q.id === it.id || elegidos[q.id]);
  const titulo = it.de === 'ticketera' ? it.d.pregunta : it.de === 'tab' ? it.q.pregunta : it.p.pregunta;
  return (<>
    {delIgnorar}
    {tiras}
    <div className={`co-preg co-preg--arriba${it.de === 'app' ? ' co-preg--app' : ''}`} role="group"
      aria-label={it.de === 'tab' ? `Sugerencia de MaKo: ${titulo}` : it.de === 'app' ? `Pregunta en la app de Claude: ${titulo}` : `Pregunta: ${titulo}`}
      onKeyDown={it.de === 'chat' ? tecla : undefined}>
      {enSugerencias ? (<>
        {/* Abiertas dicen qué son: no es una pregunta de un chat ni un mensaje. */}
        <div className="co-preg__cab">
          <span className="co-preg__sug"><Icon name="idea" size={15} />Sugerencia de MaKo</span>
          <Plegar onPlegar={() => setVerSugerencias(false)} que="las sugerencias" />
        </div>
        {visibles.length > 1 && <Pasos items={visibles} pos={pos} ir={ir} contestada={contestada} nombre="Sugerencia" />}
      </>) : (
        <div className="co-preg__cab">
          {visibles.length > 1 ? <Pasos items={visibles} pos={pos} ir={ir} contestada={contestada} enviando={enviando} />
            : <span className="co-preg__paso">{esperando(1)}</span>}
          <Plegar onPlegar={() => setPlegado(true)} />
        </div>
      )}
      {/* Cuándo se hizo y «Ignorar» (5/11/2026): lo de una tab no tiene fecha ni se ignora (tiene «Ahora no»). */}
      {it.de !== 'tab' && (
        <div className="co-preg__meta">
          <EdadDePregunta iso={fechaDeItem(it)} ahora={ahora} />
          {ignorar && (
            <button type="button" className="co-preg__ignorar" disabled={!!ignorando || enviando} onClick={() => void ignorarEsta()}
              aria-label={`Ignorar: ${titulo}`} title="Sacarla de aquí sin contestarla: al chat no le llega nada">
              {ignorando === it.id ? 'Ignorando…' : 'Ignorar'}
            </button>
          )}
        </div>
      )}
      {aviso && <p className="co-preg__error" role="alert">{aviso}<ReportarASoporte /></p>}
      {it.de === 'ticketera' && responderTicketera ? (
        <CuerpoTicketera key={it.id} d={it.d} responder={responderTicketera} onGuardada={() => guardada(it.id)}
          onEscribe={(hay) => { escrito.current = hay ? it.id : escrito.current === it.id ? null : escrito.current; }} />
      ) : it.de === 'tab' ? (
        <CuerpoDeLaTab key={it.id} q={it.q} />
      ) : it.de === 'app' ? (
        <CuerpoDeLaApp p={it.p} />
      ) : p ? (<>
        {avisoCerrado?.(p) && <p className="co-preg__aviso-app" role="note">{avisoCerrado(p)}</p>}
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
                onChange={(e) => { setOtra(e.target.value); setError(null); escrito.current = e.target.value.trim() ? it.id : null; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && otra.trim()) { e.preventDefault(); guardar(p.varias ? marcadas : [], otra); } }}
                placeholder="Escribe otra cosa" aria-label="Escribe otra respuesta" />
            </label>
            {hayClave(otra) && <AvisoClave />}
          </li>
        </ol>
        {/* El pie, sólo si tiene algo: el error, o el botón (con varias marcadas o algo escrito). */}
        {(error || p.varias || otra.trim()) && <div className="co-preg__pie co-preg__pie--chat">
          {error && <span className="co-preg__error" role="alert">{error}<ReportarASoporte /></span>}
          {(p.varias || otra.trim()) && (
            <button type="button" className="co-chip co-chip--primario" disabled={enviando || (!marcadas.length && !otra.trim())}
              onClick={() => guardar(p.varias ? marcadas : [], otra)}>
              {enviando ? 'Enviando…' : varias && !ultimaDelChat ? 'Siguiente' : varias ? 'Enviar' : 'Responder'}
            </button>
          )}
        </div>}
      </>) : null}
    </div>
  </>);
}

/** Lo que pregunta la tab (una sugerencia del CRM): sus opciones corren lo de la tab; hecha, dice qué quedó y dónde verlo. */
export function CuerpoDeLaTab({ q }: { q: PreguntaDeLaTab }) {
  const quieta = q.quieta || q.ocupada != null;
  function tecla(e: KeyboardEvent<HTMLDivElement>) {
    if (quieta || q.hecha || !/^[1-9]$/.test(e.key)) return;
    const o = q.opciones[Number(e.key) - 1];
    if (o) { e.preventDefault(); elegir(o); }
  }
  const elegir = (o: PreguntaDeLaTab['opciones'][number]) => { if (o.href) window.location.assign(o.href); else o.onElegir?.(); };
  return (
    <div className="co-preg__cuerpo" onKeyDown={tecla}>
      <p className="co-preg__texto">{conLinks(q.pregunta, 'pq')}</p>
      {q.contexto && <p className="co-preg__contexto">{conLinks(q.contexto, 'pc')}</p>}
      {q.hecha ? (
        <p className="co-preg__pie">
          <span className="co-preg__ayuda">{q.hecha.texto}</span>
          {q.hecha.href && <a className="co-chip" href={q.hecha.href}>{q.hecha.rotulo ?? 'Abrir'}</a>}
        </p>
      ) : (<>
        <ol className="co-preg__ops">
          {q.opciones.map((o, n) => (
            <li key={o.titulo}>
              {/* Como las otras opciones del bloque: un `div` con rol de botón (un link de la pregunta no elige). */}
              <div role="button" tabIndex={quieta ? -1 : 0} aria-disabled={quieta || undefined} className="co-preg__op"
                onClick={(e) => { if (!quieta && !(e.target as HTMLElement).closest('a')) elegir(o); }}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !quieta) { e.preventDefault(); elegir(o); } }}>
                <span className="co-preg__num" aria-hidden>{q.ocupada === n ? '…' : n + 1}</span>
                <span className="co-preg__op-txt">
                  <span className="co-preg__titulo">{o.titulo}{o.recomendada && <span className="co-preg__rec"> (Recomendada)</span>}</span>
                </span>
              </div>
            </li>
          ))}
        </ol>
        {q.error && <p className="co-preg__pie"><span className="co-preg__error" role="alert">{q.error}<ReportarASoporte /></span></p>}
      </>)}
    </div>
  );
}

/**
 * Las que el chat le hizo a Martín con AskUserQuestion en la app de Claude (cartero 1.18.0, origen `ask`): se VEN acá, en el
 * mismo bloque y de a una, pero se contestan en la app. Medido el 22/10: mientras esperan, al chat no le entra ningún mensaje,
 * así que una respuesta firmada desde acá no lo destraba (lib/centro-preguntas-chat.ts → seContestaEnLaApp). La regla para los
 * chats es preguntar con `cartero preguntar` (AGENTS.md).
 */
/**
 * Una pregunta de la app de Claude (un AskUserQuestion): se LEE acá, se contesta allá. Desde el 24/10/2026 lo dice ARRIBA y
 * también en el teléfono: Martín tocó sus opciones desde el celular, no pasó nada, y el renglón que lo explicaba estaba
 * escondido en pantallas táctiles (la regla que esconde la ayuda del teclado se lo llevaba puesto). Y dice lo que cuesta:
 * mientras espera, el chat no lee nada de lo que se le escribe. Las opciones van de lectura (sin la caja de un botón).
 */
function CuerpoDeLaApp({ p }: { p: PreguntaChat }) {
  return (<>
    <p className="co-preg__aviso-app" role="note">
      <Icon name="computadora" size={15} />
      <span>Se contesta en la app de Claude, en la computadora: desde aquí no se puede. Hasta entonces, el chat no lee lo que le escribas.</span>
    </p>
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
  </>);
}
