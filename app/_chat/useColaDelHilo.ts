'use client';
// =============================================================================
// LA COLA DE SALIDA PARA UN HILO DE MaKo (auditoría de chats del 20/11, pestanas-6, 7 y 8)
// =============================================================================
// El adaptador fino entre un hilo de ítems (los de HiloMako y HiloAgente, ItemHilo) y la cola compartida (./useColaDeSalida.ts): no es
// otra cola. Las pestañas guionadas (Media Buyer, CoPilot, Newsletter, las preguntas del Copywriter) y las que agregan varios mensajes
// o un mensaje con su tarjeta en un solo setState (Image Editor, Video Editor, Web Generator, Dashboard, Automations) los dibujaban de
// golpe: la respuesta, la pregunta que sigue y sus pastillas en el mismo cuadro, sin puntitos. Con esto, cada mensaje de MaKo sale de a
// uno con sus puntitos (msEscribiendo) y lo que trae (la tarjeta, las pastillas, los botones: `conPieza`) después del texto, con su pausa.
//   · Lo de la persona sale ya; lo que ya estaba al abrir (o al terminar de cargar: `cargado`), de una.
//   · La espera del servidor cuenta: cuando MaKo pasa a `ocupado` (la persona mandó), los puntitos del que viene empiezan ahí.
// Lo prueba tests/chats-pestanas-cola.test.ts (el núcleo, `filasDeItems`, es puro).
// =============================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { filaDeItem } from './fila-del-hilo';
import { useColaDeSalida, type FilaDeCola } from './useColaDeSalida';

/**
 * Las filas de la cola para un hilo, con la MISMA traducción que el chat general (`filaDeItem`, ./fila-del-hilo.ts): el texto de
 * MaKo con sus puntitos; lo de la persona, ya; una tarjeta, un bloque o un aviso de la plataforma, como pieza en la pausa. Encima, el
 * mensaje de MaKo trae su pieza adentro (`enMensaje.abajo`: se dibuja con `conPieza(id)`, después del texto). `deUna`: ya visto.
 */
export function filasDeItems(items: readonly ItemHilo[], deUna: (id: string) => boolean = () => false): FilaDeCola[] {
  return items.map((x): FilaDeCola => {
    const f = filaDeItem(x, !deUna(x.id));
    return f.de === 'mako' && x.k === 'msg' ? { ...f, pieza: true } : f;
  });
}

/**
 * `items`: el hilo entero, en orden. `ocupado`: MaKo trabajando (la persona mandó). `cargado`: el historial ya llegó (hasta ahí, nada
 * sale; al llegar, todo lo que hay sale de una). Devuelve los ítems que ya salieron, si MaKo está escribiendo el que viene, y si la
 * pieza de un mensaje (su tarjeta, sus pastillas) ya puede dibujarse.
 */
export function useColaDelHilo(items: readonly ItemHilo[], o: { ocupado?: boolean; cargado?: boolean;
  /** Lo que entra al hilo YA VISTO (una pregunta guionada que se contestó y pasa al hilo): sale de una, sin puntitos. */
  deUna?: (id: string) => boolean;
  /** false: nada sale de una al abrir (la PRIMERA visita a un chat guionado: su primera pregunta llega con sus puntitos). */
  deUnaAlAbrir?: boolean } = {}):
  { items: ItemHilo[]; escribiendo: boolean; conPieza: (id: string) => boolean } {
  const cargado = o.cargado ?? true;
  // Por su contenido: una lista nueva en cada dibujo (`nota.conNotas(items)`) no vuelve a mover la cola.
  const clave = items.map((x) => (x.k === 'msg' ? `${x.id}:${x.role}:${(x.texto ?? '').length}` : x.id)).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filas = useMemo(() => filasDeItems(items, o.deUna), [clave]);
  const [historia, setHistoria] = useState(cargado);
  const deUnaAlAbrir = o.deUnaAlAbrir ?? true;
  const cola = useColaDeSalida(filas, { historial: () => (cargado && deUnaAlAbrir ? filas.map((f) => f.id) : []), retenido: () => !historia });
  const { mostrarYa, empezoLaEspera } = cola;
  // Cuando el historial llega después del montaje: todo lo que hay, de una (nunca de a uno con puntitos).
  useEffect(() => {
    if (historia || !cargado) return;
    if (deUnaAlAbrir) mostrarYa(filas.map((f) => f.id));
    setHistoria(true);
  }, [historia, cargado, filas, mostrarYa]);
  const antes = useRef(!!o.ocupado);
  useEffect(() => {
    if (o.ocupado && !antes.current) empezoLaEspera();
    antes.current = !!o.ocupado;
  }, [o.ocupado, empezoLaEspera]);
  const vis = useMemo(() => new Set(cola.visibles.map((f) => f.id)), [cola.visibles]);
  const visibles = useMemo(() => items.filter((x) => vis.has(x.id)), [items, vis]);
  return { items: visibles, escribiendo: cola.escribiendo, conPieza: cola.conPieza };
}

/**
 * ¿Es la PRIMERA visita de esta persona a un chat guionado, en este navegador? (auditoría de chats, pestanas-6: «para la primera
 * visita, una marca de visto»). La primera vez, su primera pregunta llega con sus puntitos; las demás (y al recargar), de una.
 */
export function usePrimeraVisita(chat: string): boolean {
  const k = `mako.chat-visto.${chat}`;
  const [primera] = useState(() => { try { return !localStorage.getItem(k); } catch { return false; } });
  useEffect(() => { try { localStorage.setItem(k, new Date().toISOString()); } catch { /* sin storage: la próxima, otra vez */ } }, [k]);
  return primera;
}
