'use client';
// =============================================================================
// LA COLA DE SALIDA: LOS MENSAJES DE MAKO SALEN DE A UNO, CON SUS PUNTITOS (20/11/2026)
// =============================================================================
// Martín, probando el onboarding en producción, y la auditoría de los chats del Cerebro (onboarding-3 y 4): los puntitos duraban lo
// que tardaba el servidor (un parpadeo, o segundos), dos mensajes salían de golpe, y la pregunta salía en el mismo instante que su
// tarjeta, su recuadro o su botón. La regla, para todos los chats con MaKo:
//   · un mensaje nuevo de MaKo sale con puntitos durante max(lo que ya se esperó, `msEscribiendo(texto)`): 600 ms + 20 ms por
//     carácter, con tope de 3,5 s, el de la maqueta (la función única de todos los chats: lib/puntitos.ts). Los puntitos empiezan
//     cuando la persona mandó (`empezoLaEspera`), así la espera del servidor cuenta;
//   · si llegan dos, el segundo trae los suyos;
//   · después del texto, una pausa (`MS_PAUSA_PIEZA`) y recién su pieza: la tarjeta, el recuadro o el botón;
//   · lo de la persona sale ya (es suyo), y lo que no es de este turno (`de` cualquier otra cosa: el historial, lo que se cargó);
//   · una PIEZA suelta del turno (`de: 'pieza'`: un bloque, una tarjeta, un aviso de la plataforma) sale sin puntitos, en la pausa
//     después de lo anterior (el chat general: app/second-brain/useChatCliente.ts suelta así el turno de a una pieza);
//   · el HISTORIAL (lo que ya estaba al abrir) se dibuja de una;
//   · un mensaje `retenido` (espera algo de afuera, como el momento del video: app/_ui/tutorial/useMensajeDelVideo.ts) no tiene
//     puntitos hasta que se suelta.
// El núcleo (`pasoDeLaCola`) no usa React: lo prueba tests/cola-de-salida.test.ts. El scroll que lo acompaña: ./useBajarAlUltimo.ts.
// =============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Los puntitos de un mensaje: la función única de todos los chats (lib/puntitos.ts).
import { msEscribiendo } from '@/lib/puntitos';
export { MS_ESCRIBE_BASE, MS_ESCRIBE_POR_LETRA, MS_ESCRIBE_TOPE, msEscribiendo } from '@/lib/puntitos';
/** Entre el texto y su pieza (la tarjeta, el recuadro, el botón): de 400 a 600 ms. */
export const MS_PAUSA_PIEZA = 500;

/** Una fila de la cola: su id, de quién es ('mako' con puntitos; 'pieza' sin puntitos, en la pausa; otra cosa, ya), su texto (para
 *  los puntitos) y si trae una pieza adentro, después del texto. */
export type FilaDeCola = { id: string; de: string; texto: string; pieza?: boolean };
export type EstadoCola = {
  mostrados: ReadonlySet<string>;
  piezas: ReadonlySet<string>;
  /** El último mensaje de MaKo que salió y cuándo (su pieza sale MS_PAUSA_PIEZA después). */
  ultimo: { id: string; en: number } | null;
  /** Desde cuándo MaKo está escribiendo el que sigue (la persona mandó, o salió la pieza anterior). */
  desde: number | null;
};
export type PasoCola =
  | { tipo: 'nada' }
  /** El que sigue espera algo de afuera: sin puntitos, y los suyos empiezan cuando se suelte. */
  | { tipo: 'retenido'; id: string }
  | { tipo: 'mostrar'; id: string; conPieza: boolean }
  | { tipo: 'pieza'; id: string }
  | { tipo: 'esperar'; ms: number; escribiendo: boolean; empieza?: number };

/** Lo que toca ahora. `empieza`: los puntitos arrancan en este momento (el hook lo anota en `desde`). */
export function pasoDeLaCola(filas: readonly FilaDeCola[], e: EstadoCola, retenido: (id: string) => boolean, ahora: number): PasoCola {
  const porId = new Map(filas.map((f) => [f.id, f]));
  // La pieza del último mensaje, a su pausa.
  if (e.ultimo && porId.get(e.ultimo.id)?.pieza && !e.piezas.has(e.ultimo.id)) {
    const falta = e.ultimo.en + MS_PAUSA_PIEZA - ahora;
    return falta <= 0 ? { tipo: 'pieza', id: e.ultimo.id } : { tipo: 'esperar', ms: falta, escribiendo: false };
  }
  const sig = filas.find((f) => !e.mostrados.has(f.id));
  if (!sig) return { tipo: 'nada' };
  // Una pieza suelta del turno: en la pausa después de lo último que salió, sin puntitos.
  if (sig.de === 'pieza') {
    const falta = e.ultimo ? e.ultimo.en + MS_PAUSA_PIEZA - ahora : 0;
    return falta <= 0 ? { tipo: 'mostrar', id: sig.id, conPieza: true } : { tipo: 'esperar', ms: falta, escribiendo: false };
  }
  if (sig.de !== 'mako') return { tipo: 'mostrar', id: sig.id, conPieza: true };
  if (retenido(sig.id)) return { tipo: 'retenido', id: sig.id };
  const desde = e.desde ?? ahora;
  const falta = desde + msEscribiendo(sig.texto) - ahora;
  if (falta <= 0) return { tipo: 'mostrar', id: sig.id, conPieza: !sig.pieza };
  return { tipo: 'esperar', ms: falta, escribiendo: true, ...(e.desde == null ? { empieza: ahora } : {}) };
}

/** Las filas que se dibujan: las que ya salieron y, enseguida, lo de la persona que sigue (es suyo: sale ya, sin esperar un render). */
export function filasVisibles<F extends FilaDeCola>(filas: readonly F[], mostrados: ReadonlySet<string>): F[] {
  const out: F[] = [];
  for (const f of filas) {
    if (mostrados.has(f.id)) { out.push(f); continue; }
    if (f.de === 'mako' || f.de === 'pieza') break;
    out.push(f);
  }
  return out;
}

/**
 * La cola de un chat. `filas`: todas, en orden. `historial`: los ids que ya estaban al abrir (se dibujan de una, con su pieza).
 * `retenido`: un mensaje que espera algo de afuera. Devuelve lo que se dibuja, si MaKo está escribiendo, si la pieza de un mensaje
 * ya salió, `empezoLaEspera` (la persona mandó: los puntitos cuentan desde ahí) y `mostrarYa` (lo que la persona ya contestó).
 */
export function useColaDeSalida<F extends FilaDeCola>(filas: readonly F[], o: { historial: () => Iterable<string>; retenido?: (id: string) => boolean; alMostrar?: (id: string) => void }):
  { visibles: F[]; escribiendo: boolean; conPieza: (id: string) => boolean; empezoLaEspera: () => void; mostrarYa: (ids: readonly string[]) => void } {
  const [e, setE] = useState<EstadoCola>(() => {
    const h = new Set(o.historial());
    return { mostrados: h, piezas: new Set(h), ultimo: null, desde: null };
  });
  const [escribiendo, setEscribiendo] = useState(false);
  const retenido = o.retenido ?? (() => false);
  const retenidoRef = useRef(retenido);
  retenidoRef.current = retenido;
  const alMostrar = useRef(o.alMostrar);
  alMostrar.current = o.alMostrar;
  // Lo que cambia cuando un mensaje deja de estar retenido: la cola vuelve a mirar.
  const clavesRetenidas = filas.filter((f) => !e.mostrados.has(f.id) && retenido(f.id)).map((f) => f.id).join('|');
  useEffect(() => {
    const p = pasoDeLaCola(filas, e, retenidoRef.current, Date.now());
    if (p.tipo === 'nada') { setEscribiendo(false); return; }
    if (p.tipo === 'retenido') {
      setEscribiendo(false);
      if (e.desde != null) setE((x) => ({ ...x, desde: null }));
      return;
    }
    if (p.tipo === 'mostrar') {
      setEscribiendo(false);
      alMostrar.current?.(p.id);
      const de = filas.find((f) => f.id === p.id)?.de;
      const esMako = de === 'mako';
      const esPieza = de === 'pieza';
      setE((x) => ({
        mostrados: new Set([...x.mostrados, p.id]),
        piezas: p.conPieza ? new Set([...x.piezas, p.id]) : x.piezas,
        ultimo: esMako || esPieza ? { id: p.id, en: Date.now() } : x.ultimo,
        // El que sigue empieza sus puntitos ahora (si no trae pieza) o cuando salga la pieza. Lo de la persona no los corta: siguen
        // contando desde que mandó.
        desde: esMako ? (p.conPieza ? Date.now() : null) : esPieza ? Date.now() : x.desde,
      }));
      return;
    }
    if (p.tipo === 'pieza') {
      setEscribiendo(false);
      setE((x) => ({ ...x, piezas: new Set([...x.piezas, p.id]), desde: Date.now() }));
      return;
    }
    setEscribiendo(p.escribiendo);
    if (p.empieza != null) setE((x) => (x.desde == null ? { ...x, desde: p.empieza! } : x));
    const t = window.setTimeout(() => setE((x) => ({ ...x })), p.ms);
    return () => window.clearTimeout(t);
  }, [filas, e, clavesRetenidas]);
  const visibles = useMemo(() => filasVisibles(filas, e.mostrados), [filas, e.mostrados]);
  // Lo que no es del turno (el historial, lo ya dicho) está entero desde el primer dibujo, también su pieza: sin esperar un efecto (el
  // HTML del servidor y un dibujo estático lo traen completo).
  const inmediatas = useMemo(() => new Set(filas.filter((f) => f.de !== 'mako' && f.de !== 'pieza').map((f) => f.id)), [filas]);
  const conPieza = useCallback((id: string) => e.piezas.has(id) || inmediatas.has(id), [e.piezas, inmediatas]);
  // La persona mandó: los puntitos del que viene cuentan desde ahora (lo que tarde el servidor, cuenta).
  const empezoLaEspera = useCallback(() => setE((x) => ({ ...x, desde: Date.now() })), []);
  const mostrarYa = useCallback((ids: readonly string[]) => setE((x) => ({ ...x, mostrados: new Set([...x.mostrados, ...ids]), piezas: new Set([...x.piezas, ...ids]) })), []);
  return { visibles, escribiendo, conPieza, empezoLaEspera, mostrarYa };
}

/** Lo ya dicho en esta página: un componente que se vuelve a montar (volver a un chat, al Ops Center) no repite sus puntitos. */
const dichosEnLaPagina = new Set<string>();
/** Anota algo como ya dicho en esta página (lo que se dibuja después sale de una). */
export const anotarDicho = (id: string): void => { dichosEnLaPagina.add(id); };

/**
 * Lo que una pantalla dice SIN guardarlo (un saludo, una apertura): la primera vez en la visita, por la cola (sus puntitos, su texto y,
 * en la pausa, su pieza: los arranques, los botones); lo ya dicho en esta página, de una (20/11, la auditoría de chats, ops-center-5 y 7).
 */
export function useDichoConPuntitos<F extends FilaDeCola>(filas: readonly F[]) {
  // Sólo lo que dijo OTRO montaje: si las filas cambian después de que este lo soltó, lo suyo no pasa a «ya» (perdería la pausa de
  // su pieza: los botones saldrían junto con el texto).
  const propios = useRef(new Set<string>());
  const conMemoria = useMemo(() => filas.map((f) => (dichosEnLaPagina.has(f.id) && !propios.current.has(f.id) ? { ...f, de: 'ya' } : f)), [filas]);
  return useColaDeSalida(conMemoria, { historial: () => [], alMostrar: (id) => { propios.current.add(id); dichosEnLaPagina.add(id); } });
}
