'use client';
// =============================================================================
// LA COLA DE SALIDA: LOS MENSAJES DE MAKO SALEN DE A UNO, CON SUS PUNTITOS (20/11/2026)
// =============================================================================
// Martín, probando el onboarding en producción, y la auditoría de los chats del Cerebro (onboarding-3 y 4): los puntitos duraban lo
// que tardaba el servidor (un parpadeo, o segundos), dos mensajes salían de golpe, y la pregunta salía en el mismo instante que su
// tarjeta, su recuadro o su botón. La regla, para todos los chats con MaKo:
//   · un mensaje nuevo de MaKo sale con puntitos durante max(lo que ya se esperó, `msEscribiendo(texto)`): 600 ms + 20 ms por
//     carácter, con tope de 2.200 ms. Los puntitos empiezan cuando la persona mandó (`empezoLaEspera`), así la espera del servidor
//     cuenta;
//   · si llegan dos, el segundo trae los suyos;
//   · después del texto, una pausa (`MS_PAUSA_PIEZA`) y recién su pieza: la tarjeta, el recuadro o el botón;
//   · lo de la persona sale ya (es suyo);
//   · el HISTORIAL (lo que ya estaba al abrir) se dibuja de una;
//   · un mensaje `retenido` (espera algo de afuera, como el momento del video: app/_ui/tutorial/useMensajeDelVideo.ts) no tiene
//     puntitos hasta que se suelta.
// El núcleo (`pasoDeLaCola`) no usa React: lo prueba tests/cola-de-salida.test.ts. El scroll que lo acompaña: ./useBajarAlUltimo.ts.
// =============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Los puntitos de un mensaje: 600 ms + 20 ms por carácter, con tope de 2.200 ms. */
export const MS_ESCRIBE_BASE = 600;
export const MS_ESCRIBE_POR_LETRA = 20;
export const MS_ESCRIBE_TOPE = 2200;
export function msEscribiendo(texto: string): number {
  return Math.min(MS_ESCRIBE_TOPE, MS_ESCRIBE_BASE + MS_ESCRIBE_POR_LETRA * (texto ?? '').length);
}
/** Entre el texto y su pieza (la tarjeta, el recuadro, el botón): de 400 a 600 ms. */
export const MS_PAUSA_PIEZA = 500;

/** Una fila de la cola: su id, de quién es, su texto (para los puntitos) y si trae una pieza después del texto. */
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
    if (f.de === 'mako') break;
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
      const esMako = filas.find((f) => f.id === p.id)?.de === 'mako';
      setE((x) => ({
        mostrados: new Set([...x.mostrados, p.id]),
        piezas: p.conPieza ? new Set([...x.piezas, p.id]) : x.piezas,
        ultimo: esMako ? { id: p.id, en: Date.now() } : x.ultimo,
        // El que sigue empieza sus puntitos ahora (si no trae pieza) o cuando salga la pieza. Lo de la persona no los corta: siguen
        // contando desde que mandó.
        desde: esMako ? (p.conPieza ? Date.now() : null) : x.desde,
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
  const conPieza = useCallback((id: string) => e.piezas.has(id), [e.piezas]);
  // La persona mandó: los puntitos del que viene cuentan desde ahora (lo que tarde el servidor, cuenta).
  const empezoLaEspera = useCallback(() => setE((x) => ({ ...x, desde: Date.now() })), []);
  const mostrarYa = useCallback((ids: readonly string[]) => setE((x) => ({ ...x, mostrados: new Set([...x.mostrados, ...ids]), piezas: new Set([...x.piezas, ...ids]) })), []);
  return { visibles, escribiendo, conPieza, empezoLaEspera, mostrarYa };
}
