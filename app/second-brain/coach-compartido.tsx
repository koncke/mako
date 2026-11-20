'use client';

// =============================================================================
// LO QUE COMPARTEN EL COACH DE LA COMPUTADORA (./ChatDelCoach.tsx) Y EL DEL TELÉFONO (app/m/second-brain/HojaDelCoach.tsx)
// =============================================================================
// Aparte, para que el teléfono no cargue el panel de la computadora: la voz de los coaches debajo de cada mensaje, el hilo con la
// portada adelante, la oferta armada en su mensaje y el aviso de que el Offer Coach no pudo abrir su conversación de Offer
// (onboarding V2; el motor de Offer, 19/11/2026: ./useChatDelCoach.ts → `motorOffer`).
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import { BotonVozCoach } from '@/app/_ui/voz-coach/BotonVozCoach';
import { pdfDeMensaje } from '@/app/offer/ayudas';
import { OfertaEnElChat, PdfDeOtraVersion } from './OfertaEnElChat';
import type { ChatCliente } from './useChatCliente';
import type { EnMensaje } from '@/app/_chat/HiloMako';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { OfferSesionVista } from '@/lib/offer-marco';
import type { CoachDelOps } from '@/lib/chat-mako-reglas';
import type { PlanFunnel } from '@/lib/funnel-plan';
import { VideoDelMomento } from '@/app/_ui/tutorial/VideoDelMomento';
import { useEsRevision } from '@/app/_ui/tutorial/store';
import { claveClaseFunnel, conLaClase, itemClaseFunnel, tituloClaseFunnel } from '@/lib/onboarding-v2/videos-coach';
import { MS_SIN_PLAY, useMensajeDelVideo } from '@/app/_ui/tutorial/useMensajeDelVideo';
import { useColaDeSalida, type FilaDeCola } from '@/app/_chat/useColaDeSalida';
import { yaEntro } from '@/app/_ui/tutorial/entrada';
import { CLAVE_VIDEO_DEL_COACH } from './VideoDelCoach';

/** Lo que dice el video de cada coach cuando presenta la primera pregunta («Mira aquí, la caja del chat: contéstale la primera
 *  pregunta», 18,5 s en Offer Coach y 26,34 s en Funnel Coach): ahí sale el saludo (coaches-1). */
export const DICE_EL_COACH = 'primera pregunta';
const textoDe = (x: ItemHilo): string => (x.k === 'msg' ? x.texto ?? '' : x.k === 'aviso' ? x.texto : '');

/** El hilo del coach con su portada adelante (la presentación y el video del Offer Coach mientras la persona no escribió). Como la
 *  portada del chat vacío, no se guarda: es sólo lo que se dibuja. Sin portada, el motor tal cual. */
export function useHiloConPortada(k: ChatCliente, portada: readonly ItemHilo[] | null): ChatCliente {
  return useMemo(() => (portada?.length ? { ...k, items: [...portada, ...k.items] } : k), [k, portada]);
}

/**
 * Lo que va adentro del mensaje de MaKo que trae el PDF de una versión (con el motor de Offer): la oferta armada en UN mensaje
 * (./OfertaEnElChat.tsx) si es la última; sólo su PDF si es una anterior. Los mensajes del hilo llevan el id de Offer (`of-<id>`,
 * `itemsDeOffer`): así se sabe cuál es.
 */
export function useOfertaEnMensaje(sesion: OfferSesionVista | null, onSeguir: () => void, movil: boolean) {
  return useCallback((x: { id: string }): EnMensaje | null => {
    if (!sesion) return null;
    const m = sesion.mensajes.find((y) => `of-${y.id}` === x.id);
    const pdf = m ? pdfDeMensaje(m) : null;
    if (!pdf) return null;
    const c = sesion.conclusion;
    return { abajo: c && c.version === pdf.version
      ? <OfertaEnElChat sesion={sesion} conclusion={c} onSeguir={onSeguir} movil={movil} />
      : <PdfDeOtraVersion sesionId={sesion.id} version={pdf.version} /> };
  }, [sesion, onSeguir, movil]);
}

/** El Offer Coach no pudo abrir su conversación de Offer: por qué, con «Reintentar» (como el hilo que no cargó). */
export function ErrorDelOfferCoach({ error, onReintentar }: { error: string; onReintentar: () => void }) {
  return (
    <div className="co-portada">
      <p className="co-portada__dato">{error}</p>
      <button type="button" className="co-chip" onClick={onReintentar}>Reintentar</button>
    </div>
  );
}

/**
 * LA VOZ DE LOS COACHES debajo de cada mensaje del coach (la computadora y, desde el 19/11/2026, el teléfono: HojaDelCoach.tsx).
 * `fija`: una pregunta predefinida (el saludo de la portada), que se guarda la primera vez. El último mensaje suena solo. Junta lo
 * que el hilo ya llevaba en ese mensaje (`previo`: el video de la portada, la oferta armada) con el botón debajo.
 */
export function vozDelCoach(items: readonly ItemHilo[]) {
  const ultimoDelCoach = [...items].reverse().find((x) => x.k === 'msg')?.id ?? null;
  return (fija: boolean, previo?: (x: { id: string; texto: string }) => EnMensaje | null) => (x: { id: string; texto: string; k?: string }): EnMensaje | null => {
    const antes = previo?.(x as never) ?? null;
    if (!x.texto?.trim()) return antes;
    const voz = <BotonVozCoach id={x.id} texto={x.texto} fija={fija} autoplay={fija ? false : x.id === ultimoDelCoach} />;
    return { ...antes, abajo: <>{antes?.abajo}{voz}</> };
  };
}

type EnMensajeDe = (x: { id: string; texto: string }) => EnMensaje | null;

/**
 * EL HILO DE UN COACH DEL V2 (20/11/2026, auditoría V7, V12 y F4; la computadora y el teléfono):
 *   · la presentación con su video queda SIEMPRE al principio del hilo, como un mensaje más (antes se iba apenas la persona
 *     escribía; V12);
 *   · con el funnel guardado, la clase del funnel principal llega como un mensaje de MaKo en su lugar (V7;
 *     lib/onboarding-v2/videos-coach.ts), con el video arriba del texto (F4);
 *   · cada mensaje lleva lo suyo: la voz, y con el motor de Offer la oferta armada adentro del que trae su PDF.
 * Sin el V2 (`dosCoaches`), el hilo tal cual.
 */
export function useHiloDelCoach(o: {
  k: ChatCliente; cual: CoachDelOps; dosCoaches: boolean; plan: PlanFunnel | null; motorOffer: boolean;
  portada: { items: readonly ItemHilo[]; enMensaje: (x: { id: string }) => EnMensaje | null };
  conVoz: ReturnType<typeof vozDelCoach>; deLaOferta: EnMensajeDe | ((x: { id: string }) => EnMensaje | null);
  /** El coach abre con su portada (el chat vacío, o Offer sin que la persona haya escrito). */
  enPortada?: boolean;
  /** La entrada (los puntitos con lo demás oscuro): mientras escribe, el video todavía no está. Sin entrada (el teléfono), 'listo'. */
  entrada?: 'escribe' | 'listo';
}): { hilo: ChatCliente; enMensaje: EnMensajeDe | undefined } {
  const { k, cual, dosCoaches, plan, motorOffer, portada, conVoz, deLaOferta } = o;
  // La placa «Todavía no está grabado» sólo en la revisión de Martín (20/11, tarde, la segunda verificación de V10): con `!PARA_TODOS`
  // era verdadero para TODO el Cliente de Prueba; como VideoDelDia, los coaches y VideoChico, la decide su email (lo anota el motor).
  const revision = useEsRevision();
  const clase = useMemo(() => (dosCoaches && cual === 'funnel' && plan ? itemClaseFunnel(plan) : null), [dosCoaches, cual, plan]);
  // LA CLASE QUE LLEGA EN ESTA VISITA (20/11, la auditoría de chats, coaches-4): sale del plan releído al terminar el turno que lo guarda,
  // y aparecía pegada a la respuesta, sin puntitos. Si no estaba al abrir, va al final y sale por la cola (abajo), con los suyos.
  const [claseAlAbrir] = useState(() => clase?.id ?? null);
  const claseNueva = !!clase && clase.id !== claseAlAbrir;
  const kConClase = useMemo(() => (clase ? { ...k, items: claseNueva ? [...k.items, clase] : conLaClase<ItemHilo>(k.items, clase) } : k), [k, clase, claseNueva]);
  const hilo = useHiloConPortada(kConClase, dosCoaches ? portada.items : null);
  // EL SALUDO A SU MOMENTO DEL VIDEO (20/11, coaches-1; la maqueta: b-of-entra → video → recién OF_HOLA). La portada se dibujaba de una
  // vez: el video, el saludo con la primera pregunta y, en Offer Coach, el primer mensaje de Offer, en el mismo instante, y el video
  // dice «contéstale la primera pregunta» recién a los 18,5 s (26,3 en Funnel Coach). Ahora, la primera vez: el video (lo trae la
  // entrada), y el saludo cuando la voz lo nombra, el video termina o lo pausan (o sin play, a los MS_SIN_PLAY), con sus puntitos; en
  // Offer Coach, después, su primer mensaje y sus opciones. Quien vuelve (la entrada ya vista) lo ve todo de una.
  const claveVideo = CLAVE_VIDEO_DEL_COACH[cual];
  const idVideo = `video-${claveVideo}`;
  const [estaVez] = useState(() => !yaEntro(claveVideo));
  const enPortada = dosCoaches && !!o.enPortada;
  const conVideoPortada = enPortada && portada.items[0]?.id === idVideo;
  const lugar = useMemo(() => ({
    get current(): HTMLElement | null { return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`.mk-vmom[data-clave="${claveVideo}"]`); },
  }), [claveVideo]);
  const { fase: saludoFase } = useMensajeDelVideo({
    lugar, activo: conVideoPortada && estaVez && (o.entrada ?? 'listo') === 'listo', inicial: estaVez ? 'espera' : 'listo',
    clave: claveVideo, dice: DICE_EL_COACH, esperaPlay: MS_SIN_PLAY,
  });
  const idsPortada = useMemo(() => new Set(portada.items.map((x) => x.id)), [portada.items]);
  const filas = useMemo<FilaDeCola[]>(() => hilo.items.map((x): FilaDeCola => {
    if (estaVez && enPortada) {
      if (x.id === idVideo) return { id: x.id, de: 'ya', texto: '' };
      if (idsPortada.has(x.id)) return { id: x.id, de: 'mako', texto: textoDe(x) };
      // El primer mensaje de Offer (y sus opciones), después del saludo.
      if (motorOffer) return x.k === 'msg' ? { id: x.id, de: x.role === 'assistant' ? 'mako' : 'yo', texto: textoDe(x) } : { id: x.id, de: 'pieza', texto: '' };
    }
    if (claseNueva && clase && x.id === clase.id) return { id: x.id, de: 'mako', texto: textoDe(x) };
    return { id: x.id, de: 'ya', texto: '' };
  }), [hilo.items, estaVez, enPortada, idVideo, idsPortada, motorOffer, claseNueva, clase]);
  const cola = useColaDeSalida(filas, {
    historial: () => [],
    retenido: (id) => conVideoPortada && saludoFase !== 'listo' && idsPortada.has(id) && id !== idVideo,
  });
  const hiloVisible = useMemo<ChatCliente>(() => {
    const ver = new Set(cola.visibles.map((f) => f.id));
    return { ...hilo, items: hilo.items.filter((x) => ver.has(x.id)), enCurso: hilo.enCurso || cola.escribiendo };
  }, [hilo, cola.visibles, cola.escribiendo]);
  const enMensaje: EnMensajeDe = (x) => {
    if (idsPortada.has(x.id)) return conVoz(true, portada.enMensaje as never)(x);
    if (clase && plan && x.id === clase.id) {
      return conVoz(false, () => ({ arriba: <VideoDelMomento clave={claveClaseFunnel(plan.funnel)} titulo={tituloClaseFunnel(plan.funnel)} revision={revision} /> }))(x);
    }
    return conVoz(false, motorOffer ? (deLaOferta as never) : undefined)(x);
  };
  return { hilo: dosCoaches ? hiloVisible : hilo, enMensaje: dosCoaches ? enMensaje : undefined };
}
